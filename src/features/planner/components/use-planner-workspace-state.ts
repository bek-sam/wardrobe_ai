import { useState } from "react";

import { usePlannerDates } from "./use-planner-dates";
import { usePlannerWeekData } from "./use-planner-week-data";
import type { PlanView } from "./planner.types";

export function usePlannerWorkspaceState(initialDate: string, supabaseConfigured: boolean) {
  const datesState = usePlannerDates(initialDate);
  const weekData = usePlannerWeekData(supabaseConfigured, datesState.dates);
  const [notice, setNotice] = useState<string | null>(null);
  const [editor, setEditor] = useState<{ date: string; plan: PlanView | null } | null>(null);
  const [generatorOpen, setGeneratorOpen] = useState(false);

  return {
    ...datesState,
    ...weekData,
    notice,
    setNotice,
    editor,
    setEditor,
    generatorOpen,
    setGeneratorOpen,
  };
}
