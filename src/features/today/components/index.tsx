"use client";

import Image from "next/image";
import { GarmentArtwork } from "@/components/garments/GarmentArtwork";
import type { OutfitItemRole } from "@/features/outfits";
import { artworkCategory } from "./today-model";
import type { TodayItem } from "./today-model";
import { ArrowRight } from "@phosphor-icons/react";
import { ButtonLink } from "@/components/ui";
import { SectionHeader } from "@/components/ui";
import Link from "next/link";
import { resolveWardrobeItemRole } from "@/features/wardrobe";
import { readableToken } from "./today-model";
import { CalendarBlank } from "@phosphor-icons/react";
import { Card } from "@/components/ui";
import type { TodayContextFormProps } from "./today-model";
import { quickOccasions } from "./today-model";
import { Heart, Sparkle, SpinnerGap } from "@phosphor-icons/react";
import { Button } from "@/components/ui";
import { Check } from "@phosphor-icons/react";
import { weatherReasons } from "./today-model";
import type { TodayLookDetailsProps } from "./today-model";
import type { TodayRecommendation, WeatherView } from "./today-model";
import { CloudRain, WarningCircle } from "@phosphor-icons/react";
import { previewLabel } from "./today-model";
import type { TodayPreviewInfo } from "./today-model";
import { Badge } from "@/components/ui";
import { MapPin, ThermometerSimple, Wind } from "@phosphor-icons/react";
import { temperature, weatherHeadline } from "./today-model";
import type { TodayProfile } from "./today-model";
import { greeting } from "./today-model";
import { useTodayWorkspaceState } from "./today-model";
import { PageHeader } from "@/components/ui";

export function ItemVisual({
  item,
  role,
  compact = false,
}: {
  item: TodayItem;
  role: OutfitItemRole | null;
  compact?: boolean;
}) {
  if (item.primaryImageUrl) {
    return (
      <Image
        alt={item.name}
        className="today-item-photo"
        height={640}
        sizes={compact ? "78px" : "(max-width: 600px) 40vw, 180px"}
        src={item.primaryImageUrl}
        unoptimized
        width={480}
      />
    );
  }
  if (!role) {
    return (
      <span className="today-item-fallback" aria-hidden="true">
        {item.name.slice(0, 1).toUpperCase()}
      </span>
    );
  }
  return (
    <GarmentArtwork
      compact={compact}
      category={artworkCategory(role)}
      color={item.primaryColor ?? "#827c73"}
      accent={item.secondaryColor ?? undefined}
    />
  );
}

function RecentlyAddedStrip({ items }: { items: TodayItem[] }) {
  return (
    <div className="recent-strip recent-strip--live">
      {items.map((item) => {
        const role = resolveWardrobeItemRole({
          layer_role: item.layerRole,
          category: item.category,
          subcategory: item.subcategory,
        });
        return (
          <article key={item.id}>
            <Link href={`/wardrobe/${item.id}`}>
              <span className="recent-strip__visual">
                <ItemVisual compact item={item} role={role} />
              </span>
              <span className="recent-strip__copy">
                <span>
                  {item.subcategory ?? item.category} · {readableToken(item.availability)}
                </span>
                <strong>{item.name}</strong>
              </span>
            </Link>
          </article>
        );
      })}
    </div>
  );
}

export function RecentlyAddedSection({
  coreLoading,
  recentItems,
}: {
  coreLoading: boolean;
  recentItems: TodayItem[];
}) {
  return (
    <section>
      <SectionHeader
        title="Recently added"
        description="A quick way back to the pieces you are still getting to know."
        action={
          <ButtonLink href="/wardrobe" variant="ghost">
            View wardrobe <ArrowRight size={15} aria-hidden="true" />
          </ButtonLink>
        }
      />
      {coreLoading ? (
        <div className="recent-strip recent-strip--loading" aria-busy="true" role="status">
          <span>Loading recent wardrobe items…</span>
        </div>
      ) : recentItems.length ? (
        <RecentlyAddedStrip items={recentItems} />
      ) : (
        <div className="recent-strip-empty">
          <p>No owned items have been added yet.</p>
          <ButtonLink href="/wardrobe/import" variant="secondary">
            Add your first piece
          </ButtonLink>
        </div>
      )}
    </section>
  );
}

function TodayOccasionInput({
  occasion,
  onOccasion,
  disabled,
  coreLoading,
  itemCount,
}: {
  occasion: string;
  onOccasion: (value: string) => void;
  disabled: boolean;
  coreLoading: boolean;
  itemCount: number;
}) {
  return (
    <>
      <label className="form-field" htmlFor="today-occasion">
        <span>Occasion or dress code</span>
        <input
          className="text-input"
          disabled={disabled}
          id="today-occasion"
          maxLength={120}
          onChange={(event) => onOccasion(event.target.value)}
          placeholder="For example: client meeting, then dinner"
          value={occasion}
        />
      </label>
      <div className="today-context-form__meta">
        <span>
          {coreLoading
            ? "Loading your wardrobe…"
            : itemCount
              ? `${itemCount} active ${itemCount === 1 ? "item" : "items"}; availability is filtered before styling.`
              : "Add clothes before requesting an owned-item outfit."}
        </span>
      </div>
    </>
  );
}

function TodayContextFormActions({
  disabled,
  generating,
  onBuildAndSave,
}: {
  disabled: boolean;
  generating: "unsaved" | "saved" | null;
  onBuildAndSave: () => void;
}) {
  return (
    <div className="today-context-form__actions">
      <Button disabled={disabled} type="submit">
        {generating === "unsaved" ? (
          <SpinnerGap className="spin" size={16} aria-hidden="true" />
        ) : (
          <Sparkle size={16} aria-hidden="true" />
        )}
        Build today’s look
      </Button>
      <Button disabled={disabled} onClick={onBuildAndSave} variant="secondary">
        {generating === "saved" ? (
          <SpinnerGap className="spin" size={16} aria-hidden="true" />
        ) : (
          <Heart size={16} aria-hidden="true" />
        )}
        Build &amp; save
      </Button>
    </div>
  );
}

function TodayQuickOccasions({
  occasion,
  onSelect,
  disabled,
}: {
  occasion: string;
  onSelect: (value: string) => void;
  disabled: boolean;
}) {
  return (
    <div className="context-card__choices" aria-label="Common occasions">
      {quickOccasions.map((choice) => (
        <button
          aria-pressed={occasion === choice}
          className={occasion === choice ? "is-active" : ""}
          disabled={disabled}
          key={choice}
          onClick={() => onSelect(choice)}
          type="button"
        >
          {choice}
        </button>
      ))}
    </div>
  );
}

export function TodayContextForm({
  occasion,
  onOccasion,
  generating,
  coreLoading,
  itemCount,
  hasItems,
  aiConfigured,
  onSubmit,
  onBuildAndSave,
}: TodayContextFormProps) {
  const disabled = !aiConfigured || coreLoading || Boolean(generating) || !hasItems;
  return (
    <Card className="context-card" as="section">
      <div className="context-card__icon">
        <CalendarBlank size={22} weight="light" aria-hidden="true" />
      </div>
      <div>
        <p className="eyebrow">Today’s context</p>
        <h2>What are you dressing for?</h2>
        <p>Choose a shortcut or describe today’s occasion in your own words.</p>
      </div>
      <form className="today-context-form" onSubmit={onSubmit}>
        <TodayQuickOccasions
          disabled={Boolean(generating)}
          occasion={occasion}
          onSelect={onOccasion}
        />
        <TodayOccasionInput
          coreLoading={coreLoading}
          disabled={Boolean(generating)}
          itemCount={itemCount}
          occasion={occasion}
          onOccasion={onOccasion}
        />
        <TodayContextFormActions
          disabled={disabled}
          generating={generating}
          onBuildAndSave={onBuildAndSave}
        />
      </form>
    </Card>
  );
}

export function TodayLookActions({
  saved,
  saving,
  notice,
  onSave,
}: {
  saved: boolean;
  saving: boolean;
  notice: string | null;
  onSave: () => void;
}) {
  return (
    <>
      <div className="today-look__actions">
        <Button disabled={saved || saving} onClick={onSave}>
          {saving ? (
            <SpinnerGap className="spin" size={16} aria-hidden="true" />
          ) : saved ? (
            <Check size={16} aria-hidden="true" />
          ) : (
            <Heart size={16} aria-hidden="true" />
          )}
          {saved ? "Saved" : "Save look"}
        </Button>
        <ButtonLink href="/outfits" variant="secondary">
          View outfits <ArrowRight size={15} aria-hidden="true" />
        </ButtonLink>
      </div>
      {notice ? (
        <div className="inline-feedback inline-feedback--success today-look__notice" role="status">
          <Check size={16} aria-hidden="true" />
          <span>{notice}</span>
        </div>
      ) : null}
    </>
  );
}

function TodayLookNotes({ recommendation }: { recommendation: TodayRecommendation }) {
  return (
    <>
      {recommendation.missingCategory ? (
        <p className="today-look__note">Missing category: {recommendation.missingCategory}</p>
      ) : null}
      {recommendation.followUpQuestion ? (
        <p className="today-look__note">{recommendation.followUpQuestion}</p>
      ) : null}
      {recommendation.excludedItemCount ? (
        <p className="today-look__note">
          {recommendation.excludedItemCount} owned
          {recommendation.excludedItemCount === 1 ? " item was" : " items were"} excluded by
          availability or context filters.
        </p>
      ) : null}
    </>
  );
}

function RecommendationPreviewTags({ styleTags }: { styleTags: string[] }) {
  if (!styleTags.length) return null;
  return (
    <div className="recommendation-preview__tags">
      {styleTags.map((tag) => (
        <Badge key={tag} tone="outline">
          {tag}
        </Badge>
      ))}
    </div>
  );
}

function RecommendationPreview({
  preview,
  previewImageUrl,
  previewStatus,
  previewRequestBusy,
  previewNotice,
  onRequestPreview,
}: {
  preview: TodayPreviewInfo;
  previewImageUrl: string | null;
  previewStatus: string | null;
  previewRequestBusy: boolean;
  previewNotice: string | null;
  onRequestPreview: () => void;
}) {
  return (
    <div className="recommendation-preview">
      <RecommendationPreviewTags styleTags={preview.styleTags} />
      {previewImageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          alt="Modeled preview of this outfit"
          className="recommendation-preview__image"
          src={previewImageUrl}
        />
      ) : previewRequestBusy ? (
        <p className="recommendation-preview__status">Modeled preview is generating…</p>
      ) : (
        // Every state short of `ready` stays actionable. A queued job is only
        // drained by a scheduler that need not exist or by this control, so
        // hiding it here is what stranded auto-enqueued previews on a
        // "generating…" that nothing was advancing -- and `failed` offered no
        // way back at all. Enqueuing is deduplicated server-side, so pressing
        // this against an existing job resumes it rather than duplicating it.
        <button
          className="recommendation-preview__request"
          onClick={onRequestPreview}
          type="button"
        >
          {previewLabel(previewStatus)}
        </button>
      )}
      {previewNotice ? <small>{previewNotice}</small> : null}
    </div>
  );
}

function TodayLookReasons({ reasons, warnings }: { reasons: string[]; warnings: string[] }) {
  return (
    <ul className="today-look__reasons" aria-label="Recommendation reasons and warnings">
      {reasons.slice(0, 3).map((reason) => (
        <li key={reason}>
          <CloudRain size={15} aria-hidden="true" /> {reason}
        </li>
      ))}
      <li>
        <Check size={15} weight="bold" aria-hidden="true" /> Every displayed item ID was re-verified
        against your wardrobe.
      </li>
      {warnings.map((warning) => (
        <li key={warning}>
          <WarningCircle size={15} aria-hidden="true" /> {warning}
        </li>
      ))}
    </ul>
  );
}

function TodayLookHeader({
  recommendation,
  recommendationWeather,
}: {
  recommendation: TodayRecommendation;
  recommendationWeather: WeatherView | null;
}) {
  return (
    <>
      <p className="eyebrow">
        {recommendation.occasion ?? "Open day"}
        {recommendationWeather?.locationName ? ` · ${recommendationWeather.locationName}` : ""}
        {` · ${Math.round(recommendation.confidence * 100)}% confidence`}
      </p>
      <h2 id="today-look-title">{recommendation.title}</h2>
      <p className="today-look__summary">{recommendation.explanation}</p>
    </>
  );
}

export function TodayLookDetails({
  recommendation,
  recommendationWeather,
  previewImageUrl,
  previewStatus,
  previewRequestBusy,
  previewNotice,
  onRequestPreview,
  saving,
  notice,
  onSave,
}: TodayLookDetailsProps) {
  return (
    <div className="today-look__details">
      <TodayLookHeader
        recommendation={recommendation}
        recommendationWeather={recommendationWeather}
      />
      {recommendation.preview ? (
        <RecommendationPreview
          onRequestPreview={onRequestPreview}
          preview={recommendation.preview}
          previewImageUrl={previewImageUrl}
          previewNotice={previewNotice}
          previewRequestBusy={previewRequestBusy}
          previewStatus={previewStatus}
        />
      ) : null}
      <TodayLookReasons
        reasons={weatherReasons(recommendationWeather)}
        warnings={recommendation.warnings}
      />
      <TodayLookNotes recommendation={recommendation} />
      <TodayLookActions
        notice={notice}
        onSave={onSave}
        saved={Boolean(recommendation.savedOutfitId)}
        saving={saving}
      />
    </div>
  );
}

function TodayLookPieces({ recommendation }: { recommendation: TodayRecommendation }) {
  return (
    <div className="today-look__pieces today-look__pieces--live">
      {recommendation.items.map((selection) => {
        const item = recommendation.itemDetails[selection.item_id];
        if (!item) return null;
        return (
          <Link
            className="today-look__piece"
            href={`/wardrobe/${selection.item_id}`}
            key={selection.item_id}
          >
            <span className="today-look__piece-visual">
              <ItemVisual item={item} role={selection.role} />
            </span>
            <span className="today-look__piece-copy">
              <span>{readableToken(selection.role)}</span>
              <strong>{item.name}</strong>
              <small>
                {[item.brand, item.subcategory ?? item.category].filter(Boolean).join(" · ")}
              </small>
              <code>{selection.item_id}</code>
            </span>
          </Link>
        );
      })}
    </div>
  );
}

function TodayLookArt({ recommendation }: { recommendation: TodayRecommendation }) {
  return (
    <div className="today-look__art">
      <div className="today-look__label">
        <Badge tone={recommendation.savedOutfitId ? "sage" : "rust"}>
          {recommendation.savedOutfitId ? "Saved recommendation" : "Unsaved recommendation"}
        </Badge>
      </div>
      <TodayLookPieces recommendation={recommendation} />
    </div>
  );
}

function TodayLookSection({
  recommendation,
  recommendationWeather,
  previewImageUrl,
  previewStatus,
  previewRequestBusy,
  previewNotice,
  onRequestPreview,
  saving,
  notice,
  onSave,
}: {
  recommendation: TodayRecommendation;
  recommendationWeather: WeatherView | null;
  previewImageUrl: string | null;
  previewStatus: string | null;
  previewRequestBusy: boolean;
  previewNotice: string | null;
  onRequestPreview: () => void;
  saving: boolean;
  notice: string | null;
  onSave: () => void;
}) {
  return (
    <section className="today-look today-look--live" aria-labelledby="today-look-title">
      <TodayLookArt recommendation={recommendation} />
      <TodayLookDetails
        notice={notice}
        onRequestPreview={onRequestPreview}
        onSave={onSave}
        previewImageUrl={previewImageUrl}
        previewNotice={previewNotice}
        previewRequestBusy={previewRequestBusy}
        previewStatus={previewStatus}
        recommendation={recommendation}
        recommendationWeather={recommendationWeather}
        saving={saving}
      />
    </section>
  );
}

function RecommendationStatus({ loadingWardrobe }: { loadingWardrobe: boolean }) {
  return (
    <section className="today-recommendation-status" aria-busy="true" role="status">
      <SpinnerGap className="spin" size={30} aria-hidden="true" />
      <div>
        <h2>{loadingWardrobe ? "Loading your wardrobe…" : "Building today’s look…"}</h2>
        <p>
          {loadingWardrobe
            ? "Recent items and today’s recommendation controls will appear when loading finishes."
            : "The stylist is filtering your owned, available pieces against today’s context."}
        </p>
      </div>
    </section>
  );
}

function RecommendationEmpty({ hasItems }: { hasItems: boolean }) {
  return (
    <section className="empty-state today-recommendation-empty" aria-labelledby="today-look-title">
      <span className="empty-state__icon">
        <Sparkle size={25} weight="light" aria-hidden="true" />
      </span>
      <h2 id="today-look-title">
        {hasItems ? "Ready for today’s context" : "Your wardrobe is empty"}
      </h2>
      <p>
        {hasItems
          ? "Choose an occasion above to build a weather-aware look from exact owned item IDs."
          : "Add a few pieces manually or by photo before asking for a recommendation."}
      </p>
      {!hasItems ? (
        <div className="empty-state__action">
          <ButtonLink href="/wardrobe/import">Add clothes</ButtonLink>
        </div>
      ) : null}
    </section>
  );
}

export function TodayRecommendationArea({
  state,
}: {
  state: ReturnType<typeof useTodayWorkspaceState>;
}) {
  if (state.coreLoading || state.generating) {
    return <RecommendationStatus loadingWardrobe={state.coreLoading} />;
  }
  if (state.recommendation) {
    return (
      <TodayLookSection
        notice={state.notice}
        onRequestPreview={() => void state.requestPreview()}
        onSave={() => void state.saveRecommendation()}
        previewImageUrl={state.previewImageUrl}
        previewNotice={state.previewNotice}
        previewRequestBusy={state.previewRequestBusy}
        previewStatus={state.previewStatus}
        recommendation={state.recommendation}
        recommendationWeather={state.recommendation?.weather ?? state.weather}
        saving={state.saving}
      />
    );
  }
  return <RecommendationEmpty hasItems={Boolean(state.items.length)} />;
}

function WeatherLoading() {
  return (
    <section className="weather-card weather-card--status" aria-busy="true" role="status">
      <SpinnerGap className="spin" size={34} aria-hidden="true" />
      <div>
        <h2>Loading today’s weather…</h2>
        <p>Using your saved location and comfort settings.</p>
      </div>
    </section>
  );
}

function WeatherUnavailable({ error, onRetry }: { error: string | null; onRetry: () => void }) {
  return (
    <section className="weather-card weather-card--status" aria-labelledby="weather-title">
      <WarningCircle size={34} aria-hidden="true" />
      <div>
        <h2 id="weather-title">Weather context unavailable</h2>
        <p>{error ?? "Add a home location to use weather-aware recommendations."}</p>
        <div className="weather-card__status-actions">
          <Button onClick={onRetry} variant="secondary">
            Try again
          </Button>
          <ButtonLink href="/settings" variant="ghost">
            Check location
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}

function Forecast({
  weather,
  unit,
  wet,
}: {
  weather: WeatherView;
  unit: TodayProfile["temperatureUnit"];
  wet: boolean;
}) {
  const mainTemperature = temperature(weather.temperatureC, unit);
  const minimum = temperature(weather.minimumC, unit);
  const maximum = temperature(weather.maximumC, unit);
  const range = minimum && maximum ? `${minimum}–${maximum}` : (minimum ?? maximum);
  return (
    <div className="weather-card__forecast">
      {wet ? (
        <CloudRain size={48} weight="duotone" aria-hidden="true" />
      ) : (
        <ThermometerSimple size={48} weight="duotone" aria-hidden="true" />
      )}
      <div>
        <strong>{mainTemperature ?? range ?? "—"}</strong>
        <span>
          {weather.feelsLikeC !== null
            ? `Feels like ${temperature(weather.feelsLikeC, unit)}`
            : range && mainTemperature
              ? `Range ${range}`
              : "Forecast range unavailable"}
        </span>
      </div>
    </div>
  );
}

function WeatherFacts({ weather }: { weather: WeatherView }) {
  return (
    <div className="weather-card__facts">
      {weather.rainProbability !== null ? (
        <span>
          <CloudRain size={15} aria-hidden="true" /> {Math.round(weather.rainProbability)}% rain
        </span>
      ) : null}
      {weather.windKph !== null ? (
        <span>
          <Wind size={15} aria-hidden="true" /> {Math.round(weather.windKph)} km/h
        </span>
      ) : null}
      {weather.humidityPercent !== null ? (
        <span>{Math.round(weather.humidityPercent)}% humidity</span>
      ) : null}
    </div>
  );
}

function WeatherReady({
  weather,
  profile,
}: {
  weather: WeatherView;
  profile: TodayProfile | null;
}) {
  const reasons = weatherReasons(weather);
  const wet = (weather.rainProbability ?? 0) >= 40 || (weather.precipitationMm ?? 0) >= 0.5;
  return (
    <section className="weather-card" aria-labelledby="weather-title">
      <div className="weather-card__topline">
        <span>
          <MapPin size={14} aria-hidden="true" />
          {weather.locationName ?? profile?.locationName ?? "Saved location"}
        </span>
        <Badge tone="outline">{weather.provider ?? "Live forecast"}</Badge>
      </div>
      <Forecast unit={profile?.temperatureUnit ?? "fahrenheit"} weather={weather} wet={wet} />
      <div className="weather-card__copy">
        <h2 id="weather-title">{weatherHeadline(weather)}</h2>
        <p>{reasons[0] ?? "No special clothing constraints were derived for today."}</p>
      </div>
      <WeatherFacts weather={weather} />
    </section>
  );
}

export function TodayWeatherCard({
  weather,
  loading,
  error,
  profile,
  onRetry,
}: {
  weather: WeatherView | null;
  loading: boolean;
  error: string | null;
  profile: TodayProfile | null;
  onRetry: () => void;
}) {
  if (loading) return <WeatherLoading />;
  if (!weather) return <WeatherUnavailable error={error} onRetry={onRetry} />;
  return <WeatherReady profile={profile} weather={weather} />;
}

function TodayGrid({
  state,
  aiConfigured,
}: {
  state: ReturnType<typeof useTodayWorkspaceState>;
  aiConfigured: boolean;
}) {
  return (
    <div className="today-grid">
      <TodayWeatherCard
        error={state.weatherError}
        loading={state.weatherLoading}
        onRetry={state.retryLoad}
        profile={state.profile}
        weather={state.weather}
      />
      <TodayContextForm
        aiConfigured={aiConfigured}
        coreLoading={state.coreLoading}
        generating={state.generating}
        hasItems={Boolean(state.items.length)}
        itemCount={state.itemCount}
        occasion={state.occasion}
        onBuildAndSave={() => void state.generate(true)}
        onOccasion={state.setOccasion}
        onSubmit={state.submit}
      />
    </div>
  );
}

function TodayHeader({ dateLabel, title }: { dateLabel: string; title: string }) {
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

function ErrorBanner({ error, onRetry }: { error: string | null; onRetry?: () => void }) {
  if (!error) return null;
  return (
    <div className="inline-feedback inline-feedback--error" role="alert">
      <WarningCircle size={17} aria-hidden="true" />
      <span>{error}</span>
      {onRetry ? (
        <Button onClick={onRetry} variant="ghost">
          Retry
        </Button>
      ) : null}
    </div>
  );
}

function AiConfigurationNotice({ configured }: { configured: boolean }) {
  if (configured) return null;
  return (
    <div className="inline-feedback inline-feedback--error" role="status">
      <WarningCircle size={17} aria-hidden="true" />
      <span>
        Live wardrobe and weather data are available, but outfit generation requires the server’s
        OpenAI stylist configuration.
      </span>
    </div>
  );
}

export function TodayWorkspace({ aiConfigured }: { aiConfigured: boolean }) {
  const state = useTodayWorkspaceState(aiConfigured);

  return (
    <div className="page-stack today-page today-page--live">
      <TodayHeader
        dateLabel={state.dateLabel}
        title={state.coreLoading ? "Loading today…" : greeting(state.profile)}
      />
      <ErrorBanner error={state.coreError} onRetry={state.retryLoad} />
      <AiConfigurationNotice configured={aiConfigured} />
      <TodayGrid aiConfigured={aiConfigured} state={state} />
      <ErrorBanner error={state.generationError} />
      <TodayRecommendationArea state={state} />
      <RecentlyAddedSection coreLoading={state.coreLoading} recentItems={state.recentItems} />
    </div>
  );
}
