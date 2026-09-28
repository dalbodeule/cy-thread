export const suspensionDurations = ['30m', '1h', '6h', '1d', '7d', '1mo', 'permanent'] as const;
export type SuspensionDuration = (typeof suspensionDurations)[number];

export function calculateSuspensionExpiry(now: Date, duration: SuspensionDuration) {
  if (duration === 'permanent') return null;
  if (duration === '1mo') {
    const year = now.getUTCFullYear();
    const month = now.getUTCMonth() + 1;
    const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    return new Date(
      Date.UTC(
        year,
        month,
        Math.min(now.getUTCDate(), lastDay),
        now.getUTCHours(),
        now.getUTCMinutes(),
        now.getUTCSeconds(),
        now.getUTCMilliseconds()
      )
    );
  }
  const minutes = { '30m': 30, '1h': 60, '6h': 360, '1d': 1_440, '7d': 10_080 }[duration];
  return new Date(now.getTime() + minutes * 60_000);
}
