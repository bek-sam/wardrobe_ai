import { OutfitsManager } from "@/features/outfits/components/OutfitsManager";
import { isSupabaseConfigured } from "@/lib/env/client";

import { previewOutfits } from "../preview-data";

export const metadata = { title: "Outfits" };

export default function OutfitsPage() {
  return (
    <div className="page-stack outfits-page">
      <OutfitsManager configured={isSupabaseConfigured()} previewOutfits={previewOutfits} />
    </div>
  );
}
