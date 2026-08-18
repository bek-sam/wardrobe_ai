import { describe, expect, it, vi } from "vitest";

import type { SupabaseClient } from "@supabase/supabase-js";

import { ApiError } from "@/lib/api/response";
import { resolveSourceSelections } from "@/lib/visualization-pipeline";
import type { CreateVisualizationInput } from "@/lib/visualization";

const OUTFIT_ID = "11111111-1111-4111-8111-111111111111";
const PLAN_ID = "22222222-2222-4222-8222-222222222222";
const CANDIDATE_ID = "33333333-3333-4333-8333-333333333333";
const USER_ID = "44444444-4444-4444-8444-444444444444";

const SELECTIONS = [
  { item_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", role: "top", sort_order: 0 },
  { item_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", role: "bottom", sort_order: 1 },
];

/**
 * Records every filter the resolver applies, so the tests can assert the
 * `user_id` scoping that keeps one user's outfit from resolving under another
 * user's request.
 */
function stubClient(tables: Record<string, unknown>) {
  const filters: { table: string; column: string; value: unknown }[] = [];

  const from = vi.fn((table: string) => {
    const builder = {
      select: () => builder,
      order: () => Promise.resolve({ data: tables[table] ?? null, error: null }),
      eq: (column: string, value: unknown) => {
        filters.push({ table, column, value });
        return builder;
      },
      maybeSingle: () => Promise.resolve({ data: tables[table] ?? null, error: null }),
    };
    return builder;
  });

  return { client: { from } as unknown as SupabaseClient, filters };
}

function input(overrides: Partial<CreateVisualizationInput>): CreateVisualizationInput {
  return { sourceKind: "outfit", sourceId: OUTFIT_ID, ...overrides } as CreateVisualizationInput;
}

describe("resolveSourceSelections", () => {
  it("returns a composition's explicit selection untouched", async () => {
    const { client } = stubClient({});
    const result = await resolveSourceSelections(
      client,
      USER_ID,
      input({ sourceKind: "composition", sourceId: null, items: SELECTIONS } as never),
    );
    expect(result).toEqual(SELECTIONS);
  });

  it("resolves a saved outfit through outfit_items, scoped to the viewer", async () => {
    const { client, filters } = stubClient({ outfit_items: SELECTIONS });
    const result = await resolveSourceSelections(client, USER_ID, input({ sourceKind: "outfit" }));

    expect(result).toEqual(SELECTIONS);
    expect(filters).toContainEqual({ table: "outfit_items", column: "user_id", value: USER_ID });
    expect(filters).toContainEqual({
      table: "outfit_items",
      column: "outfit_id",
      value: OUTFIT_ID,
    });
  });

  it("resolves a generated candidate through outfit_candidate_items", async () => {
    const { client, filters } = stubClient({ outfit_candidate_items: SELECTIONS });
    const result = await resolveSourceSelections(
      client,
      USER_ID,
      input({ sourceKind: "candidate", sourceId: CANDIDATE_ID }),
    );

    expect(result).toEqual(SELECTIONS);
    expect(filters).toContainEqual({
      table: "outfit_candidate_items",
      column: "candidate_id",
      value: CANDIDATE_ID,
    });
  });

  it("resolves a plan through its outfit, scoping both lookups to the viewer", async () => {
    const { client, filters } = stubClient({
      outfit_plans: { outfit_id: OUTFIT_ID },
      outfit_items: SELECTIONS,
    });
    const result = await resolveSourceSelections(
      client,
      USER_ID,
      input({ sourceKind: "plan", sourceId: PLAN_ID }),
    );

    expect(result).toEqual(SELECTIONS);
    expect(filters).toContainEqual({ table: "outfit_plans", column: "user_id", value: USER_ID });
    expect(filters).toContainEqual({ table: "outfit_items", column: "user_id", value: USER_ID });
  });

  it("refuses a plan that has no outfit yet rather than rendering nothing", async () => {
    const { client } = stubClient({ outfit_plans: { outfit_id: null } });
    await expect(
      resolveSourceSelections(client, USER_ID, input({ sourceKind: "plan", sourceId: PLAN_ID })),
    ).rejects.toBeInstanceOf(ApiError);
  });

  it("reports not-found rather than an empty look when the source has no items", async () => {
    const { client } = stubClient({ outfit_items: [] });
    await expect(
      resolveSourceSelections(client, USER_ID, input({ sourceKind: "outfit" })),
    ).rejects.toBeInstanceOf(ApiError);
  });
});
