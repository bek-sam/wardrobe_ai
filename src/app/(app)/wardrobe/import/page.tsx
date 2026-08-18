import { ImportWorkspace } from "@/features/intake/components";
import { getFrontendConfig } from "@/lib/backend/server";

export const metadata = { title: "Import clothes" };

export default async function ImportPage() {
  const configured = (await getFrontendConfig()).databaseConfigured;
  return <ImportWorkspace configured={configured} />;
}
