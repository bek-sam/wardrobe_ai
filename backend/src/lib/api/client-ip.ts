import { getServerEnvironment } from "@/lib/env/server";

// Deliberately loose shape checks, not full parsers: the value is only ever
// hashed into a rate-limit bucket, so the goal is to reject junk that would
// fragment buckets, not to validate routability.
const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/;
const IPV6 = /^[0-9a-f:]{2,45}$/i;

function looksLikeIpAddress(value: string): boolean {
  if (IPV4.test(value)) return value.split(".").every((part) => Number(part) <= 255);
  return IPV6.test(value) && value.includes(":");
}

/**
 * The client IP, but only when the deployment has named a header its reverse
 * proxy **overwrites** (`TRUSTED_CLIENT_IP_HEADER`).
 *
 * Any client can put whatever it likes in `X-Forwarded-For`. Reading it
 * unconditionally would let an attacker mint a fresh rate-limit bucket per
 * request — worse than having no IP limiting at all, because it looks like
 * protection. So an unset variable returns `null` and callers fall back to a
 * shared "unknown proxy" bucket instead of trusting the request.
 *
 * On Vercel set this to `x-vercel-forwarded-for`. Locally leave it unset.
 */
export function trustedClientIp(request: Request): string | null {
  const headerName = getServerEnvironment().TRUSTED_CLIENT_IP_HEADER;
  if (!headerName) return null;

  const raw = request.headers.get(headerName);
  if (!raw) return null;

  // A proxy that overwrites still writes a list when it forwards a chain; the
  // left-most entry is the one it observed.
  const first = raw.split(",")[0]?.trim() ?? "";
  const normalized = first.startsWith("::ffff:") ? first.slice(7) : first;
  return looksLikeIpAddress(normalized) ? normalized.toLowerCase() : null;
}
