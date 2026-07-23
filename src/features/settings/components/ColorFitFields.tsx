import { TextField } from "@/components/ui/FormField";

export function ColorFitFields({
  disabled,
  favoriteColors,
  onFavoriteColors,
  avoidedColors,
  onAvoidedColors,
  preferredFits,
  onPreferredFits,
}: {
  disabled: boolean;
  favoriteColors: string;
  onFavoriteColors: (value: string) => void;
  avoidedColors: string;
  onAvoidedColors: (value: string) => void;
  preferredFits: string;
  onPreferredFits: (value: string) => void;
}) {
  return (
    <div className="form-grid form-grid--two">
      <TextField
        disabled={disabled}
        id="settings-favorite-colors"
        label="Favorite colors"
        onChange={(event) => onFavoriteColors(event.target.value)}
        optional
        placeholder="navy, cream, rust"
        value={favoriteColors}
      />
      <TextField
        disabled={disabled}
        id="settings-avoided-colors"
        label="Colors to avoid"
        onChange={(event) => onAvoidedColors(event.target.value)}
        optional
        placeholder="neon yellow, bright orange"
        value={avoidedColors}
      />
      <TextField
        disabled={disabled}
        hint="Comma-separated; for example relaxed, straight, oversized."
        id="settings-preferred-fits"
        label="Preferred fits"
        onChange={(event) => onPreferredFits(event.target.value)}
        optional
        value={preferredFits}
      />
    </div>
  );
}
