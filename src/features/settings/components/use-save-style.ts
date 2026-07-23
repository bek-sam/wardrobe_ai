import type { FormEvent } from "react";

import { buildStylePayload } from "./build-style-payload";
import type { StyleFormState } from "./settings.types";

export function useSaveStyle(
  styleForm: StyleFormState,
  save: (key: string, path: string, body: Record<string, unknown>) => Promise<unknown>,
) {
  return async function saveStyle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await save("style", "/api/style-profile", buildStylePayload(styleForm));
  };
}
