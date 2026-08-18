import { OutfitsManager } from "@/features/outfits/components";
import { getFrontendConfig } from "@/lib/backend/server";

import { previewOutfits } from "../preview-data";

export const metadata = { title: "Outfits" };

export default async function OutfitsPage() {
  const configured = (await getFrontendConfig()).databaseConfigured;
  return (
    <div className="page-stack outfits-page">
      <OutfitsManager configured={configured} previewOutfits={previewOutfits} />
    </div>
  );
}
