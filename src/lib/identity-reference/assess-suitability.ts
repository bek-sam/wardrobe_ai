import { resolveVisualizationProvider } from "@/lib/ai/visualization-provider";
import type { IdentityReferenceAssessment } from "@/lib/visualization";

/**
 * Structured suitability check. Fails closed: when the try-on provider is not
 * configured, this throws rather than fabricating a "pass", so a photo can
 * never be activated on a deployment that could not actually check it.
 */
export async function assessIdentitySuitability(
  userId: string,
  image: Buffer,
): Promise<IdentityReferenceAssessment> {
  return resolveVisualizationProvider().assessIdentity({ userId, image });
}

/**
 * A "warn" verdict is a borderline framing note the user may override, so it
 * still reaches storage as activatable. "fail" (no person, several people, an
 * unreadable file, moderated input) never does.
 */
export function validationStatusFor(
  assessment: IdentityReferenceAssessment,
): "pass" | "warn" | "fail" {
  if (assessment.verdict === "fail") return "fail";
  if (assessment.personCount !== 1 || !assessment.faceVisible) return "fail";
  return assessment.verdict;
}
