import { timingSafeEqual } from "node:crypto";

// Constant-time comparison so worker-secret checks can't be timed to leak
// how many leading bytes matched.
export function authorizedWorkerRequest(request: Request, secret: string | undefined) {
  if (!secret) return false;
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const expectedBytes = Buffer.from(secret);
  const suppliedBytes = Buffer.from(supplied);
  return (
    expectedBytes.length === suppliedBytes.length && timingSafeEqual(expectedBytes, suppliedBytes)
  );
}
