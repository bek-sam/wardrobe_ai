import { ImportWorkspace } from "@/features/intake/components/ImportWorkspace";
import { isSupabaseConfigured } from "@/lib/env/client";

export const metadata = { title: "Import clothes" };

export default function ImportPage() {
  return <ImportWorkspace configured={isSupabaseConfigured()} />;
}
