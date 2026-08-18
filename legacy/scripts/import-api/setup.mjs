import { stat } from "node:fs/promises";
import path from "node:path";

export function createSetupStatus({ root, setting }) {
  return async function setupStatus() {
    const hasApiKey = Boolean(setting("OPENAI_API_KEY").trim());
    const referenceSetting = setting("WARDROBE_MODEL_REFERENCE", "data/model-reference.png");
    const referencePath = path.resolve(root, referenceSetting);
    let hasModelReference = false;
    try {
      hasModelReference = (await stat(referencePath)).isFile();
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    return {
      ready: hasApiKey && hasModelReference,
      hasApiKey,
      hasModelReference,
      modelReference: referenceSetting,
    };
  };
}
