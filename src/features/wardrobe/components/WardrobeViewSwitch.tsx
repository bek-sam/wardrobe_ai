import { GridFour, Rows } from "@phosphor-icons/react";

export function WardrobeViewSwitch({
  viewMode,
  onChange,
  disabled = false,
}: {
  viewMode: "grid" | "list";
  onChange: (mode: "grid" | "list") => void;
  disabled?: boolean;
}) {
  return (
    <div className="view-switch" aria-label="Wardrobe view">
      <button
        aria-label="Grid view"
        aria-pressed={viewMode === "grid"}
        className={viewMode === "grid" ? "is-active" : ""}
        onClick={() => onChange("grid")}
        type="button"
      >
        <GridFour size={17} />
      </button>
      <button
        aria-label={disabled ? "List view" : "Compact list view"}
        aria-pressed={viewMode === "list"}
        className={viewMode === "list" ? "is-active" : ""}
        disabled={disabled}
        onClick={() => onChange("list")}
        type="button"
      >
        <Rows size={17} />
      </button>
    </div>
  );
}
