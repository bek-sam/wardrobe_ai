import { useMemo, useState } from "react";

import { shiftDate } from "./planner-dates";

export function usePlannerDates(initialDate: string) {
  const [anchor, setAnchor] = useState(initialDate);
  const [today] = useState(initialDate);

  const dates = useMemo(
    () => (anchor ? Array.from({ length: 7 }, (_, index) => shiftDate(anchor, index)) : []),
    [anchor],
  );

  return { anchor, setAnchor, today, dates };
}
