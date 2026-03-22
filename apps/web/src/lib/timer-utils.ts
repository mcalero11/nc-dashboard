export function getElapsedSeconds(startTimestamp: number): number {
  return Math.floor((Date.now() - startTimestamp) / 1000);
}

export function formatElapsedTime(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds]
    .map((n) => String(n).padStart(2, '0'))
    .join(':');
}

export function secondsToDecimalHours(totalSeconds: number): number {
  const raw = totalSeconds / 3600;
  const ceiled = Math.ceil(raw * 4) / 4;
  return Math.max(0.25, ceiled);
}
