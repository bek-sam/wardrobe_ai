export const PARTS = [
  ["upperbody", "Tops"],
  ["wholebody_up", "Jackets"],
  ["lowerbody", "Bottoms"],
  ["accessories_up", "Accessories"],
  ["shoes", "Shoes"],
];

export const HEX_COLOR = /^#[0-9a-f]{6}$/i;

export function deriveStatus(job) {
  const crop = job.stages?.crop;
  const garment = job.stages?.garment;
  const modeled = job.stages?.modeled;
  if (
    job.error ||
    crop?.status === "failed" ||
    garment?.status === "failed" ||
    modeled?.status === "failed"
  )
    return {
      tone: "error",
      text: "Import needs attention",
      detail: crop?.error || garment?.error || modeled?.error || job.error,
    };
  if (modeled?.status === "review")
    return { tone: "ready", text: "Modeled image ready for review" };
  if (modeled?.status === "processing")
    return { tone: "processing", text: "Styling modeled image" };
  if (garment?.status === "review") return { tone: "ready", text: "Ready for review" };
  if (garment?.status === "approved") return { tone: "processing", text: "Creating modeled image" };
  if (crop?.status === "review") return { tone: "ready", text: "Crop ready for review" };
  if (crop?.status === "approved") return { tone: "processing", text: "Creating garment image" };
  if (
    crop?.status === "rejected" ||
    garment?.status === "rejected" ||
    modeled?.status === "rejected"
  )
    return { tone: "complete", text: "Import declined" };
  return { tone: "processing", text: "Extracting clothing from image" };
}

export function reviewStageFor(job) {
  if (job.stages?.modeled?.status === "review") return "modeled";
  if (job.stages?.garment?.status === "review") return "garment";
  if (job.stages?.crop?.status === "review") return "crop";
  return null;
}

export function hasCleanupFailure(job) {
  return job.stages?.garment?.status === "failed" && Boolean(job.stages?.garment?.failedAssetUrl);
}

export function defaultDraft(job) {
  const metadata = job.metadata || {};
  return {
    name: metadata.name || "New piece",
    part: metadata.part || "upperbody",
    color: metadata.color || "#d8d0c2",
    secondaryColor: metadata.secondaryColor || "",
    tags: Array.isArray(metadata.tags) ? metadata.tags.join(", ") : metadata.tags || "",
  };
}
