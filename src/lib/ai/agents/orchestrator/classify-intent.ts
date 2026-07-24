export function classifyWardrobeIntent(request: string) {
  const text = request.toLowerCase();
  if (/pack|trip|luggage|travel capsule/.test(text)) return "packing" as const;
  if (/plan|week|tomorrow|calendar|future/.test(text)) return "planning" as const;
  if (/insight|unused|wear|cost per wear|gap/.test(text)) return "insight" as const;
  if (/what is|do i own|find|show me/.test(text)) return "item_question" as const;
  return "outfit_request" as const;
}
