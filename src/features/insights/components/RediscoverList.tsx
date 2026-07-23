import { ArrowRight } from "@phosphor-icons/react";
import Link from "next/link";
import type { ReactNode } from "react";

import { GarmentArtwork } from "@/features/wardrobe/components/GarmentArtwork";
import { SectionHeader } from "@/components/ui/PageHeader";

import type { RediscoverEntry } from "./rediscover-entry.types";

export function RediscoverList({
  title,
  description,
  actionBadge,
  items,
}: {
  title: string;
  description: string;
  actionBadge: ReactNode;
  items: RediscoverEntry[];
}) {
  return (
    <section>
      <SectionHeader action={actionBadge} description={description} title={title} />
      <div className="rediscover-list">
        {items.map((item) => (
          <article key={item.id}>
            <GarmentArtwork compact category={item.category} color={item.color} />
            <div>
              <span>{item.label}</span>
              <h3>{item.name}</h3>
              <p>{item.detail}</p>
            </div>
            <Link href={`/wardrobe/${item.id}`}>
              View <ArrowRight size={14} />
            </Link>
          </article>
        ))}
      </div>
    </section>
  );
}
