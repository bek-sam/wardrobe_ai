import { csv, materialName } from "./import-text-helpers";
import type { CandidateMetadata, MetadataForm } from "./import-workspace.types";

export function formFromMetadata(metadata: CandidateMetadata): MetadataForm {
  return {
    name: metadata.name,
    category: metadata.category,
    subcategory: metadata.subcategory ?? "",
    primaryColorHex: metadata.primary_color_hex ?? "",
    secondaryColorHex: metadata.secondary_color_hex ?? "",
    colorNames: metadata.color_names.join(", "),
    pattern: metadata.pattern ?? "",
    silhouette: metadata.silhouette ?? "",
    material: materialName(metadata.materials),
    visibleText: metadata.visible_text.join(", "),
    seasonTags: metadata.season_tags.join(", "),
    occasionTags: metadata.occasion_tags.join(", "),
    notes: metadata.notes,
  };
}

export function metadataFromForm(form: MetadataForm): CandidateMetadata {
  return {
    name: form.name.trim(),
    category: form.category,
    subcategory: form.subcategory.trim() || null,
    primary_color_hex: form.primaryColorHex || null,
    secondary_color_hex: form.secondaryColorHex || null,
    color_names: csv(form.colorNames).slice(0, 8),
    pattern: form.pattern.trim() || null,
    silhouette: form.silhouette.trim() || null,
    materials: form.material.trim() ? { apparent: form.material.trim(), inferred: true } : {},
    visible_text: csv(form.visibleText).slice(0, 12),
    season_tags: csv(form.seasonTags).slice(0, 8),
    occasion_tags: csv(form.occasionTags).slice(0, 12),
    notes: form.notes.trim(),
  };
}
