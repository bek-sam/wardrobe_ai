// Best-effort nudge: a database trigger already durably queues a wardrobe
// compilation job whenever confirmed items land, so this call is purely a
// latency optimization to process it promptly. Safe to ignore if it fails.
export function triggerWardrobeCompile() {
  fetch("/api/wardrobe/compile", { method: "POST" }).catch(() => {});
}
