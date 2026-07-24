import { Badge } from "@/components/ui/Badge";
import { GarmentArtwork } from "@/features/wardrobe/components/GarmentArtwork";

export function TodayLookArt() {
  return (
    <div className="today-look__art">
      <div className="today-look__label">
        <Badge tone="rust">Recommended preview</Badge>
      </div>
      <div className="today-look__pieces">
        <GarmentArtwork category="top" color="#ddd4c2" accent="#766e61" />
        <GarmentArtwork category="bottom" color="#293647" />
        <GarmentArtwork category="layer" color="#9c7250" />
        <GarmentArtwork category="shoes" color="#292724" />
      </div>
    </div>
  );
}
