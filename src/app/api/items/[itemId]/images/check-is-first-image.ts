import { createAdminClient } from "@/lib/supabase/admin";

type AdminClient = ReturnType<typeof createAdminClient>;

export async function checkIsFirstImage(admin: AdminClient, userId: string, itemId: string) {
  const { count, error } = await admin
    .from("wardrobe_item_images")
    .select("id", { count: "exact", head: true })
    .eq("item_id", itemId)
    .eq("user_id", userId)
    .eq("is_primary", true);
  if (error) throw error;
  return (count ?? 0) === 0;
}
