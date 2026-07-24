// Distinguished from a generic failure: a manually-added item (or one
// imported but never approved through cutout review) has no 'cutout' image
// and never will unless the user re-imports it through the photo pipeline --
// retrying this job on a backoff schedule would never succeed, so the caller
// treats it as terminal instead of scheduling a retry.
export class MissingCutoutError extends Error {
  constructor(readonly itemId: string) {
    super(`No cutout image found for item ${itemId}.`);
    this.name = "MissingCutoutError";
  }
}
