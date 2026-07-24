import { NextResponse } from "next/server";

export function copySessionCookies(from: NextResponse, to: NextResponse) {
  for (const cookie of from.cookies.getAll()) {
    to.cookies.set(cookie);
  }
  to.headers.set("Cache-Control", "private, no-store");
  return to;
}
