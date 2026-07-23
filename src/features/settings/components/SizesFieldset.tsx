import { TextField } from "@/components/ui/FormField";

const SIZE_FIELDS = [
  { key: "topSize", id: "settings-size-top", label: "Tops" },
  { key: "bottomSize", id: "settings-size-bottom", label: "Bottoms" },
  { key: "dressSize", id: "settings-size-dress", label: "Dresses" },
  { key: "shoeSize", id: "settings-size-shoes", label: "Shoes" },
] as const;

export function SizesFieldset({
  disabled,
  sizes,
  onChange,
}: {
  disabled: boolean;
  sizes: Record<(typeof SIZE_FIELDS)[number]["key"], string>;
  onChange: (key: (typeof SIZE_FIELDS)[number]["key"], value: string) => void;
}) {
  return (
    <fieldset className="settings-fieldset" disabled={disabled}>
      <legend>Sizes</legend>
      <div className="form-grid form-grid--two">
        {SIZE_FIELDS.map((field) => (
          <TextField
            key={field.key}
            id={field.id}
            label={field.label}
            onChange={(event) => onChange(field.key, event.target.value)}
            optional
            value={sizes[field.key]}
          />
        ))}
      </div>
    </fieldset>
  );
}
