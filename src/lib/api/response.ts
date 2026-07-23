import { NextResponse } from "next/server";

import type { ApiSuccess } from "./api-error";

export { ApiError, type ApiFailure, type ApiSuccess } from "./api-error";
export { parseJson } from "./parse-json";
export { routeError } from "./route-error";

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json<ApiSuccess<T>>({ data }, init);
}
