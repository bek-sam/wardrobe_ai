import { z } from "zod";

import { OUTFIT_ITEM_ROLES } from "../types";

export const outfitItemSelectionSchema = z
  .object({
    item_id: z.string().uuid(),
    role: z.enum(OUTFIT_ITEM_ROLES),
    sort_order: z.number().int().nonnegative().optional(),
  })
  .strict();

export const generatedOutfitSchema = z
  .object({
    title: z.string().trim().min(1).max(120),
    items: z.array(outfitItemSelectionSchema).min(1).max(5),
    explanation: z.string().trim().min(1).max(1_500),
    warnings: z.array(z.string().trim().min(1).max(240)).max(10).default([]),
    confidence: z.number().min(0).max(1),
    missing_category: z.string().trim().min(1).max(80).nullable().default(null),
    follow_up_question: z.string().trim().min(1).max(240).nullable().default(null),
  })
  .strict()
  .superRefine((outfit, context) => {
    const itemIds = new Set<string>();
    const roles = new Set<string>();

    outfit.items.forEach((item, index) => {
      if (itemIds.has(item.item_id)) {
        context.addIssue({
          code: "custom",
          message: "An owned item can appear only once in an outfit.",
          path: ["items", index, "item_id"],
        });
      }
      if (roles.has(item.role)) {
        context.addIssue({
          code: "custom",
          message: `Only one ${item.role} item may be selected.`,
          path: ["items", index, "role"],
        });
      }
      itemIds.add(item.item_id);
      roles.add(item.role);
    });

    const hasDress = roles.has("dress");
    const hasTop = roles.has("top");
    const hasBottom = roles.has("bottom");
    if (hasDress ? hasTop || hasBottom : !hasTop || !hasBottom) {
      context.addIssue({
        code: "custom",
        message: "A complete outfit requires one dress or one top with one bottom.",
        path: ["items"],
      });
    }
  });

export const outfitPlanProposalSchema = z
  .object({
    id: z.string().trim().min(1).max(120),
    item_ids: z.array(z.string().uuid()).min(1).max(5),
    base_score: z.number().min(0).max(1).default(0.5),
  })
  .strict()
  .superRefine((proposal, context) => {
    if (new Set(proposal.item_ids).size !== proposal.item_ids.length) {
      context.addIssue({
        code: "custom",
        message: "A plan proposal cannot contain duplicate item IDs.",
        path: ["item_ids"],
      });
    }
  });
