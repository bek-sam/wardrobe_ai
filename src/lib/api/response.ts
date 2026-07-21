import { NextResponse } from "next/server";
import type { ZodType } from "zod";
import { AuthenticationError } from "@/lib/auth/viewer";

export type ApiSuccess<T> = { data: T };
export type ApiFailure = { error: { code: string; message: string; details?: unknown } };

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json<ApiSuccess<T>>({ data }, init);
}

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

export function routeError(error: unknown) {
  if (error instanceof AuthenticationError) {
    return NextResponse.json<ApiFailure>(
      { error: { code: error.code, message: error.message } },
      { status: error.status },
    );
  }
  if (error instanceof ApiError) {
    return NextResponse.json<ApiFailure>(
      { error: { code: error.code, message: error.message, details: error.details } },
      { status: error.status },
    );
  }

  console.error("Unhandled route error", {
    name: error instanceof Error ? error.name : "UnknownError",
    code:
      error && typeof error === "object" && "code" in error && typeof error.code === "string"
        ? error.code
        : "unclassified",
  });
  return NextResponse.json<ApiFailure>(
    { error: { code: "internal_error", message: "The request could not be completed." } },
    { status: 500 },
  );
}
