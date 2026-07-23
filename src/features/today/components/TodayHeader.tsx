import { Sparkle } from "@phosphor-icons/react";

import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";

export function TodayHeader({ dateLabel, title }: { dateLabel: string; title: string }) {
  return (
    <PageHeader
      eyebrow={dateLabel}
      title={title}
      description="Let’s make getting dressed the easiest decision of your day."
      meta={<Badge tone="sage">Live wardrobe</Badge>}
      actions={
        <ButtonLink href="/stylist">
          Ask your stylist <Sparkle aria-hidden="true" size={16} />
        </ButtonLink>
      }
    />
  );
}
