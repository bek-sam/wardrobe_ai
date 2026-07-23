export const intents = new Set([
  "packing",
  "planning",
  "insight",
  "item_question",
  "outfit_request",
]);

export const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const previewStatuses = new Set(["none", "queued", "generating", "ready", "failed"]);
