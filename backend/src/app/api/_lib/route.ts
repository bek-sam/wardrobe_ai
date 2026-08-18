import { z, type ZodType } from "zod";

import { ApiError } from "@/lib/api/response";

const idempotencyKeySchema = z.string().trim().min(1).max(200);

export function throwDatabaseError(error: unknown, message: string): asserts error is null {
  if (error) throw new ApiError(500, "database_error", message);
}

export function throwNotFound(resource: string): never {
  throw new ApiError(404, "not_found", `${resource} was not found.`);
}

export async function parseRouteParams<T>(
  params: Promise<unknown>,
  schema: ZodType<T>,
): Promise<T> {
  const parsed = schema.safeParse(await params);
  if (!parsed.success) {
    throw new ApiError(404, "not_found", "The requested resource was not found.");
  }
  return parsed.data;
}

export function parseQuery<T>(request: Request, schema: ZodType<T>): T {
  const values = Object.fromEntries(new URL(request.url).searchParams.entries());
  const parsed = schema.safeParse(values);
  if (!parsed.success) {
    throw new ApiError(
      422,
      "validation_failed",
      "The query parameters are invalid.",
      parsed.error.flatten(),
    );
  }
  return parsed.data;
}

export function resolveIdempotencyKey(request: Request, bodyKey?: string) {
  const headerKey = request.headers.get("Idempotency-Key") ?? undefined;
  const parsedHeader =
    headerKey === undefined ? undefined : idempotencyKeySchema.safeParse(headerKey);
  if (parsedHeader && !parsedHeader.success) {
    throw new ApiError(422, "validation_failed", "The Idempotency-Key header is invalid.");
  }
  if (bodyKey && parsedHeader?.success && bodyKey !== parsedHeader.data) {
    throw new ApiError(
      422,
      "idempotency_key_mismatch",
      "The body and header idempotency keys must match.",
    );
  }
  return bodyKey ?? (parsedHeader?.success ? parsedHeader.data : null);
}
