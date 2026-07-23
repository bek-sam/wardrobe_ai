import { Crop } from "@phosphor-icons/react";

import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { GarmentArtwork } from "@/features/wardrobe/components/GarmentArtwork";

const sampleCandidates = [
  { name: "Stone Oxford Shirt", category: "top" as const, color: "#ddd4c2" },
  { name: "Navy Trouser", category: "bottom" as const, color: "#293647" },
];

export function PreviewCandidateGrid() {
  return (
    <section className="candidate-section" aria-labelledby="preview-candidate-title">
      <div className="card-title-row">
        <div>
          <p className="eyebrow">Workflow preview</p>
          <h2 id="preview-candidate-title">2 sample garments</h2>
        </div>
        <Badge tone="outline">Sample candidates</Badge>
      </div>
      <div className="candidate-grid">
        {sampleCandidates.map((item) => (
          <Card as="article" className="candidate-card" key={item.name} padded={false}>
            <div className="candidate-card__image">
              <GarmentArtwork category={item.category} color={item.color} />
              <span>
                <Crop size={14} /> Sample crop
              </span>
            </div>
            <div className="candidate-card__body">
              <div>
                <Badge tone="outline">Preview only</Badge>
                <h3>{item.name}</h3>
                <p>Nothing from this card is saved.</p>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </section>
  );
}
