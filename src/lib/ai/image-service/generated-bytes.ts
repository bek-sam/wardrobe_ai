import type { ImagesResponse } from "openai/resources/images";

export function generatedImageBytes(response: ImagesResponse) {
  const encoded = response.data?.[0]?.b64_json;
  if (!encoded) throw new Error("The image model returned no image data.");
  return Buffer.from(encoded, "base64");
}
