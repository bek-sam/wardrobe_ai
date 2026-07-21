import { randomUUID } from "node:crypto";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

type LegacyItem = {
  id?: string;
  name?: string;
  part?: string;
  color?: string;
  secondaryColor?: string | null;
  palette?: string[];
  tags?: string[];
  image?: string;
  thumbnail?: string;
  modeledImage?: string | null;
  importJobId?: string;
  [key: string]: unknown;
};

const categoryMap: Record<string, { category: string; role: string | null }> = {
  upperbody: { category: "tops", role: "top" },
  wholebody_up: { category: "outerwear", role: "layer" },
  lowerbody: { category: "bottoms", role: "bottom" },
  accessories_up: { category: "accessories", role: "accessory" },
  shoes: { category: "shoes", role: "shoes" },
};

function argument(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function requireValue(value: string | undefined, label: string) {
  if (!value) throw new Error(`${label} is required.`);
  return value;
}

function resolveLegacyAsset(value: string | null | undefined, dataDirectory: string) {
  if (!value) return null;
  const filename = path.basename(value.split("?")[0] ?? "");
  if (!filename) return null;
  return path.join(dataDirectory, "imported", filename);
}

async function normalizedAsset(filePath: string) {
  await access(filePath);
  const bytes = await sharp(filePath).rotate().toColorspace("srgb").png().toBuffer();
  const metadata = await sharp(bytes).metadata();
  if (!metadata.width || !metadata.height) throw new Error(`Invalid image: ${filePath}`);
  return { bytes, width: metadata.width, height: metadata.height };
}

async function main() {
  if (process.argv.includes("--help")) {
    console.info(
      "Usage: npm run migrate:legacy -- --user-id <auth-user-uuid> [--data-dir data] [--apply]",
    );
    return;
  }
  const userId = requireValue(argument("--user-id"), "--user-id");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId)) {
    throw new Error("--user-id must be a valid UUID.");
  }
  const apply = process.argv.includes("--apply");
  const dataDirectory = path.resolve(argument("--data-dir") ?? "data");
  const libraryPath = path.join(dataDirectory, "library.json");
  const items = JSON.parse(await readFile(libraryPath, "utf8")) as LegacyItem[];
  if (!Array.isArray(items)) throw new Error("data/library.json must contain an array.");

  console.info(
    `${apply ? "Applying" : "Dry run:"} ${items.length} legacy wardrobe records for ${userId}.`,
  );
  if (!apply) {
    console.info("Re-run with --apply after checking the target user and environment variables.");
    return;
  }

  const url = requireValue(process.env.NEXT_PUBLIC_SUPABASE_URL, "NEXT_PUBLIC_SUPABASE_URL");
  const serviceKey = requireValue(
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    "SUPABASE_SERVICE_ROLE_KEY",
  );
  const itemsBucket = process.env.WARDROBE_ITEMS_BUCKET ?? "wardrobe-items";
  const generatedBucket = process.env.WARDROBE_GENERATED_BUCKET ?? "wardrobe-generated";
  const supabase = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", userId)
    .maybeSingle();
  if (profileError) throw profileError;
  if (!profile) throw new Error("The target Supabase user/profile does not exist.");

  let imported = 0;
  let skipped = 0;
  for (const legacy of items) {
    if (!legacy.id) {
      skipped += 1;
      continue;
    }
    const mapping = categoryMap[legacy.part ?? ""] ?? { category: "other", role: null };
    const { data: existing, error: existingError } = await supabase
      .from("wardrobe_items")
      .select("id")
      .eq("user_id", userId)
      .eq("legacy_id", legacy.id)
      .maybeSingle();
    if (existingError) throw existingError;
    const itemId = existing?.id ?? randomUUID();
    const row = {
      user_id: userId,
      status: "active",
      source: "legacy",
      name: legacy.name?.trim() || "Imported piece",
      category: mapping.category,
      layer_role: mapping.role,
      primary_color_hex: legacy.color ?? null,
      secondary_color_hex: legacy.secondaryColor ?? null,
      color_names: legacy.palette ?? [],
      notes: legacy.tags?.length ? `Legacy tags: ${legacy.tags.join(", ")}` : "",
      legacy_id: legacy.id,
      legacy_part: legacy.part ?? null,
      legacy_image_path: legacy.image ?? null,
      legacy_modeled_image_path: legacy.modeledImage ?? null,
      legacy_import_job_id: legacy.importJobId ?? null,
      legacy_payload: legacy,
    };
    const itemMutation = existing
      ? supabase.from("wardrobe_items").update(row).eq("id", itemId).eq("user_id", userId)
      : supabase.from("wardrobe_items").insert({ id: itemId, ...row });
    const { error: itemError } = await itemMutation;
    if (itemError) throw itemError;

    const assets = [
      {
        kind: "cutout",
        source: resolveLegacyAsset(legacy.image, dataDirectory),
        bucket: itemsBucket,
      },
      {
        kind: "thumbnail",
        source: resolveLegacyAsset(legacy.thumbnail, dataDirectory),
        bucket: itemsBucket,
      },
      {
        kind: "modeled",
        source: resolveLegacyAsset(legacy.modeledImage, dataDirectory),
        bucket: generatedBucket,
      },
    ];
    for (const asset of assets) {
      if (!asset.source) continue;
      try {
        const image = await normalizedAsset(asset.source);
        const storagePath = `${userId}/${itemId}/legacy-${asset.kind}.png`;
        const { error: uploadError } = await supabase.storage
          .from(asset.bucket)
          .upload(storagePath, image.bytes, { contentType: "image/png", upsert: true });
        if (uploadError) throw uploadError;
        const { error: imageError } = await supabase.from("wardrobe_item_images").upsert(
          {
            user_id: userId,
            item_id: itemId,
            kind: asset.kind,
            bucket_id: asset.bucket,
            storage_path: storagePath,
            mime_type: "image/png",
            width: image.width,
            height: image.height,
            file_size: image.bytes.byteLength,
            is_primary: asset.kind === "cutout",
          },
          { onConflict: "bucket_id,storage_path" },
        );
        if (imageError) throw imageError;
      } catch (error) {
        console.warn(`Skipped missing or invalid ${asset.kind} asset for ${legacy.id}:`, error);
      }
    }
    imported += 1;
  }
  console.info(`Migration complete: ${imported} imported, ${skipped} skipped.`);
}

await main();
