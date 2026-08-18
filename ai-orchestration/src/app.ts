import {
  AI_PRIVATE_API_PREFIX,
  serviceHealthResponseJsonSchema,
  type AiOrchestrationHealthResponse,
} from "@wardrobe/contracts";
import Fastify, { type FastifyInstance } from "fastify";
import { timingSafeEqual } from "node:crypto";

import { AI_TASKS, encodeTaskValue, runAiTask, TaskInputError, type AiTask } from "./tasks.js";

const SERVICE_VERSION = "0.1.0";

export interface AiOrchestrationAppOptions {
  logger?: boolean;
  startedAt?: Date;
}

export function createAiOrchestrationApp(options: AiOrchestrationAppOptions = {}): FastifyInstance {
  const app = Fastify({ logger: options.logger ?? true, bodyLimit: 50 * 1024 * 1024 });
  const startedAt = (options.startedAt ?? new Date()).toISOString();

  app.addHook("onRequest", async (request, reply) => {
    reply.header("x-request-id", request.id);
  });

  app.get(
    `${AI_PRIVATE_API_PREFIX}/health`,
    { schema: { response: { 200: serviceHealthResponseJsonSchema } } },
    async (): Promise<AiOrchestrationHealthResponse> => ({
      service: "ai-orchestration",
      status: "ok",
      version: SERVICE_VERSION,
      startedAt,
      checkedAt: new Date().toISOString(),
    }),
  );

  app.post<{ Params: { task: AiTask }; Body: { input?: unknown } }>(
    `${AI_PRIVATE_API_PREFIX}/tasks/:task`,
    async (request, reply) => {
      const expected = process.env.AI_SERVICE_TOKEN;
      const authorization = request.headers.authorization;
      const supplied = authorization?.startsWith("Bearer ") ? authorization.slice(7) : "";
      if (
        !expected ||
        expected.length < 32 ||
        supplied.length !== expected.length ||
        !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))
      ) {
        return reply.code(401).send({ error: { code: "unauthorized", message: "Unauthorized." } });
      }
      if (!AI_TASKS.includes(request.params.task)) {
        return reply.code(404).send({ error: { code: "unknown_task", message: "Unknown task." } });
      }
      const deadline = request.headers["x-deadline-at"];
      if (typeof deadline !== "string" || !Number.isFinite(Date.parse(deadline))) {
        return reply
          .code(400)
          .send({ error: { code: "deadline_required", message: "A valid deadline is required." } });
      }
      if (Date.parse(deadline) <= Date.now()) {
        return reply
          .code(408)
          .send({ error: { code: "deadline_exceeded", message: "The task deadline elapsed." } });
      }

      try {
        const result = await runAiTask(request.params.task, request.body?.input);
        return reply.header("Cache-Control", "no-store").send({ data: encodeTaskValue(result) });
      } catch (error) {
        if (error instanceof TaskInputError) {
          return reply
            .code(400)
            .send({ error: { code: "invalid_task_input", message: error.message } });
        }
        request.log.error({ error, task: request.params.task }, "AI task failed");
        return reply.code(502).send({
          error: { code: "ai_task_failed", message: "The AI task could not be completed." },
        });
      }
    },
  );

  return app;
}
