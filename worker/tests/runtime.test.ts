import { describe, expect, it, vi } from "vitest";

import { runWorker } from "../src/runtime.js";

describe("worker runtime", () => {
  it("stops cooperatively after the current bounded poll", async () => {
    const controller = new AbortController();
    const poll = vi.fn(async () => {
      controller.abort();
      return 1;
    });

    await runWorker({ signal: controller.signal, poll });

    expect(poll).toHaveBeenCalledOnce();
  });

  it("reports a poll error and remains abortable", async () => {
    const controller = new AbortController();
    const onPollError = vi.fn(() => controller.abort());

    await runWorker({
      signal: controller.signal,
      poll: async () => {
        throw new Error("temporary queue failure");
      },
      onPollError,
    });

    expect(onPollError).toHaveBeenCalledOnce();
  });
});
