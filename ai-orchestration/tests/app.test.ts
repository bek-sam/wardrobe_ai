import { afterEach, describe, expect, it } from "vitest";

import { createAiOrchestrationApp } from "../src/app.js";

const apps: ReturnType<typeof createAiOrchestrationApp>[] = [];
const originalToken = process.env.AI_SERVICE_TOKEN;

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
  if (originalToken === undefined) delete process.env.AI_SERVICE_TOKEN;
  else process.env.AI_SERVICE_TOKEN = originalToken;
});

describe("AI orchestration process contract", () => {
  it("exposes health without exposing a generic prompt endpoint", async () => {
    const app = createAiOrchestrationApp({
      logger: false,
      startedAt: new Date("2026-08-12T00:00:00Z"),
    });
    apps.push(app);

    const health = await app.inject({ method: "GET", url: "/internal/v1/health" });
    const genericPrompt = await app.inject({ method: "POST", url: "/internal/v1/prompt" });

    expect(health.statusCode).toBe(200);
    expect(health.json()).toMatchObject({
      service: "ai-orchestration",
      status: "ok",
      version: "0.1.0",
    });
    expect(genericPrompt.statusCode).toBe(404);
  });

  it("requires workload authentication before task lookup", async () => {
    const app = createAiOrchestrationApp({ logger: false });
    apps.push(app);
    const response = await app.inject({
      method: "POST",
      url: "/internal/v1/tasks/occasion",
      headers: { "x-deadline-at": new Date(Date.now() + 10_000).toISOString() },
      payload: { input: { userId: "user-1", rawText: "work" } },
    });
    expect(response.statusCode).toBe(401);
  });

  it("rejects unknown, expired, and malformed private tasks before provider work", async () => {
    process.env.AI_SERVICE_TOKEN = "t".repeat(32);
    const app = createAiOrchestrationApp({ logger: false });
    apps.push(app);
    const authorization = `Bearer ${process.env.AI_SERVICE_TOKEN}`;
    const future = new Date(Date.now() + 10_000).toISOString();

    expect(
      (
        await app.inject({
          method: "POST",
          url: "/internal/v1/tasks/not-a-task",
          headers: { authorization, "x-deadline-at": future },
          payload: { input: { userId: "user-1" } },
        })
      ).statusCode,
    ).toBe(404);
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/internal/v1/tasks/occasion",
          headers: { authorization, "x-deadline-at": new Date(Date.now() - 1_000).toISOString() },
          payload: { input: { userId: "user-1", rawText: "work" } },
        })
      ).statusCode,
    ).toBe(408);
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/internal/v1/tasks/occasion",
          headers: { authorization, "x-deadline-at": future },
          payload: { input: { rawText: "work" } },
        })
      ).statusCode,
    ).toBe(400);
  });
});
