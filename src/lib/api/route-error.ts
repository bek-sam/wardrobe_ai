import { NextResponse } from "next/server";

import { AuthenticationError } from "@/lib/auth/viewer";

import { ApiError, type ApiFailure } from "./api-error";

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
