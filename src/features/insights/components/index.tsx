"use client";

import { ChartBar } from "@phosphor-icons/react";
import { Card } from "@/components/ui";
import type { ReactNode } from "react";
import { Sparkle } from "@phosphor-icons/react";
import { Swatches } from "@phosphor-icons/react";
import { colorValue } from "./insights-model";
import { ArrowRight } from "@phosphor-icons/react";
import Link from "next/link";
import { GarmentArtwork } from "@/components/garments/GarmentArtwork";
import { SectionHeader } from "@/components/ui";
import type { RediscoverEntry, StatCard } from "./insights-model";
import { Button } from "@/components/ui";
import { PageHeader } from "@/components/ui";
import type { GarmentPreviewItem } from "@/components/garments/GarmentArtwork";
import { useInsights } from "./insights-model";
import { ButtonLink } from "@/components/ui";
import { Badge } from "@/components/ui";
import { buildCategoryBars, buildRediscoverEntries } from "./insights-model";
import type { Insights } from "./insights-model";
import { titleCase } from "./insights-model";
import { SpinnerGap, WarningCircle } from "@phosphor-icons/react";
import { CoatHanger, CurrencyDollar, Recycle, TrendUp } from "@phosphor-icons/react";
import { buildPreviewRediscoverEntries, PREVIEW_STATS } from "./insights-model";
import { PREVIEW_CATEGORY_BARS, PREVIEW_PALETTE } from "./insights-model";
import { PreviewBadge } from "@/components/ui";
import { DemoNotice } from "@/components/ui";

export function CategoryChart({
  bars,
  caption,
  ariaLabel,
}: {
  bars: Array<{ name: string; percent: number }>;
  caption: string;
  ariaLabel: string;
}) {
  return (
    <Card as="section" className="category-chart-card">
      <div className="card-title-row">
        <div>
          <p className="eyebrow">Closet balance</p>
          <h2>Category distribution</h2>
        </div>
        <ChartBar size={21} />
      </div>
      <div className="category-bars" aria-label={ariaLabel}>
        {bars.map((bar) => (
          <div key={bar.name}>
            <span>{bar.name}</span>
            <div>
              <i style={{ width: `${Math.max(4, bar.percent)}%` }} />
            </div>
            <strong>{bar.percent}%</strong>
          </div>
        ))}
      </div>
      <p className="chart-caption">{caption}</p>
    </Card>
  );
}

export function GapAnalysisCard({
  heading,
  description,
  action,
}: {
  heading: ReactNode;
  description: ReactNode;
  action: ReactNode;
}) {
  return (
    <Card as="section" className="gap-card">
      <span className="gap-card__icon">
        <Sparkle size={25} weight="light" />
      </span>
      <div>
        <p className="eyebrow">Conservative gap analysis</p>
        <h2>{heading}</h2>
        <p>{description}</p>
      </div>
      {action}
    </Card>
  );
}

export function PaletteCard({
  colors,
  ariaLabel,
  description,
}: {
  colors: string[];
  ariaLabel: string;
  description: ReactNode;
}) {
  return (
    <Card as="section" className="palette-card">
      <div className="card-title-row">
        <div>
          <p className="eyebrow">Color story</p>
          <h2>Your palette</h2>
        </div>
        <Swatches size={21} />
      </div>
      {colors.length ? (
        <div className="palette-orbit" aria-label={ariaLabel}>
          {colors.map((color) => (
            <span key={color} style={{ background: colorValue(color) }}>
              {color}
            </span>
          ))}
        </div>
      ) : null}
      {description}
    </Card>
  );
}

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

function buildInsightsStats(insights: Insights, costSummary: string | null): StatCard[] {
  return [
    {
      icon: CoatHanger,
      label: "Active pieces",
      value: insights.itemCount.toString(),
      note: `${insights.categories.length} ${insights.categories.length === 1 ? "category" : "categories"}`,
    },
    {
      icon: TrendUp,
      label: "Outfit foundations",
      value: insights.possibleFoundations.toString(),
      note: "Top and bottom combinations",
    },
    {
      icon: CurrencyDollar,
      label: "Avg. cost / wear",
      value: costSummary ?? "—",
      note: costSummary
        ? `${insights.costPerWear.length} priced pieces with wears`
        : "Add price and wear data",
    },
    {
      icon: Recycle,
      label: "Never worn",
      value: insights.neverWorn.length.toString(),
      note: "Based on recorded wear history",
    },
  ];
}

function InsightsStatus({
  error,
  loading,
  onRetry,
}: {
  error: string | null;
  loading: boolean;
  onRetry: () => void;
}) {
  return (
    <>
      {error ? (
        <div className="inline-feedback inline-feedback--error" role="alert">
          <WarningCircle size={17} />
          <span>{error}</span>
          <Button onClick={onRetry} variant="ghost">
            Try again
          </Button>
        </div>
      ) : null}
      {loading ? (
        <div className="inline-feedback" role="status">
          <SpinnerGap className="spin" size={17} />
          <span>Calculating wardrobe insights…</span>
        </div>
      ) : null}
    </>
  );
}

function InsightsGapCard({ insights }: { insights: Insights }) {
  const gap = insights.gapSuggestions[0];
  const over = insights.overrepresented[0];
  return (
    <GapAnalysisCard
      action={
        <ButtonLink href="/wardrobe" variant="secondary">
          Review wardrobe
        </ButtonLink>
      }
      description={
        gap?.note ??
        over?.note ??
        "Keep recording wears before making purchase or cleanup decisions."
      }
      heading={
        gap
          ? `No ${titleCase(gap.role)} is recorded.`
          : over
            ? `${titleCase(over.name)} is strongly represented.`
            : "No obvious foundation gap yet."
      }
    />
  );
}

function PaletteDescription({ insights }: { insights: Insights }) {
  if (!insights.colors.length) {
    return <p>Add color names to wardrobe pieces to build your palette.</p>;
  }
  return (
    <p>
      Your most-recorded colors are{" "}
      {insights.colors
        .slice(0, 3)
        .map((color) => color.name)
        .join(", ")}
      .
    </p>
  );
}

function InsightsBody({
  insights,
  costSummary,
}: {
  insights: Insights;
  costSummary: string | null;
}) {
  return (
    <>
      <StatsGrid
        ariaLabel="Wardrobe statistics"
        stats={buildInsightsStats(insights, costSummary)}
      />
      <div className="insight-grid">
        <CategoryChart
          ariaLabel="Category distribution"
          bars={buildCategoryBars(insights)}
          caption={`Calculated from ${insights.itemCount} active wardrobe ${insights.itemCount === 1 ? "piece" : "pieces"}.`}
        />
        <PaletteCard
          ariaLabel="Wardrobe color palette"
          colors={insights.colors.slice(0, 5).map((color) => color.name)}
          description={<PaletteDescription insights={insights} />}
        />
      </div>
      <RediscoverList
        actionBadge={<Badge tone="outline">Wear history</Badge>}
        description="A gentle nudge toward your lowest-wear pieces."
        items={buildRediscoverEntries(insights.leastWorn.slice(0, 3))}
        title="Pieces to rediscover"
      />
      <InsightsGapCard insights={insights} />
    </>
  );
}

function InsightsEmptyState() {
  return (
    <section className="empty-state">
      <span className="empty-state__icon">
        <ChartBar size={25} />
      </span>
      <h2>Insights begin with your wardrobe</h2>
      <p>
        Add a few pieces and record wears to unlock category, palette, usage, and cost-per-wear
        summaries.
      </p>
      <div className="empty-state__action">
        <ButtonLink href="/wardrobe">Add wardrobe pieces</ButtonLink>
      </div>
    </section>
  );
}

export function InsightsManager({
  configured,
  previewItems,
}: {
  configured: boolean;
  previewItems: GarmentPreviewItem[];
}) {
  const { insights, loading, error, setRetry, costSummary } = useInsights(configured);

  if (!configured) return <PreviewInsights items={previewItems} />;

  return (
    <>
      <PageHeader
        eyebrow="Wardrobe intelligence"
        title="Insights"
        description="See what earns its place, what gets overlooked, and where your wardrobe has room to improve."
        actions={
          <Button disabled title="Date-range filtering is coming soon" variant="secondary">
            All recorded history
          </Button>
        }
      />
      <InsightsStatus
        error={error}
        loading={loading}
        onRetry={() => setRetry((value) => value + 1)}
      />
      {!loading && insights?.itemCount === 0 ? <InsightsEmptyState /> : null}
      {!loading && insights && insights.itemCount > 0 ? (
        <InsightsBody costSummary={costSummary} insights={insights} />
      ) : null}
    </>
  );
}

function PreviewInsightsHeader() {
  return (
    <>
      <PageHeader
        eyebrow="Wardrobe intelligence"
        title="Insights"
        description="See what earns its place, what gets overlooked, and where your wardrobe has room to improve."
        meta={<PreviewBadge />}
        actions={
          <Button disabled variant="secondary">
            Last 12 months
          </Button>
        }
      />
      <DemoNotice>
        Preview mode: every metric below is illustrative. Configure Supabase to calculate insights
        from your wardrobe and wear history.
      </DemoNotice>
    </>
  );
}

function PreviewInsightGrid() {
  return (
    <div className="insight-grid">
      <CategoryChart
        ariaLabel="Sample category distribution bar chart"
        bars={PREVIEW_CATEGORY_BARS}
        caption="Sample percentages normalized for the preview wardrobe."
      />
      <PaletteCard
        ariaLabel="Sample wardrobe color palette"
        colors={PREVIEW_PALETTE}
        description={
          <p>This sample palette demonstrates how saved color metadata will be summarized.</p>
        }
      />
    </div>
  );
}

export function PreviewInsights({ items }: { items: GarmentPreviewItem[] }) {
  return (
    <>
      <PreviewInsightsHeader />
      <StatsGrid ariaLabel="Sample wardrobe statistics" stats={PREVIEW_STATS} />
      <PreviewInsightGrid />
      <RediscoverList
        actionBadge={<Badge tone="outline">Sample items</Badge>}
        description="Sample low-wear pieces."
        items={buildPreviewRediscoverEntries(items)}
        title="Pieces to rediscover"
      />
      <GapAnalysisCard
        action={
          <Button disabled variant="secondary">
            See the reasoning
          </Button>
        }
        description="This is an illustrative preview, not a recommendation based on your data."
        heading="A rain-ready casual shoe may add useful range."
      />
    </>
  );
}
