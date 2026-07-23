import { Sparkle } from "@phosphor-icons/react";

import { Button } from "@/components/ui/Button";

export function PreviewOutfitsEmptyPrompt() {
  return (
    <section className="outfit-empty-prompt">
      <div>
        <Sparkle size={25} weight="light" />
        <div>
          <h2>More combinations are hiding in your closet.</h2>
          <p>Connect Supabase so recommendations can use your real wardrobe items.</p>
        </div>
      </div>
      <Button disabled variant="secondary">
        Explore combinations
      </Button>
    </section>
  );
}
