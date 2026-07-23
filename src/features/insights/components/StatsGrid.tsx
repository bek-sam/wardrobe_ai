import { Card } from "@/components/ui/Card";
import type { Icon } from "@phosphor-icons/react";

export type StatCard = { icon: Icon; label: string; value: string; note: string };

export function StatsGrid({ stats, ariaLabel }: { stats: StatCard[]; ariaLabel: string }) {
  return (
    <section className="stats-grid" aria-label={ariaLabel}>
      {stats.map(({ icon: Icon, label, value, note }) => (
        <Card key={label} as="article" className="stat-card">
          <div>
            <Icon size={19} weight="light" />
            <span>{label}</span>
          </div>
          <strong>{value}</strong>
          <p>{note}</p>
        </Card>
      ))}
    </section>
  );
}
