export function optionValue(option: string) {
  return option.toLowerCase().replaceAll(" ", "-");
}

export function toggleSelection(
  value: string,
  selected: string[],
  setSelected: (values: string[]) => void,
) {
  setSelected(
    selected.includes(value)
      ? selected.filter((candidate) => candidate !== value)
      : [...selected, value],
  );
}
