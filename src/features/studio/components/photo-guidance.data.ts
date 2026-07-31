export const PHOTO_GUIDANCE = [
  "One person, and only you.",
  "Full body, head through shoes.",
  "Facing the camera, or turned very slightly.",
  "Arms a little away from your torso.",
  "Even, natural light.",
  "Nothing covering you — no bags, no furniture in front.",
  "Plain, close-fitting clothes if you're comfortable in them.",
  "No mirrors with other people reflected.",
] as const;

/**
 * Deliberately concrete about what happens to the photo. Consent that does not
 * say where the image goes is not informed consent.
 */
export const CONSENT_POINTS = [
  "Your photo is stored privately, in a bucket only you can read.",
  "It is sent to a third-party AI image service to render each try-on you ask for.",
  "It is used only when you press Try it on. Nothing is generated in the background.",
  "You can replace or delete it at any time, which also removes the try-ons made from it.",
] as const;

export const CONSENT_STATEMENT =
  "I understand my reference photo will be sent to a third-party AI image service to generate private style visualizations, and that these are visualizations rather than predictions of fit.";
