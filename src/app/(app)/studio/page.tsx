import { PageHeader } from "@/components/ui";
import { OutfitStudioShell } from "@/features/studio/components";

export const metadata = { title: "Outfit Studio" };
export const dynamic = "force-dynamic";

/**
 * Defaults to today rather than tomorrow: the studio is where you decide what
 * to put on now, and a planner already covers the days ahead.
 */
export default function OutfitStudioPage() {
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="page-stack studio-page">
      <PageHeader
        description="Three complete looks from pieces you already own — see them laid out, then see them on you."
        eyebrow="Outfit Studio"
        title="What are you dressing for?"
      />
      <OutfitStudioShell initialDate={today} />
    </div>
  );
}
