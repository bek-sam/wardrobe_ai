import { useState } from "react";

import type { SwapState } from "./stylist.types";

export function useSwapState() {
  const [swap, setSwap] = useState<SwapState | null>(null);
  const [swapBusy, setSwapBusy] = useState(false);
  return { swap, setSwap, swapBusy, setSwapBusy };
}
