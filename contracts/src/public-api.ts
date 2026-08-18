import type { ServiceHealth } from "./service-health.js";

export const PUBLIC_API_VERSION = "v1" as const;
export const PUBLIC_API_PREFIX = `/api/${PUBLIC_API_VERSION}` as const;

export interface PublicApiError {
  error: {
    code: string;
    message: string;
    requestId: string;
    details?: Record<string, unknown>;
  };
}

export interface CursorPage<T> {
  data: T[];
  nextCursor: string | null;
}

export interface AcceptedJob {
  id: string;
  status: "queued";
  statusUrl: string;
}

export type BackendHealthResponse = ServiceHealth & { service: "backend" };

export interface FrontendConfigDto {
  databaseConfigured: boolean;
  publicSignupEnabled: boolean;
  googleAuthEnabled: boolean;
  magicLinkEnabled: boolean;
  captchaEnabled: boolean;
  turnstileSiteKey: string | null;
  capabilities: {
    chatAvailable: boolean;
    outfitGenerationAvailable: boolean;
    planGenerationAvailable: boolean;
    visualizationAvailable: boolean;
  };
}

export interface FrontendSessionDto {
  authenticated: boolean;
  needsMfa: boolean;
  legalAccepted: boolean;
}

export interface MfaFactorDto {
  id: string;
  label: string;
}

export interface InsightItemDto {
  id: string;
  name: string;
  category: string;
  subcategory: string | null;
  layer_role: "top" | "bottom" | "dress" | "layer" | "shoes" | "accessory" | null;
  color_names: string[];
  season_tags: string[];
  wear_count: number;
  last_worn_at: string | null;
  purchase_price: number | null;
  currency: string | null;
}

export interface WardrobeInsightsDto {
  itemCount: number;
  categories: Array<{ name: string; count: number }>;
  colors: Array<{ name: string; count: number }>;
  seasonalWear: Array<{ name: string; count: number }>;
  mostWorn: InsightItemDto[];
  leastWorn: InsightItemDto[];
  neverWorn: InsightItemDto[];
  costPerWear: Array<{ itemId: string; name: string; value: number; currency: string | null }>;
  possibleFoundations: number;
  gapSuggestions: Array<{ role: string; note: string }>;
  overrepresented: Array<{ name: string; count: number; note: string }>;
}

export interface WardrobeInsightsResponse {
  data: WardrobeInsightsDto;
}

const nullableString = { anyOf: [{ type: "string" }, { type: "null" }] };
const insightItemSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "id",
    "name",
    "category",
    "subcategory",
    "layer_role",
    "color_names",
    "season_tags",
    "wear_count",
    "last_worn_at",
    "purchase_price",
    "currency",
  ],
  properties: {
    id: { type: "string" },
    name: { type: "string" },
    category: { type: "string" },
    subcategory: nullableString,
    layer_role: {
      anyOf: [
        { type: "string", enum: ["top", "bottom", "dress", "layer", "shoes", "accessory"] },
        { type: "null" },
      ],
    },
    color_names: { type: "array", items: { type: "string" } },
    season_tags: { type: "array", items: { type: "string" } },
    wear_count: { type: "integer", minimum: 0 },
    last_worn_at: nullableString,
    purchase_price: { anyOf: [{ type: "number" }, { type: "null" }] },
    currency: nullableString,
  },
};
const countSchema = {
  type: "object",
  additionalProperties: false,
  required: ["name", "count"],
  properties: { name: { type: "string" }, count: { type: "number" } },
};

export const wardrobeInsightsResponseJsonSchema: Record<string, unknown> = {
  $id: "WardrobeInsightsResponse",
  type: "object",
  additionalProperties: false,
  required: ["data"],
  properties: {
    data: {
      type: "object",
      additionalProperties: false,
      required: [
        "itemCount",
        "categories",
        "colors",
        "seasonalWear",
        "mostWorn",
        "leastWorn",
        "neverWorn",
        "costPerWear",
        "possibleFoundations",
        "gapSuggestions",
        "overrepresented",
      ],
      properties: {
        itemCount: { type: "integer", minimum: 0 },
        categories: { type: "array", items: countSchema },
        colors: { type: "array", items: countSchema },
        seasonalWear: { type: "array", items: countSchema },
        mostWorn: { type: "array", items: insightItemSchema },
        leastWorn: { type: "array", items: insightItemSchema },
        neverWorn: { type: "array", items: insightItemSchema },
        costPerWear: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["itemId", "name", "value", "currency"],
            properties: {
              itemId: { type: "string" },
              name: { type: "string" },
              value: { type: "number" },
              currency: nullableString,
            },
          },
        },
        possibleFoundations: { type: "integer", minimum: 0 },
        gapSuggestions: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["role", "note"],
            properties: { role: { type: "string" }, note: { type: "string" } },
          },
        },
        overrepresented: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["name", "count", "note"],
            properties: {
              name: { type: "string" },
              count: { type: "number" },
              note: { type: "string" },
            },
          },
        },
      },
    },
  },
};

export const publicApiErrorJsonSchema: Record<string, unknown> = {
  $id: "PublicApiError",
  type: "object",
  additionalProperties: false,
  required: ["error"],
  properties: {
    error: {
      type: "object",
      additionalProperties: false,
      required: ["code", "message", "requestId"],
      properties: {
        code: { type: "string", minLength: 1 },
        message: { type: "string", minLength: 1 },
        requestId: { type: "string", minLength: 1 },
        details: { type: "object", additionalProperties: true },
      },
    },
  },
};
