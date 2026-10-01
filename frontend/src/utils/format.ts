export function formatRuntime(minutes: number | null): string | null {
  if (!minutes || minutes <= 0) return null;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} min`;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

export function formatRating(value: number | null): string | null {
  if (value === null || value === undefined || value <= 0) return null;
  return value.toFixed(1);
}

export function formatLanguage(code: string): string {
  if (!code) return "";
  try {
    return new Intl.DisplayNames(["es"], { type: "language" }).of(code) ?? code.toUpperCase();
  } catch {
    return code.toUpperCase();
  }
}
