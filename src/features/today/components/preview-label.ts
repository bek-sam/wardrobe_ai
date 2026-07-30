/** Names the action for a preview that is not `ready`, from its current state. */
export function previewLabel(previewStatus: string | null): string {
  if (previewStatus === "queued" || previewStatus === "generating") return "Finish this preview";
  if (previewStatus === "failed") return "Retry the modeled preview";
  return "Generate a modeled preview";
}
