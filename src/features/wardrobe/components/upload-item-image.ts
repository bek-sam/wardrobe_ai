import { errorMessage } from "@/lib/api/request";

export async function uploadItemImage(
  itemId: string,
  image: File,
  onWarning: (message: string) => void,
) {
  try {
    const imageData = new FormData();
    imageData.set("file", image);
    const response = await fetch(`/api/items/${itemId}/images`, {
      method: "POST",
      body: imageData,
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok)
      onWarning(errorMessage(payload, "The garment was saved, but its image was not."));
  } catch {
    onWarning("The garment was saved, but its image upload did not finish.");
  }
}
