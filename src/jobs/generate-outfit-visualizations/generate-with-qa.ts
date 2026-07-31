import type {
  GeneratedVisualizationImage,
  OutfitVisualizationProvider,
  VisualizationGarmentInput,
} from "@/lib/ai/visualization-provider";
import { VisualizationProviderError } from "@/lib/ai/visualization-provider";
import { evaluateQaGate, type VisualizationAssessment } from "@/lib/visualization";

export type QaAcceptedImage = {
  image: GeneratedVisualizationImage;
  assessment: VisualizationAssessment;
  correctionUsed: boolean;
};

type Attempt = { userId: string; identity: Buffer; garments: readonly VisualizationGarmentInput[] };

/**
 * Generates, gates, and — at most once — regenerates with the specific
 * structured failures fed back into the prompt. A second rejection is never
 * exposed as ready: it throws a `qa_rejected` error carrying the assessment's
 * safe summary, which the caller stores as a terminal failure.
 *
 * Transient transport failures are a separate concern handled by the job's own
 * retry budget; this only ever spends the one *content* correction.
 */
export async function generateWithQaGate(
  provider: OutfitVisualizationProvider,
  attempt: Attempt,
  correctionsAlreadyUsed: number,
  onStage: (stage: "generating" | "qa_review") => Promise<unknown> = async () => undefined,
): Promise<QaAcceptedImage> {
  let corrections: string[] = [];

  for (let round = 0; round <= 1; round += 1) {
    await onStage("generating");
    const image = await provider.generate({ ...attempt, correctionInstructions: corrections });
    await onStage("qa_review");
    const assessment = await provider.assess({ ...attempt, image: image.bytes });
    const gate = evaluateQaGate(assessment);

    if (gate.verdict === "pass") {
      return { image, assessment, correctionUsed: round > 0 };
    }
    const canCorrect =
      gate.verdict === "correctable" && round === 0 && correctionsAlreadyUsed === 0;
    if (!canCorrect) {
      throw new VisualizationProviderError(
        "qa_rejected",
        assessment.safeSummary ||
          (gate.reasons[0] ?? "The try-on did not pass the fidelity check."),
        image.requestId,
      );
    }
    corrections = [...gate.reasons, ...assessment.correctionInstructions];
  }

  throw new VisualizationProviderError(
    "qa_rejected",
    "The try-on did not pass the fidelity check.",
  );
}
