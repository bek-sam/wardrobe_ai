import type { AdminClient, CandidateMemberRow } from "./types";

export async function buildPreviewPromptInput(
  admin: AdminClient,
  memberRows: CandidateMemberRow[],
  userId: string,
) {
  const { data: itemRows } = await admin
    .from("wardrobe_items")
    .select("id, category, color_names, pattern")
    .eq("user_id", userId)
    .in(
      "id",
      memberRows.map((member) => member.item_id),
    );
  const itemsById = new Map((itemRows ?? []).map((row) => [row.id as string, row]));

  return memberRows.map((member) => {
    const item = itemsById.get(member.item_id);
    return {
      role: member.role,
      category: (item?.category as string | undefined) ?? "garment",
      colorNames: (item?.color_names as string[] | undefined) ?? [],
      pattern: (item?.pattern as string | null | undefined) ?? null,
    };
  });
}
