import { useState } from "react";

import { requestJson } from "@/lib/api/request";
import type { WardrobeItem } from "@/features/wardrobe/types";

import { uploadItemImage } from "./upload-item-image";
import { emptyForm } from "./wardrobe-manager.constants";
import { formFromItem, itemPayload, triggerWardrobeCompile } from "./wardrobe-manager.helpers";
import type { ItemFormValues } from "./wardrobe-manager.types";

export function useItemForm(
  item: WardrobeItem | null,
  onSaved: (item: WardrobeItem) => void,
  onWarning: (message: string) => void,
) {
  const [values, setValues] = useState<ItemFormValues>(() =>
    item ? formFromItem(item) : emptyForm,
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [image, setImage] = useState<File | null>(null);
  const editing = Boolean(item);

  function setField<Key extends keyof ItemFormValues>(key: Key, value: ItemFormValues[Key]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const saved = await requestJson<WardrobeItem>(
        editing ? `/api/items/${item?.id}` : "/api/items",
        {
          method: editing ? "PATCH" : "POST",
          body: JSON.stringify(itemPayload(values)),
        },
      );
      if (image) await uploadItemImage(saved.id, image, onWarning);
      onSaved(saved);
      triggerWardrobeCompile();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The item could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  return { values, setField, saving, error, setImage, editing, submit };
}
