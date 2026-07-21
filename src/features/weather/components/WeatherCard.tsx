import { CloudRain, MapPin, Wind } from "@phosphor-icons/react/ssr";
import { Badge } from "@/components/ui/Badge";

export function WeatherCard({ compact = false }: { compact?: boolean }) {
  return (
    <section
      className={`weather-card${compact ? " weather-card--compact" : ""}`}
      aria-labelledby="weather-title"
    >
      <div className="weather-card__topline">
        <span>
          <MapPin size={14} aria-hidden="true" /> Chicago
        </span>
        <Badge tone="outline">Forecast preview</Badge>
      </div>
      <div className="weather-card__forecast">
        <CloudRain size={compact ? 34 : 48} weight="duotone" aria-hidden="true" />
        <div>
          <strong>62°</strong>
          <span>Feels like 59°</span>
        </div>
      </div>
      <div className="weather-card__copy">
        <h2 id="weather-title">Cool with light rain</h2>
        <p>A breathable layer and rain-safe shoes will carry you through the day.</p>
      </div>
      <div className="weather-card__facts">
        <span>
          <CloudRain size={15} /> 48% rain
        </span>
        <span>
          <Wind size={15} /> 12 mph
        </span>
      </div>
    </section>
  );
}
