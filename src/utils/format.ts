export function formatLabel(value: string | null | undefined, fallback = "-") {
  if (!value || value.trim().length === 0) {
    return fallback;
  }

  return value;
}
