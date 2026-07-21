"use client";

import {
  ArrowLeft,
  Check,
  Heart,
  MagicWand,
  PencilSimple,
  SpinnerGap,
  Trash,
  WarningCircle,
} from "@phosphor-icons/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import type { AvailabilityStatus, WardrobeItem } from "@/features/wardrobe/types";

type ItemImage = {
  id: string;
  kind: string;
  signed_url: string;
  is_primary: boolean;
  width: number;
  height: number;
};

type ItemDetail = WardrobeItem & {
  images: ItemImage[];
  primary_image_url: string | null;
};

type ResearchSource = {
  id: string;
  title: string;
  url: string;
  domain: string;
  source_type: string;
};
type ResearchRun = {
  id: string;
  status: string;
  summary: string;
  confidence: number | null;
  proposed_changes: Record<string, unknown>;
  evidence: Record<string, unknown>;
  research_sources: ResearchSource[];
};

type Envelope<T> = { data: T } | { error: { message?: string } };

function responseError(payload: unknown, fallback: string) {
  if (payload && typeof payload === "object" && "error" in payload) {
    const error = (payload as { error?: { message?: unknown } }).error;
    if (typeof error?.message === "string") return error.message;
  }
  return fallback;
}

async function requestJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    ...init,
    headers: { ...(init?.body ? { "Content-Type": "application/json" } : {}), ...init?.headers },
  });
  const payload = (await response.json().catch(() => null)) as Envelope<T> | null;
  if (!response.ok || !payload || !("data" in payload)) {
    throw new Error(responseError(payload, `The request failed (${response.status}).`));
  }
  return payload.data;
}

const availabilityLabels: Record<AvailabilityStatus, string> = {
  available: "Available",
  laundry: "In laundry",
  packed: "Packed",
  loaned: "Loaned out",
  repair: "Needs repair",
};

const acceptableResearchFields = new Set([
  "brand",
  "product_name",
  "model_number",
  "materials",
  "care_instructions",
]);

export function WardrobeItemDetail({ itemId }: { itemId: string }) {
  const router = useRouter();
  const [item, setItem] = useState<ItemDetail | null>(null);
  const [research, setResearch] = useState<ResearchRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [researchClue, setResearchClue] = useState("");
  const [editing, setEditing] = useState(false);
  const [editValues, setEditValues] = useState({ name: "", brand: "", category: "", notes: "" });

  const load = useCallback(async () => {
    try {
      const [nextItem, runs] = await Promise.all([
        requestJson<ItemDetail>(`/api/items/${encodeURIComponent(itemId)}`),
        requestJson<ResearchRun[]>(`/api/items/${encodeURIComponent(itemId)}/research`),
      ]);
      setItem(nextItem);
      setResearch(runs);
      setEditValues({
        name: nextItem.name,
        brand: nextItem.brand ?? "",
        category: nextItem.category,
        notes: nextItem.notes,
      });
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "This wardrobe item could not be loaded.",
      );
    } finally {
      setLoading(false);
    }
  }, [itemId]);

  useEffect(() => {
    const timeout = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timeout);
  }, [load]);

  const latestResearch = research[0] ?? null;
  const researchFields = useMemo(
    () =>
      latestResearch
        ? Object.keys(latestResearch.proposed_changes).filter((field) =>
            acceptableResearchFields.has(field),
          )
        : [],
    [latestResearch],
  );

  async function action(name: string, operation: () => Promise<void>) {
    setBusy(name);
    setError(null);
    try {
      await operation();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The action could not be completed.");
    } finally {
      setBusy(null);
    }
  }

  if (loading) {
    return (
      <div className="page-stack" aria-busy="true">
        <Link className="back-link" href="/wardrobe">
          <ArrowLeft size={15} /> Back to wardrobe
        </Link>
        <Card>
          <SpinnerGap className="spin" size={20} /> Loading private item…
        </Card>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="page-stack">
        <Link className="back-link" href="/wardrobe">
          <ArrowLeft size={15} /> Back to wardrobe
        </Link>
        <Card>
          <WarningCircle size={20} />
          <h1>Item unavailable</h1>
          <p>{error ?? "This item was not found in your wardrobe."}</p>
          <Button onClick={() => void load()} variant="secondary">
            Try again
          </Button>
        </Card>
      </div>
    );
  }

  const costPerWear =
    item.purchase_price !== null && item.wear_count > 0
      ? `${item.currency ?? ""} ${(item.purchase_price / item.wear_count).toFixed(2)}`.trim()
      : null;

  return (
    <div className="item-page">
      <Link className="back-link" href="/wardrobe">
        <ArrowLeft size={15} /> Back to wardrobe
      </Link>
      {error ? (
        <div className="inline-feedback inline-feedback--error" role="alert">
          <WarningCircle size={16} /> {error}
        </div>
      ) : null}
      <div className="item-detail">
        <section className="item-detail__visual" aria-label={`${item.name} private images`}>
          <div className="item-detail__art">
            {item.primary_image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img alt={item.name} src={item.primary_image_url} />
            ) : (
              <div className="item-detail__image-empty">No image yet</div>
            )}
            <Badge tone="outline">Private image</Badge>
          </div>
          {item.images.length > 1 ? (
            <div className="item-detail__thumbs">
              {item.images.map((image) => (
                <a href={image.signed_url} key={image.id} target="_blank" rel="noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img alt={`${item.name} ${image.kind}`} src={image.signed_url} />
                  <span>{image.kind}</span>
                </a>
              ))}
            </div>
          ) : null}
        </section>
        <section className="item-detail__content">
          <div className="item-detail__heading">
            <div>
              <p className="eyebrow">{item.category}</p>
              <h1>{item.name}</h1>
              <p>{item.brand ?? "Brand not confirmed"}</p>
            </div>
            <button
              aria-label={item.favorite ? "Remove from favorites" : "Add to favorites"}
              aria-pressed={item.favorite}
              className="favorite-button"
              onClick={() =>
                void action("favorite", async () => {
                  const result = await requestJson<{ favorite: boolean }>(
                    `/api/items/${item.id}/favorite`,
                    { method: "POST", body: JSON.stringify({ favorite: !item.favorite }) },
                  );
                  setItem((current) =>
                    current ? { ...current, favorite: result.favorite } : current,
                  );
                })
              }
              type="button"
            >
              <Heart size={21} weight={item.favorite ? "fill" : "regular"} />
            </button>
          </div>
          <div className="item-detail__actions">
            <Button onClick={() => setEditing((value) => !value)}>
              <PencilSimple size={16} /> Edit details
            </Button>
            <Button
              onClick={() =>
                document.getElementById("item-research")?.scrollIntoView({ behavior: "smooth" })
              }
              variant="secondary"
            >
              <MagicWand size={16} /> Research item
            </Button>
          </div>
          {editing ? (
            <form
              className="form-grid"
              onSubmit={(event) => {
                event.preventDefault();
                void action("edit", async () => {
                  const saved = await requestJson<WardrobeItem>(`/api/items/${item.id}`, {
                    method: "PATCH",
                    body: JSON.stringify({
                      name: editValues.name,
                      brand: editValues.brand || null,
                      category: editValues.category,
                      notes: editValues.notes,
                    }),
                  });
                  setItem((current) => (current ? { ...current, ...saved } : current));
                  setEditing(false);
                });
              }}
            >
              <input
                aria-label="Item name"
                required
                value={editValues.name}
                onChange={(event) =>
                  setEditValues((value) => ({ ...value, name: event.target.value }))
                }
              />
              <input
                aria-label="Brand"
                placeholder="Brand (optional)"
                value={editValues.brand}
                onChange={(event) =>
                  setEditValues((value) => ({ ...value, brand: event.target.value }))
                }
              />
              <input
                aria-label="Category"
                required
                value={editValues.category}
                onChange={(event) =>
                  setEditValues((value) => ({ ...value, category: event.target.value }))
                }
              />
              <textarea
                aria-label="Notes"
                value={editValues.notes}
                onChange={(event) =>
                  setEditValues((value) => ({ ...value, notes: event.target.value }))
                }
              />
              <Button disabled={busy === "edit"} type="submit">
                Save details
              </Button>
            </form>
          ) : null}
          <dl className="item-facts">
            <div>
              <dt>Colors</dt>
              <dd>{item.color_names.join(" · ") || "Not recorded"}</dd>
            </div>
            <div>
              <dt>Material</dt>
              <dd>
                {Object.keys(item.materials).length
                  ? JSON.stringify(item.materials)
                  : "Not recorded"}
              </dd>
            </div>
            <div>
              <dt>Fit</dt>
              <dd>{item.fit ?? "Not recorded"}</dd>
            </div>
            <div>
              <dt>Formality</dt>
              <dd>{item.formality_level ? `${item.formality_level} / 5` : "Not recorded"}</dd>
            </div>
            <div>
              <dt>Season</dt>
              <dd>{item.season_tags.join(" · ") || "Not recorded"}</dd>
            </div>
            <div>
              <dt>Availability</dt>
              <dd>
                <select
                  aria-label="Availability"
                  value={item.availability_status}
                  onChange={(event) =>
                    void action("availability", async () => {
                      const result = await requestJson<{ availability_status: AvailabilityStatus }>(
                        `/api/items/${item.id}/availability`,
                        {
                          method: "POST",
                          body: JSON.stringify({ availability_status: event.target.value }),
                        },
                      );
                      setItem((current) =>
                        current
                          ? { ...current, availability_status: result.availability_status }
                          : current,
                      );
                    })
                  }
                >
                  {Object.entries(availabilityLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </dd>
            </div>
          </dl>
        </section>
      </div>

      <div className="item-lower-grid">
        <Card as="section" className="research-card" id="item-research">
          <div className="card-title-row">
            <div>
              <p className="eyebrow">Product research</p>
              <h2>{latestResearch?.summary || "Identity not researched"}</h2>
            </div>
            <Badge tone={latestResearch?.status === "verified" ? "sage" : "neutral"}>
              {latestResearch?.status ?? "Not started"}
            </Badge>
          </div>
          <p>
            Research uses confirmed labels, SKU/barcode, brand clues, and source evidence. Similar
            appearance alone is never proof.
          </p>
          <label className="form-field">
            <span>Optional clue</span>
            <input
              value={researchClue}
              onChange={(event) => setResearchClue(event.target.value)}
              placeholder="Label text, SKU, model, or product clue"
            />
          </label>
          <Button
            disabled={busy === "research"}
            onClick={() =>
              void action("research", async () => {
                const run = await requestJson<ResearchRun>(`/api/items/${item.id}/research`, {
                  method: "POST",
                  body: JSON.stringify({ userClue: researchClue || null }),
                });
                await requestJson(`/api/items/${item.id}/research/${run.id}/process`, {
                  method: "POST",
                });
                await load();
              })
            }
            variant="secondary"
          >
            {busy === "research" ? (
              <SpinnerGap className="spin" size={16} />
            ) : (
              <MagicWand size={16} />
            )}{" "}
            Start source-backed research
          </Button>
          {latestResearch?.research_sources?.length ? (
            <ul className="research-source-list">
              {latestResearch.research_sources.map((source) => (
                <li key={source.id}>
                  <a href={source.url} target="_blank" rel="noreferrer">
                    {source.title || source.domain}
                  </a>{" "}
                  <small>{source.source_type}</small>
                </li>
              ))}
            </ul>
          ) : null}
          {latestResearch && ["verified", "likely", "uncertain"].includes(latestResearch.status) ? (
            <div className="item-detail__actions">
              <Button
                disabled={!researchFields.length || busy === "accept-research"}
                onClick={() =>
                  void action("accept-research", async () => {
                    await requestJson(
                      `/api/items/${item.id}/research/${latestResearch.id}/accept`,
                      { method: "POST", body: JSON.stringify({ fields: researchFields }) },
                    );
                    await load();
                  })
                }
              >
                <Check size={15} /> Accept supported fields
              </Button>
              <Button
                variant="ghost"
                onClick={() =>
                  void action("reject-research", async () => {
                    await requestJson(
                      `/api/items/${item.id}/research/${latestResearch.id}/reject`,
                      { method: "POST" },
                    );
                    await load();
                  })
                }
              >
                Reject proposal
              </Button>
            </div>
          ) : null}
        </Card>
        <Card as="section" className="wear-card">
          <div className="card-title-row">
            <div>
              <p className="eyebrow">Wear history</p>
              <h2>{item.wear_count} wears</h2>
            </div>
            {costPerWear ? <Badge tone="sage">{costPerWear} / wear</Badge> : null}
          </div>
          <p>
            {item.last_worn_at
              ? `Last worn ${new Date(item.last_worn_at).toLocaleDateString()}`
              : "No wear logged yet"}
          </p>
          <Button
            disabled={busy === "wear"}
            onClick={() =>
              void action("wear", async () => {
                await requestJson(`/api/items/${item.id}/mark-worn`, {
                  method: "POST",
                  body: "{}",
                });
                await load();
              })
            }
          >
            <Check size={16} /> Mark worn today
          </Button>
        </Card>
      </div>

      <div className="item-danger">
        <div>
          <h2>Archive or delete</h2>
          <p>Archived pieces remain in history but are excluded from recommendations.</p>
        </div>
        <div>
          <Button
            variant="ghost"
            onClick={() =>
              void action("archive", async () => {
                await requestJson(`/api/items/${item.id}`, {
                  method: "PATCH",
                  body: JSON.stringify({ status: "archived" }),
                });
                router.push("/wardrobe");
              })
            }
          >
            Archive
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              if (!window.confirm(`Permanently delete ${item.name} and its images?`)) return;
              void action("delete", async () => {
                await requestJson(`/api/items/${item.id}`, { method: "DELETE" });
                router.push("/wardrobe");
              });
            }}
          >
            <Trash size={15} /> Delete piece
          </Button>
        </div>
      </div>
    </div>
  );
}
