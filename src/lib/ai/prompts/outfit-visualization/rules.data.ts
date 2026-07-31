/**
 * Fixed rule block for the try-on prompt. Kept as data next to the versioned
 * builder so a wording change is a reviewable diff that must be paired with a
 * prompt-version bump (the version is an input to the freshness hash).
 */
export const VISUALIZATION_PROMPT_RULES = `Rules:
- Image 1 is the identity reference. Take the person's face, hair, skin tone, body proportions, and general appearance from it, and nothing else. It supplies no clothing.
- Preserve the person's recognizable identity exactly. Do not beautify, slim, widen, lengthen, age, or otherwise reshape them.
- Render exactly one person, full body, head through shoes, in portrait framing. Do not crop the head or the feet.
- Use only the garments supplied above, each in the role its image is mapped to. Do not substitute, add, or omit a garment.
- Do not add any jacket, coat, bag, belt, scarf, hat, jewelry, or footwear that was not supplied.
- Preserve for every garment: dominant and secondary colors, pattern placement and scale, silhouette, garment length, neckline or collar, sleeve length and volume, rise and leg shape, closure and whether it is open or closed, texture, sheen, and distinctive construction details.
- Reproduce visible logos or text only where they can be rendered accurately. Never invent text, labels, or branding.
- Layer the garments in a physically logical order, with the outer layer over the top and the top's hem related sensibly to the bottom.
- Use a natural, neutral, editorial standing pose with arms slightly away from the torso so every garment region stays visible. Do not let the hands cover important garment features.
- Use a simple warm-neutral studio background with clean separation between the person and the background, and even natural lighting.
- This is a style visualization, not a fit simulation. Do not attempt to depict physical fit, tailoring, or sizing accuracy.`;
