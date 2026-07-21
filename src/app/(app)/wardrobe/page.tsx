import { WardrobeManager } from "@/features/wardrobe/components/WardrobeManager";
import { isSupabaseConfigured } from "@/lib/env/client";
import { previewItems } from "../preview-data";

export const metadata = { title: "Wardrobe" };

export default function WardrobePage() {
  return (
    <div className="page-stack">
      <WardrobeManager configured={isSupabaseConfigured()} previewItems={previewItems} />
    </div>
  );
}
