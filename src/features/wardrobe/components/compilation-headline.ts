import type { CompileStatusResponse } from "./compilation-status.types";

export function compilationHeadline(
  status: CompileStatusResponse | null,
  isRunning: boolean,
  isFailed: boolean,
): string {
  if (isRunning) return "Recompiling your outfit library…";
  if (isFailed) return "Your outfit library could not be recompiled. You can try again.";
  if (status?.dirty_since) return "Outfit library: changes pending";
  if (status) return `Outfit library: ${status.candidate_count} outfits ready`;
  return "Outfit library: —";
}
