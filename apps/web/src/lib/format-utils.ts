export function formatHours(h: number): string {
  return Number.isInteger(h) ? String(h) : parseFloat(h.toFixed(2)).toString();
}
