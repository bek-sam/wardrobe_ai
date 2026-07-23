export function parseHexColor(value: string): [number, number, number] | null {
  const normalized = value.trim().toLowerCase();
  const expanded = /^#[0-9a-f]{3}$/.test(normalized)
    ? `#${normalized
        .slice(1)
        .split("")
        .map((character) => character.repeat(2))
        .join("")}`
    : normalized;
  if (!/^#[0-9a-f]{6}$/.test(expanded)) return null;

  return [
    Number.parseInt(expanded.slice(1, 3), 16),
    Number.parseInt(expanded.slice(3, 5), 16),
    Number.parseInt(expanded.slice(5, 7), 16),
  ];
}
