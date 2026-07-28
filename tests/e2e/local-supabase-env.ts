import { execFileSync } from "node:child_process";

/**
 * Resolves the local Supabase credentials for the authenticated E2E run and
 * puts them on `process.env`, so both the Next dev server Playwright starts
 * and the specs themselves point at the same instance.
 *
 * Deliberately quiet: when Supabase is not running, this leaves the variables
 * unset and the authenticated specs skip themselves with an explanatory
 * message, while the public smoke specs still run. No OpenAI variable is set
 * here -- the authenticated specs exercise the deterministic routes only.
 */
export function applyLocalSupabaseEnv(): boolean {
  if (process.env.TEST_SUPABASE_URL && process.env.TEST_SUPABASE_SERVICE_ROLE_KEY) {
    return applyAppAliases();
  }

  let output: string;
  try {
    output = execFileSync("npx", ["supabase", "status", "-o", "env"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch {
    return false;
  }

  const values = new Map<string, string>();
  for (const line of output.split("\n")) {
    const match = line.match(/^([A-Z_]+)="?([^"]*)"?$/);
    const key = match?.[1];
    const value = match?.[2];
    if (key !== undefined && value !== undefined) values.set(key, value);
  }

  const url = values.get("API_URL");
  const anonKey = values.get("ANON_KEY");
  const serviceRoleKey = values.get("SERVICE_ROLE_KEY");
  if (!url || !anonKey || !serviceRoleKey) return false;

  process.env.TEST_SUPABASE_URL = url;
  process.env.TEST_SUPABASE_ANON_KEY = anonKey;
  process.env.TEST_SUPABASE_SERVICE_ROLE_KEY = serviceRoleKey;
  return applyAppAliases();
}

/** The app reads the standard NEXT_PUBLIC_ and SUPABASE_ names, not TEST_. */
function applyAppAliases(): boolean {
  process.env.NEXT_PUBLIC_SUPABASE_URL ??= process.env.TEST_SUPABASE_URL;
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??= process.env.TEST_SUPABASE_ANON_KEY;
  process.env.SUPABASE_SERVICE_ROLE_KEY ??= process.env.TEST_SUPABASE_SERVICE_ROLE_KEY;
  process.env.NEXT_PUBLIC_APP_URL ??= "http://127.0.0.1:3000";
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}
