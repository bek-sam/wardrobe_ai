import { getServerEnvironment } from "./get-environment";
import type { ServerEnvironment } from "./schema";

export function requireEnvironment<K extends keyof ServerEnvironment>(
  ...keys: K[]
): ServerEnvironment & Required<Pick<ServerEnvironment, K>> {
  const environment = getServerEnvironment();
  const missing = keys.filter((key) => !environment[key]);

  if (missing.length > 0) {
    throw new Error(`Missing required server configuration: ${missing.join(", ")}`);
  }

  return environment as ServerEnvironment & Required<Pick<ServerEnvironment, K>>;
}
