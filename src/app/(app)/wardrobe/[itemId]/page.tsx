import {
  ArrowLeft,
  Check,
  Clock,
  Heart,
  LinkSimple,
  MagicWand,
  PencilSimple,
  ShirtFolded,
  Trash,
} from "@phosphor-icons/react/ssr";
import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { DemoNotice } from "@/components/ui/DemoNotice";
import { GarmentArtwork } from "@/features/wardrobe/components/GarmentArtwork";
import { WardrobeItemDetail } from "@/features/wardrobe/components/WardrobeItemDetail";
import { isSupabaseConfigured } from "@/lib/env/client";
import { previewItems } from "../../preview-data";

export const metadata = { title: "Wardrobe item" };

export default async function WardrobeItemPage({
  params,
}: {
  params: Promise<{ itemId: string }>;
}) {
  const { itemId } = await params;
  if (isSupabaseConfigured()) return <WardrobeItemDetail itemId={itemId} />;
  const item = previewItems.find((candidate) => candidate.id === itemId) ?? previewItems[0];
  if (!item) return null;

  return (
    <div className="item-page">
      <Link className="back-link" href="/wardrobe">
        <ArrowLeft size={15} /> Back to wardrobe
      </Link>
      <DemoNotice>
        This is a sample item detail view for <strong>{itemId}</strong>. Changes and actions are not
        persisted.
      </DemoNotice>
      <div className="item-detail">
        <section className="item-detail__visual" aria-label={`${item.name} sample artwork`}>
          <div className="item-detail__art">
            <GarmentArtwork category={item.category} color={item.color} accent={item.accent} />
            <Badge tone="outline">Sample cutout</Badge>
          </div>
          <div className="item-detail__thumbs">
            <button className="is-active" type="button">
              <GarmentArtwork compact category={item.category} color={item.color} />
              <span>Cutout</span>
            </button>
            <button type="button">
              <ShirtFolded size={25} />
              <span>Original</span>
            </button>
          </div>
        </section>
        <section className="item-detail__content">
          <div className="item-detail__heading">
            <div>
              <p className="eyebrow">{item.categoryLabel}</p>
              <h1>{item.name}</h1>
              <p>Brand not confirmed</p>
            </div>
            <button className="favorite-button" type="button" aria-label="Add to favorites">
              <Heart size={21} />
            </button>
          </div>
          <div className="item-detail__actions">
            <Button>
              <PencilSimple size={16} /> Edit details
            </Button>
            <Button variant="secondary">
              <MagicWand size={16} /> Research item
            </Button>
          </div>
          <dl className="item-facts">
            <div>
              <dt>Primary color</dt>
              <dd>
                <span className="color-dot" style={{ backgroundColor: item.color }} /> Warm stone
              </dd>
            </div>
            <div>
              <dt>Material</dt>
              <dd>
                Cotton <Badge tone="gold">AI inferred</Badge>
              </dd>
            </div>
            <div>
              <dt>Fit</dt>
              <dd>Relaxed</dd>
            </div>
            <div>
              <dt>Formality</dt>
              <dd>3 / 5 · Smart casual</dd>
            </div>
            <div>
              <dt>Season</dt>
              <dd>Spring · Summer · Fall</dd>
            </div>
            <div>
              <dt>Availability</dt>
              <dd>
                <span className="availability-dot" /> Available
              </dd>
            </div>
          </dl>
          <div className="tag-list" aria-label="Item tags">
            <span>office</span>
            <span>smart casual</span>
            <span>breathable</span>
            <span>layerable</span>
          </div>
        </section>
      </div>

      <div className="item-lower-grid">
        <Card as="section" className="research-card">
          <div className="card-title-row">
            <div>
              <p className="eyebrow">Product research</p>
              <h2>Identity not researched</h2>
            </div>
            <Badge tone="neutral">Not started</Badge>
          </div>
          <p>
            Research uses confirmed label text, brand clues, or a model number. Similar appearance
            alone is never treated as proof.
          </p>
          <div className="research-card__clues">
            <span>
              <Check size={14} /> Category confirmed
            </span>
            <span>
              <Clock size={14} /> Add label or SKU for stronger results
            </span>
          </div>
          <Button variant="secondary">
            <MagicWand size={16} /> Start source-backed research
          </Button>
        </Card>
        <Card as="section" className="wear-card">
          <div className="card-title-row">
            <div>
              <p className="eyebrow">Wear history</p>
              <h2>8 wears</h2>
            </div>
            <Badge tone="sage">$6.25 / wear</Badge>
          </div>
          <div className="wear-card__chart" aria-label="Illustrative wear history chart">
            <span style={{ height: "28%" }} />
            <span style={{ height: "45%" }} />
            <span style={{ height: "32%" }} />
            <span style={{ height: "72%" }} />
            <span style={{ height: "52%" }} />
            <span style={{ height: "86%" }} />
          </div>
          <p>Last worn 12 days ago · Sample calculation</p>
          <Button variant="secondary">
            <Check size={16} /> Mark worn today
          </Button>
        </Card>
      </div>

      <Card as="section" className="item-history">
        <div className="card-title-row">
          <div>
            <p className="eyebrow">Outfit history</p>
            <h2>Looks with this piece</h2>
          </div>
          <Link href="/outfits">View all</Link>
        </div>
        <div className="item-history__empty">
          <LinkSimple size={25} weight="light" />
          <div>
            <strong>No saved outfit history yet</strong>
            <p>Once this piece appears in a saved or worn look, it will show here.</p>
          </div>
        </div>
      </Card>
      <div className="item-danger">
        <div>
          <h2>Archive or delete</h2>
          <p>Archived pieces stay in history but are excluded from new recommendations.</p>
        </div>
        <div>
          <Button variant="ghost">Archive</Button>
          <Button variant="danger">
            <Trash size={15} /> Delete piece
          </Button>
        </div>
      </div>
    </div>
  );
}
