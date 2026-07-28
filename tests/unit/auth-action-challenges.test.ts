import { describe, expect, it } from "vitest";

import { readAuthAction } from "@/lib/auth/action-challenges/read";
import { signAuthAction, verifyAuthActionSignature } from "@/lib/auth/action-challenges/token";
import type { AuthActionPayload } from "@/lib/auth/action-challenges/types";

const SECRET = "a".repeat(64);
const OTHER_SECRET = "b".repeat(64);
const USER = "11111111-1111-4111-8111-111111111111";
const OTHER_USER = "22222222-2222-4222-8222-222222222222";

function payload(overrides: Partial<AuthActionPayload> = {}): AuthActionPayload {
  const now = Math.floor(Date.now() / 1000);
  return {
    v: 1,
    purpose: "password_reset",
    userId: USER,
    sessionId: "session-1",
    nonce: "44444444-4444-4444-8444-444444444444",
    issuedAt: now,
    expiresAt: now + 600,
    ...overrides,
  };
}

describe("auth action token signing", () => {
  it("round-trips a payload it signed", () => {
    const token = signAuthAction(payload(), SECRET);
    expect(verifyAuthActionSignature(token, SECRET)).toEqual(payload());
  });

  it("rejects a token signed with a different key", () => {
    expect(verifyAuthActionSignature(signAuthAction(payload(), OTHER_SECRET), SECRET)).toBeNull();
  });

  it("rejects a tampered payload", () => {
    const token = signAuthAction(payload(), SECRET);
    const tampered = `${Buffer.from(
      JSON.stringify(payload({ userId: OTHER_USER })),
      "utf8",
    ).toString("base64url")}.${token.split(".")[1]}`;
    expect(verifyAuthActionSignature(tampered, SECRET)).toBeNull();
  });

  it("rejects structurally malformed tokens without throwing", () => {
    expect(verifyAuthActionSignature("", SECRET)).toBeNull();
    expect(verifyAuthActionSignature("nodot", SECRET)).toBeNull();
    expect(verifyAuthActionSignature(".sig", SECRET)).toBeNull();
    expect(verifyAuthActionSignature("body.", SECRET)).toBeNull();
    expect(verifyAuthActionSignature("not-base64.also-not", SECRET)).toBeNull();
  });

  it("carries no session or provider tokens", () => {
    const decoded = verifyAuthActionSignature(signAuthAction(payload(), SECRET), SECRET);
    const keys = Object.keys(decoded ?? {});
    expect(keys).toEqual(
      expect.arrayContaining([
        "v",
        "purpose",
        "userId",
        "sessionId",
        "nonce",
        "issuedAt",
        "expiresAt",
      ]),
    );
    expect(keys).not.toContain("access_token");
    expect(keys).not.toContain("refresh_token");
  });
});

describe("readAuthAction bindings", () => {
  const expected = { purpose: "password_reset" as const, userId: USER };

  it("accepts a valid, unexpired, correctly bound challenge", () => {
    const token = signAuthAction(payload(), SECRET);
    expect(readAuthAction(token, SECRET, expected)).toEqual({ ok: true, payload: payload() });
  });

  it("reports a missing cookie distinctly", () => {
    expect(readAuthAction(null, SECRET, expected)).toEqual({ ok: false, reason: "missing" });
    expect(readAuthAction(undefined, SECRET, expected)).toEqual({ ok: false, reason: "missing" });
  });

  it("rejects a challenge minted for another purpose", () => {
    const token = signAuthAction(payload({ purpose: "account_deletion" }), SECRET);
    expect(readAuthAction(token, SECRET, expected)).toEqual({ ok: false, reason: "wrong_purpose" });
  });

  it("rejects a challenge minted for another user", () => {
    const token = signAuthAction(payload({ userId: OTHER_USER }), SECRET);
    expect(readAuthAction(token, SECRET, expected)).toEqual({ ok: false, reason: "wrong_user" });
  });

  it("rejects an expired challenge", () => {
    const now = Math.floor(Date.now() / 1000);
    const token = signAuthAction(payload({ expiresAt: now - 1 }), SECRET);
    expect(readAuthAction(token, SECRET, expected)).toEqual({ ok: false, reason: "expired" });
  });

  it("rejects a challenge exactly at its expiry instant", () => {
    const at = Math.floor(Date.now() / 1000);
    const token = signAuthAction(payload({ expiresAt: at }), SECRET);
    expect(readAuthAction(token, SECRET, { ...expected, now: at * 1000 })).toEqual({
      ok: false,
      reason: "expired",
    });
  });

  it("rejects a forged signature", () => {
    const token = signAuthAction(payload(), OTHER_SECRET);
    expect(readAuthAction(token, SECRET, expected)).toEqual({
      ok: false,
      reason: "invalid_signature",
    });
  });
});
