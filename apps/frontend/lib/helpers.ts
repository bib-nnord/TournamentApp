/**
 * Returns a unique name by appending (2), (3), … if the trimmed name already
 * exists in the provided list. Returns null if the name is empty after trimming.
 */
export function generateUniqueName(name: string, existing: string[]): string | null {
  const trimmed = name.trim();
  if (!trimmed) return null;
  if (!existing.includes(trimmed)) return trimmed;
  let n = 2;
  while (existing.includes(`${trimmed} (${n})`)) n++;
  return `${trimmed} (${n})`;
}

/**
 * Formats a date string or Date object using toLocaleDateString.
 * Defaults to "Jan 1, 2025" style (short month, numeric day, numeric year).
 */
export function formatDate(
  date: string | Date,
  options: Intl.DateTimeFormatOptions = { year: "numeric", month: "short", day: "numeric" }
): string {
  return new Date(date).toLocaleDateString(undefined, options);
}
