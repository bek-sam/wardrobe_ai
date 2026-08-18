import { WardrobeManager } from "@/features/wardrobe/components";
import { getFrontendConfig } from "@/lib/backend/server";
import { previewItems } from "../preview-data";

export const metadata = { title: "Wardrobe" };

export default async function WardrobePage() {
  const configured = (await getFrontendConfig()).databaseConfigured;
  return (
    <div className="page-stack">
      <WardrobeManager configured={configured} previewItems={previewItems} />
    </div>
  );
}
