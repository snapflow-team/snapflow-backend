export function extractCancelledAt(canceledAt: number | null): Date | null {
  if (!canceledAt) return null;
  return new Date(canceledAt * 1000);
}
