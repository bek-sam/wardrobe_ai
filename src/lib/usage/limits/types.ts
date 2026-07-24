import type { SupabaseClient } from "@supabase/supabase-js";

export type UsageClient = Pick<SupabaseClient, "rpc">;
