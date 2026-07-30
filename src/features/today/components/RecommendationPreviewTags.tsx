import { Badge } from "@/components/ui/Badge";

export function RecommendationPreviewTags({ styleTags }: { styleTags: string[] }) {
  if (!styleTags.length) return null;
  return (
    <div className="recommendation-preview__tags">
      {styleTags.map((tag) => (
        <Badge key={tag} tone="outline">
          {tag}
        </Badge>
      ))}
    </div>
  );
}
