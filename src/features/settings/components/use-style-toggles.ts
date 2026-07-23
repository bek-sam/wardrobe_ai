import { toggleSelection } from "@/features/settings/style-options-helpers";

import type { StyleFormState } from "./settings.types";

export function useStyleToggles(
  styleForm: StyleFormState,
  setStyleForm: (updater: (current: StyleFormState) => StyleFormState) => void,
) {
  function toggleStyle(value: string) {
    toggleSelection(value, styleForm.styles, (styles) =>
      setStyleForm((current) => ({ ...current, styles })),
    );
  }

  function toggleActivity(value: string) {
    toggleSelection(value, styleForm.activities, (activities) =>
      setStyleForm((current) => ({ ...current, activities })),
    );
  }

  return { toggleStyle, toggleActivity };
}
