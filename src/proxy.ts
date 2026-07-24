import type { NextRequest } from "next/server";

import { runProxy } from "@/lib/proxy";

export async function proxy(request: NextRequest) {
  return runProxy(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
