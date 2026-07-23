import type { ZodType } from "zod";

import { ApiError } from "./api-error";

export async function parseJson<T>(request: Request, schema: ZodType<T>): Promise<T> {
  let value: unknown;
  try {
    value = await request.json();
  } catch {
    throw new ApiError(400, "invalid_json", "The request body must be valid JSON.");
  }

  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw new ApiError(
      422,
      "validation_failed",
      "The request data is invalid.",
      parsed.error.flatten(),
    );
  }
  return parsed.data;
}
