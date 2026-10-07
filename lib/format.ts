/** `"09:00"` → `"9:00 AM"`; `"24:00"` is treated as midnight. */
export function formatClock(time: string): string {
  const match = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
  if (!match) return time;
  const rawHour = Number(match[1]);
  const minutes = match[2];
  const hour24 = rawHour === 24 ? 0 : rawHour;
  if (hour24 > 23) return time;
  const suffix = hour24 >= 12 ? "PM" : "AM";
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${hour12}:${minutes} ${suffix}`;
}

/** `900` → `"900 m"`, `1840` → `"1.8 km"`. */
export function formatMeters(meters: number): string {
  if (meters < 1000) return `${Math.round(meters / 10) * 10} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}
