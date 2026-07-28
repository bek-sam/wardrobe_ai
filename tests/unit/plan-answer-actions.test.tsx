import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const requestJson = vi.fn();
vi.mock("@/lib/api/request", () => ({ requestJson }));

const { PlanAnswerActions } = await import("@/features/stylist/components/PlanAnswerActions");

const generationId = "3f1d6b2e-1c4a-4f38-9b53-1e0f2a7c9d10";

/** Resolves only when the test decides to, so the pending state is observable. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((resolveFn, rejectFn) => {
    resolve = resolveFn;
    reject = rejectFn;
  });
  return { promise, resolve, reject };
}

describe("plan save action", () => {
  beforeEach(() => requestJson.mockReset());

  it("offers to save an unsaved plan", () => {
    render(<PlanAnswerActions generationId={generationId} initiallySaved={false} />);
    expect(screen.getByRole("button", { name: /save plan/i })).toBeEnabled();
    expect(screen.queryByText(/plan saved/i)).not.toBeInTheDocument();
  });

  it("shows an already-saved plan as saved and offers no action", () => {
    render(<PlanAnswerActions generationId={generationId} initiallySaved />);
    expect(screen.getByRole("status")).toHaveTextContent(/plan saved/i);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("sends only the generation id, never plan items", async () => {
    requestJson.mockResolvedValue({ generationId, saved: true });
    render(<PlanAnswerActions generationId={generationId} initiallySaved={false} />);

    await userEvent.click(screen.getByRole("button", { name: /save plan/i }));

    await waitFor(() => expect(requestJson).toHaveBeenCalledTimes(1));
    const [url, options] = requestJson.mock.calls[0] ?? [];
    expect(url).toBe("/api/plans/generated");
    expect(options).toMatchObject({ method: "POST" });
    expect(JSON.parse((options as { body: string }).body)).toEqual({ generationId });
  });

  it("disables the action while the save is in flight", async () => {
    const pending = deferred<{ saved: boolean }>();
    requestJson.mockReturnValue(pending.promise);
    render(<PlanAnswerActions generationId={generationId} initiallySaved={false} />);

    await userEvent.click(screen.getByRole("button", { name: /save plan/i }));

    const saving = await screen.findByRole("button", { name: /saving plan/i });
    expect(saving).toBeDisabled();

    pending.resolve({ saved: true });
    await screen.findByRole("status");
  });

  it("becomes 'Plan saved' on success", async () => {
    requestJson.mockResolvedValue({ generationId, saved: true });
    render(<PlanAnswerActions generationId={generationId} initiallySaved={false} />);

    await userEvent.click(screen.getByRole("button", { name: /save plan/i }));

    expect(await screen.findByRole("status")).toHaveTextContent(/plan saved/i);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("surfaces an actionable inline error and keeps the action available", async () => {
    requestJson.mockRejectedValueOnce(new Error("This plan can no longer be saved safely."));
    render(<PlanAnswerActions generationId={generationId} initiallySaved={false} />);

    await userEvent.click(screen.getByRole("button", { name: /save plan/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "This plan can no longer be saved safely.",
    );
    expect(requestJson).toHaveBeenCalledTimes(1);
    // Still offered, so a transient failure can be retried.
    expect(screen.getByRole("button", { name: /save plan/i })).toBeEnabled();
  });

  it("does not fire a second request while one is already running", async () => {
    const pending = deferred<{ saved: boolean }>();
    requestJson.mockReturnValue(pending.promise);
    render(<PlanAnswerActions generationId={generationId} initiallySaved={false} />);

    const button = screen.getByRole("button", { name: /save plan/i });
    await userEvent.click(button);
    await userEvent.click(button).catch(() => undefined);

    expect(requestJson).toHaveBeenCalledTimes(1);
    pending.resolve({ saved: true });
    await screen.findByRole("status");
  });

  it("clears a previous error when a retry succeeds", async () => {
    requestJson.mockRejectedValueOnce(new Error("Temporary failure."));
    requestJson.mockResolvedValueOnce({ generationId, saved: true });
    render(<PlanAnswerActions generationId={generationId} initiallySaved={false} />);

    await userEvent.click(screen.getByRole("button", { name: /save plan/i }));
    expect(await screen.findByRole("alert")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /save plan/i }));
    expect(await screen.findByRole("status")).toHaveTextContent(/plan saved/i);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
