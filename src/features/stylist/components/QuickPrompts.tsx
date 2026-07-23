import { quickPrompts } from "./stylist-constants.data";

export function QuickPrompts({
  disabled,
  onSelect,
}: {
  disabled: boolean;
  onSelect: (prompt: string) => void;
}) {
  return (
    <div className="quick-prompts" aria-label="Suggested prompts">
      {quickPrompts.map((prompt) => (
        <button disabled={disabled} key={prompt} onClick={() => onSelect(prompt)} type="button">
          {prompt}
        </button>
      ))}
    </div>
  );
}
