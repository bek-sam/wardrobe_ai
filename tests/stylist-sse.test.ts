import { describe, expect, it } from "vitest";

import { consumeSse } from "@/features/stylist/sse";
import { parseSseBlock } from "@/features/stylist/parse-sse-block";

describe("stylist SSE parser", () => {
  it("parses named events and ignores comments", () => {
    expect(parseSseBlock(': keepalive\r\nevent: status\r\ndata: {"state":"thinking"}')).toEqual({
      name: "status",
      data: { state: "thinking" },
    });
  });

  it("handles event boundaries split across response chunks", async () => {
    const encoder = new TextEncoder();
    const chunks = [
      'event: status\r\ndata: {"state":"think',
      'ing"}\r\n\r',
      '\nevent: result\ndata: {"outfit":{"title":"Owned look"}}\n\n',
    ];
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        chunks.forEach((chunk) => controller.enqueue(encoder.encode(chunk)));
        controller.close();
      },
    });
    const events: Array<{ name: string; data: unknown }> = [];
    await consumeSse(
      new Response(stream, { headers: { "Content-Type": "text/event-stream" } }),
      (event) => {
        events.push(event);
      },
    );
    expect(events).toEqual([
      { name: "status", data: { state: "thinking" } },
      { name: "result", data: { outfit: { title: "Owned look" } } },
    ]);
  });

  it("surfaces JSON API failures before stream parsing", async () => {
    await expect(
      consumeSse(
        new Response(JSON.stringify({ error: { message: "Sign in again." } }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }),
        () => undefined,
      ),
    ).rejects.toThrow("Sign in again.");
  });
});
