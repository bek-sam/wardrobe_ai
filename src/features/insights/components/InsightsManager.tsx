"use client";

import {
  ArrowRight,
  ChartBar,
  CoatHanger,
  CurrencyDollar,
  Recycle,
  Sparkle,
  SpinnerGap,
  Swatches,
  TrendUp,
  WarningCircle,
} from "@phosphor-icons/react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { Badge, PreviewBadge } from "@/components/ui/Badge";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { DemoNotice } from "@/components/ui/DemoNotice";
import { PageHeader, SectionHeader } from "@/components/ui/PageHeader";
import {
  GarmentArtwork,
  type GarmentCategory,
} from "@/features/wardrobe/components/GarmentArtwork";
import type { WardrobePreviewItem } from "@/features/wardrobe/components/wardrobe-item-card.types";

type ApiEnvelope<T> = { data: T } | { error: { message?: string } };
type Count = { name: string; count: number };
type InsightItem = {
  id: string;
  name: string;
  category: string;
  subcategory: string | null;
  layer_role: GarmentCategory | null;
  color_names: string[];
  season_tags: string[];
  wear_count: number;
  last_worn_at: string | null;
  purchase_price: number | null;
  currency: string | null;
};
type Insights = {
  itemCount: number;
  categories: Count[];
  colors: Count[];
  seasonalWear: Count[];
  mostWorn: InsightItem[];
  leastWorn: InsightItem[];
  neverWorn: InsightItem[];
  costPerWear: Array<{ itemId: string; name: string; value: number; currency: string | null }>;
  possibleFoundations: number;
  gapSuggestions: Array<{ role: string; note: string }>;
  overrepresented: Array<{ name: string; count: number; note: string }>;
};

const namedColors: Record<string, string> = {
  black: "#292724",
  blue: "#45617d",
  brown: "#79583d",
  camel: "#9c7250",
  cream: "#eee8da",
  ecru: "#d8d0bf",
  forest: "#455746",
  gray: "#777774",
  green: "#55705b",
  grey: "#777774",
  navy: "#293647",
  orange: "#ba683e",
  pink: "#b9858f",
  purple: "#766080",
  red: "#9b443d",
  rust: "#8c493d",
  stone: "#ddd4c2",
  tan: "#b3946d",
  white: "#f4f0e8",
  yellow: "#c99a3f",
};

function errorMessage(payload: unknown, fallback: string) {
  if (payload && typeof payload === "object" && "error" in payload) {
    const error = (payload as { error?: { message?: unknown } }).error;
    if (typeof error?.message === "string" && error.message.trim()) return error.message;
  }
  return fallback;
}

async function loadInsights(signal: AbortSignal): Promise<Insights> {
  const response = await fetch("/api/insights", { signal });
  const payload = (await response.json().catch(() => null)) as ApiEnvelope<Insights> | null;
  if (!response.ok || !payload || !("data" in payload)) {
    throw new Error(errorMessage(payload, "Wardrobe insights could not be loaded."));
  }
  return payload.data;
}

function colorValue(name: string) {
  const normalized = name.trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/i.test(normalized)) return normalized;
  if (namedColors[normalized]) return namedColors[normalized];
  let hash = 0;
  for (const character of normalized) hash = (hash * 31 + character.charCodeAt(0)) % 360;
  return `hsl(${hash} 24% 42%)`;
}

function artworkCategory(item: InsightItem): GarmentCategory {
  if (item.layer_role) return item.layer_role;
  const category = item.category.toLowerCase();
  if (category.includes("bottom") || category.includes("pant") || category.includes("skirt")) {
    return "bottom";
  }
  if (category.includes("dress")) return "dress";
  if (category.includes("outer") || category.includes("layer") || category.includes("jacket")) {
    return "layer";
  }
  if (category.includes("shoe")) return "shoes";
  if (category.includes("access") || category.includes("bag")) return "accessory";
  return "top";
}

function titleCase(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function wearNote(item: InsightItem) {
  if (item.wear_count === 0) return "No recorded wears yet";
  if (!item.last_worn_at)
    return `${item.wear_count} recorded ${item.wear_count === 1 ? "wear" : "wears"}`;
  return `Last worn ${new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(item.last_worn_at))}`;
}

function PreviewInsights({ items }: { items: WardrobePreviewItem[] }) {
  const stats = [
    { icon: CoatHanger, label: "Sample pieces", value: "8", note: "5 categories" },
    { icon: TrendUp, label: "Sample wears", value: "60", note: "+8 this month" },
    { icon: CurrencyDollar, label: "Avg. cost / wear", value: "$7.40", note: "Sample value" },
    { icon: Recycle, label: "Under-worn", value: "2", note: "Fewer than 4 wears" },
  ];
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
      <section className="stats-grid" aria-label="Sample wardrobe statistics">
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
      <div className="insight-grid">
        <Card as="section" className="category-chart-card">
          <div className="card-title-row">
            <div>
              <p className="eyebrow">Closet balance</p>
              <h2>Category distribution</h2>
            </div>
            <ChartBar size={21} />
          </div>
          <div className="category-bars" aria-label="Sample category distribution bar chart">
            {[
              ["Tops", 82, "28%"],
              ["Bottoms", 55, "19%"],
              ["Layers", 46, "16%"],
              ["Shoes", 64, "22%"],
              ["Accessories", 42, "15%"],
            ].map(([name, width, percent]) => (
              <div key={name}>
                <span>{name}</span>
                <div>
                  <i style={{ width: `${width}%` }} />
                </div>
                <strong>{percent}</strong>
              </div>
            ))}
          </div>
          <p className="chart-caption">Sample percentages normalized for the preview wardrobe.</p>
        </Card>
        <Card as="section" className="palette-card">
          <div className="card-title-row">
            <div>
              <p className="eyebrow">Color story</p>
              <h2>Your palette</h2>
            </div>
            <Swatches size={21} />
          </div>
          <div className="palette-orbit" aria-label="Sample wardrobe color palette">
            {["Navy", "Stone", "Forest", "Camel", "Rust"].map((color) => (
              <span key={color} style={{ background: colorValue(color) }}>
                {color}
              </span>
            ))}
          </div>
          <p>This sample palette demonstrates how saved color metadata will be summarized.</p>
        </Card>
      </div>
      <section>
        <SectionHeader
          title="Pieces to rediscover"
          description="Sample low-wear pieces."
          action={<Badge tone="outline">Sample items</Badge>}
        />
        <div className="rediscover-list">
          {items.slice(4, 7).map((item) => (
            <article key={item.id}>
              <GarmentArtwork compact category={item.category} color={item.color} />
              <div>
                <span>{item.categoryLabel}</span>
                <h3>{item.name}</h3>
                <p>{item.meta}</p>
              </div>
              <Link href={`/wardrobe/${item.id}`}>
                View <ArrowRight size={14} />
              </Link>
            </article>
          ))}
        </div>
      </section>
      <Card as="section" className="gap-card">
        <span className="gap-card__icon">
          <Sparkle size={25} weight="light" />
        </span>
        <div>
          <p className="eyebrow">Conservative gap analysis</p>
          <h2>A rain-ready casual shoe may add useful range.</h2>
          <p>This is an illustrative preview, not a recommendation based on your data.</p>
        </div>
        <Button disabled variant="secondary">
          See the reasoning
        </Button>
      </Card>
    </>
  );
}

export function InsightsManager({
  configured,
  previewItems,
}: {
  configured: boolean;
  previewItems: WardrobePreviewItem[];
}) {
  const [insights, setInsights] = useState<Insights | null>(null);
  const [loading, setLoading] = useState(configured);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (!configured) return;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      setLoading(true);
      setError(null);
      loadInsights(controller.signal)
        .then(setInsights)
        .catch((caught) => {
          if (caught instanceof DOMException && caught.name === "AbortError") return;
          setError(
            caught instanceof Error ? caught.message : "Wardrobe insights could not be loaded.",
          );
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 0);
    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [configured, retry]);

  const costSummary = useMemo(() => {
    if (!insights?.costPerWear.length) return null;
    const currency = insights.costPerWear[0]?.currency;
    if (!currency || insights.costPerWear.some((entry) => entry.currency !== currency)) return null;
    const average =
      insights.costPerWear.reduce((sum, entry) => sum + entry.value, 0) /
      insights.costPerWear.length;
    try {
      return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(average);
    } catch {
      return `${average.toFixed(2)} ${currency}`;
    }
  }, [insights]);

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
      {error ? (
        <div className="inline-feedback inline-feedback--error" role="alert">
          <WarningCircle size={17} />
          <span>{error}</span>
          <Button onClick={() => setRetry((value) => value + 1)} variant="ghost">
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
      {!loading && insights?.itemCount === 0 ? (
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
      ) : null}
      {!loading && insights && insights.itemCount > 0 ? (
        <>
          <section className="stats-grid" aria-label="Wardrobe statistics">
            {[
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
            ].map(({ icon: Icon, label, value, note }) => (
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
          <div className="insight-grid">
            <Card as="section" className="category-chart-card">
              <div className="card-title-row">
                <div>
                  <p className="eyebrow">Closet balance</p>
                  <h2>Category distribution</h2>
                </div>
                <ChartBar size={21} />
              </div>
              <div className="category-bars" aria-label="Category distribution bar chart">
                {insights.categories.map((category) => {
                  const percentage = Math.round((category.count / insights.itemCount) * 100);
                  return (
                    <div key={category.name}>
                      <span>{titleCase(category.name)}</span>
                      <div>
                        <i style={{ width: `${Math.max(4, percentage)}%` }} />
                      </div>
                      <strong>{percentage}%</strong>
                    </div>
                  );
                })}
              </div>
              <p className="chart-caption">
                Calculated from {insights.itemCount} active wardrobe{" "}
                {insights.itemCount === 1 ? "piece" : "pieces"}.
              </p>
            </Card>
            <Card as="section" className="palette-card">
              <div className="card-title-row">
                <div>
                  <p className="eyebrow">Color story</p>
                  <h2>Your palette</h2>
                </div>
                <Swatches size={21} />
              </div>
              {insights.colors.length ? (
                <>
                  <div className="palette-orbit" aria-label="Wardrobe color palette">
                    {insights.colors.slice(0, 5).map((color) => (
                      <span key={color.name} style={{ background: colorValue(color.name) }}>
                        {color.name}
                      </span>
                    ))}
                  </div>
                  <p>
                    Your most-recorded colors are{" "}
                    {insights.colors
                      .slice(0, 3)
                      .map((color) => color.name)
                      .join(", ")}
                    .
                  </p>
                </>
              ) : (
                <p>Add color names to wardrobe pieces to build your palette.</p>
              )}
            </Card>
          </div>
          <section>
            <SectionHeader
              title="Pieces to rediscover"
              description="A gentle nudge toward your lowest-wear pieces."
              action={<Badge tone="outline">Wear history</Badge>}
            />
            <div className="rediscover-list">
              {insights.leastWorn.slice(0, 3).map((item) => (
                <article key={item.id}>
                  <GarmentArtwork
                    compact
                    category={artworkCategory(item)}
                    color={colorValue(item.color_names[0] ?? "stone")}
                  />
                  <div>
                    <span>{titleCase(item.category)}</span>
                    <h3>{item.name}</h3>
                    <p>{wearNote(item)}</p>
                  </div>
                  <Link href={`/wardrobe/${item.id}`}>
                    View <ArrowRight size={14} />
                  </Link>
                </article>
              ))}
            </div>
          </section>
          <Card as="section" className="gap-card">
            <span className="gap-card__icon">
              <Sparkle size={25} weight="light" />
            </span>
            <div>
              <p className="eyebrow">Conservative gap analysis</p>
              <h2>
                {insights.gapSuggestions[0]
                  ? `No ${titleCase(insights.gapSuggestions[0].role)} is recorded.`
                  : insights.overrepresented[0]
                    ? `${titleCase(insights.overrepresented[0].name)} is strongly represented.`
                    : "No obvious foundation gap yet."}
              </h2>
              <p>
                {insights.gapSuggestions[0]?.note ??
                  insights.overrepresented[0]?.note ??
                  "Keep recording wears before making purchase or cleanup decisions."}
              </p>
            </div>
            <ButtonLink href="/wardrobe" variant="secondary">
              Review wardrobe
            </ButtonLink>
          </Card>
        </>
      ) : null}
    </>
  );
}
