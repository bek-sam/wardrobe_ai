export class TodayRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: string | null,
    message: string,
  ) {
    super(message);
    this.name = "TodayRequestError";
  }
}
