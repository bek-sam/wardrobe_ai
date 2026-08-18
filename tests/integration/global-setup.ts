import { execFileSync } from "node:child_process";

/**
 * Vitest globalSetup: makes `npm run test:integration` work with just
 * `npx supabase start --workdir database` beforehand, no manual env copying.
 * Parses `supabase status --workdir database -o env` (KEY="VALUE" lines) instead of requiring the
 * developer to run it and export the result themselves.
 */
export default function setup() {
  if (process.env.TEST_SUPABASE_URL && process.env.TEST_SUPABASE_SERVICE_ROLE_KEY) {
    applyAppEnvAliases();
    return;
  }

  let output: string;
  try {
    output = execFileSync("npx", ["supabase", "status", "--workdir", "database", "-o", "env"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch {
    throw new Error(
      "Could not read local Supabase status. Run `npx supabase start --workdir database` first, then re-run " +
        "`npm run test:integration`. (Or set TEST_SUPABASE_URL/TEST_SUPABASE_ANON_KEY/" +
        "TEST_SUPABASE_SERVICE_ROLE_KEY yourself to point at another instance.)",
    );
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
  if (!url || !anonKey || !serviceRoleKey) {
    throw new Error(
      "`supabase status --workdir database -o env` did not report API_URL/ANON_KEY/SERVICE_ROLE_KEY. Is " +
        "`npx supabase start --workdir database` running? Got keys: " +
        [...values.keys()].join(", "),
    );
  }

  process.env.TEST_SUPABASE_URL = url;
  process.env.TEST_SUPABASE_ANON_KEY = anonKey;
  process.env.TEST_SUPABASE_SERVICE_ROLE_KEY = serviceRoleKey;
  applyAppEnvAliases();
}

// A few integration tests exercise real src/ application code (e.g.
// retrieveStoredOutfitCandidates), which reads the standard app env var
// names via createAdminClient()/getServerEnvironment() -- not the TEST_*
// names above. Alias them so that code path resolves the same local
// instance without needing its own env handling.
function applyAppEnvAliases() {
  process.env.SUPABASE_URL ??= process.env.TEST_SUPABASE_URL;
  process.env.SUPABASE_PUBLISHABLE_KEY ??= process.env.TEST_SUPABASE_ANON_KEY;
  process.env.SUPABASE_SERVICE_ROLE_KEY ??= process.env.TEST_SUPABASE_SERVICE_ROLE_KEY;
}
