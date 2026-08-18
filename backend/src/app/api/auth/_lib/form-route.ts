import type { NextResponse } from "next/server";
import type { ZodType } from "zod";

import { formDataObject } from "@/features/auth/schemas";
import { RateLimitError } from "@/lib/api/response";
import { rejectUntrustedOrigin } from "@/lib/api/origin";
import { authFailure } from "@/lib/auth/auth-error";

import { authRedirect } from "./redirect";

export type FormRouteResult<T> = { ok: true; data: T } | { ok: false; response: NextResponse };

/**
 * Shared front half of every auth form POST.
 *
 * Order matters and is the point of this helper: the origin check runs before
 * the body is read, before any schema work, and long before a provider call or
 * an email send. A cross-site submission therefore costs one header comparison
 * rather than a round trip to Supabase.
 */
export async function readAuthForm<T>(
  request: Request,
  schema: ZodType<T>,
  failurePath: string,
): Promise<FormRouteResult<T>> {
  const rejected = rejectUntrustedOrigin(request);
  if (rejected) return { ok: false, response: rejected };

  let parsed;
  try {
    parsed = schema.safeParse(formDataObject(await request.formData()));
  } catch {
    return { ok: false, response: authRedirect(failurePath, invalidRequest()) };
  }

  if (!parsed.success) {
    return { ok: false, response: authRedirect(failurePath, invalidRequest()) };
  }
  return { ok: true, data: parsed.data };
}

function invalidRequest() {
  return { error: authFailure("invalid_request").message };
}

/** Turns a thrown `RateLimitError` into the same generic redirect every flow uses. */
export function rateLimitRedirect(error: unknown, failurePath: string): NextResponse | null {
  if (!(error instanceof RateLimitError)) return null;
  return authRedirect(failurePath, { error: error.message });
}
