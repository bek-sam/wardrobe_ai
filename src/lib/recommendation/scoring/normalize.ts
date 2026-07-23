export const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
export const normalize = (value: string) => value.trim().toLowerCase();
export const asSet = (values: ReadonlySet<string> | readonly string[] | undefined) =>
  values instanceof Set ? values : new Set(values ?? []);
