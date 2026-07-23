import { Badge } from "@/components/ui/Badge";
import { GarmentArtwork } from "@/features/wardrobe/components/GarmentArtwork";

export function PreviewRecommendationPanel() {
  return (
    <aside className="recommendation-panel" aria-labelledby="preview-recommendation-title">
      <div className="recommendation-panel__header">
        <div>
          <p className="eyebrow">Sample recommendation</p>
          <h2 id="preview-recommendation-title">Workday preview</h2>
        </div>
        <Badge tone="outline">Sample</Badge>
      </div>
      <div className="recommendation-panel__canvas">
        <GarmentArtwork category="top" color="#ddd4c2" />
        <GarmentArtwork category="bottom" color="#293647" />
        <GarmentArtwork category="layer" color="#9c7250" />
        <GarmentArtwork category="shoes" color="#292724" />
      </div>
      <p className="recommendation-empty-copy">
        Names, item IDs, saving, swapping, and feedback remain disabled until account data is
        available.
      </p>
    </aside>
  );
}
