import type { OccasionCategory } from "@/lib/recommendation";

export interface OccasionStyleProfile {
  category: OccasionCategory;
  narrative: string;
  formalityRange: readonly [number, number];
  colorGuidance: string;
  avoid: readonly string[];
}

const profiles: Record<OccasionCategory, OccasionStyleProfile> = {
  casual: {
    category: "casual",
    narrative: "Relaxed, everyday dressing with room for personal style.",
    formalityRange: [1, 2],
    colorGuidance: "Any palette works; comfort and personality lead.",
    avoid: ["overly formal fabrics like satin or suiting"],
  },
  work: {
    category: "work",
    narrative: "Professional but approachable office dressing.",
    formalityRange: [2, 3],
    colorGuidance: "Neutrals with a controlled accent color read as polished.",
    avoid: ["athletic wear", "overly casual graphics"],
  },
  business: {
    category: "business",
    narrative: "Client-facing or corporate settings that expect a sharper look.",
    formalityRange: [3, 4],
    colorGuidance: "Navy, charcoal, and white are safe anchors.",
    avoid: ["casual denim", "sneakers unless explicitly smart-casual"],
  },
  interview: {
    category: "interview",
    narrative: "First-impression dressing; err conservative.",
    formalityRange: [4, 5],
    colorGuidance: "Neutral, low-contrast palettes reduce distraction.",
    avoid: ["bold patterns", "casual footwear"],
  },
  dinner: {
    category: "dinner",
    narrative: "Evening dining -- smart and put-together without being stiff.",
    formalityRange: [3, 4],
    colorGuidance: "Richer, deeper tones suit evening lighting.",
    avoid: ["daytime athletic wear"],
  },
  date: {
    category: "date",
    narrative: "Personal expression matters more than strict formality rules.",
    formalityRange: [2, 4],
    colorGuidance: "A flattering signature color or silhouette choice is encouraged.",
    avoid: ["anything that reads as work uniform"],
  },
  wedding: {
    category: "wedding",
    narrative: "Celebratory but respectful of the couple -- never upstage.",
    formalityRange: [3, 5],
    colorGuidance: "Avoid all-white/all-black unless the dress code specifies it.",
    avoid: ["white", "overly casual footwear"],
  },
  formal_event: {
    category: "formal_event",
    narrative: "Black-tie or gala-caliber dressing.",
    formalityRange: [5, 5],
    colorGuidance: "Classic, deep, or metallic tones suit formal evening settings.",
    avoid: ["casual fabrics", "sneakers"],
  },
  party: {
    category: "party",
    narrative: "Social, higher-energy settings that reward a bit of boldness.",
    formalityRange: [2, 4],
    colorGuidance: "Room for one statement piece or bold color.",
    avoid: ["overly conservative office wear"],
  },
  concert: {
    category: "concert",
    narrative: "Expressive, comfort-forward dressing for standing/movement.",
    formalityRange: [1, 3],
    colorGuidance: "Personal style and layering for temperature swings.",
    avoid: ["delicate formalwear"],
  },
  travel: {
    category: "travel",
    narrative: "Comfort and practicality across changing environments.",
    formalityRange: [1, 3],
    colorGuidance: "Neutral, easy-to-mix pieces travel best.",
    avoid: ["anything high-maintenance or hard to layer"],
  },
  outdoor: {
    category: "outdoor",
    narrative: "Function-first dressing for weather and activity.",
    formalityRange: [1, 2],
    colorGuidance: "Durable, weather-appropriate pieces over aesthetic-only choices.",
    avoid: ["delicate fabrics", "non-weatherproof footwear"],
  },
  exercise: {
    category: "exercise",
    narrative: "Performance-first dressing.",
    formalityRange: [1, 1],
    colorGuidance: "Function drives choice; color is secondary.",
    avoid: ["non-athletic garments"],
  },
  errands: {
    category: "errands",
    narrative: "Quick, low-effort, comfortable dressing.",
    formalityRange: [1, 2],
    colorGuidance: "Easy neutrals; no strong guidance needed.",
    avoid: ["anything precious or hard to care for"],
  },
};

export function occasionStyleProfile(category: OccasionCategory): OccasionStyleProfile {
  return profiles[category];
}
