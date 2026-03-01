interface LocalDateTimeParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}

export function getEffectiveLocalDate(now: Date, timezone: string, dayCutoffMinutes: number): string {
  const parts = toLocalParts(now, timezone);
  const currentMinutes = parts.hour * 60 + parts.minute;
  const cutoff = normalizeCutoff(dayCutoffMinutes);

  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));

  if (currentMinutes < cutoff) {
    date.setUTCDate(date.getUTCDate() - 1);
  }

  return date.toISOString().slice(0, 10);
}

export function shiftDateLocal(dateLocal: string, days: number): string {
  const date = new Date(`${dateLocal}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function toLocalParts(now: Date, timezone: string): LocalDateTimeParts {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  });

  const parts = formatter.formatToParts(now);

  const getValue = (type: Intl.DateTimeFormatPartTypes): number => {
    const value = parts.find((part) => part.type === type)?.value;
    return value ? Number(value) : 0;
  };

  return {
    year: getValue("year"),
    month: getValue("month"),
    day: getValue("day"),
    hour: getValue("hour"),
    minute: getValue("minute")
  };
}

export function getWeekStartDate(dateLocal: string): string {
  const date = new Date(`${dateLocal}T00:00:00Z`);
  const day = date.getUTCDay();
  const delta = day === 0 ? -6 : 1 - day;
  date.setUTCDate(date.getUTCDate() + delta);
  return date.toISOString().slice(0, 10);
}

function normalizeCutoff(minutes: number): number {
  if (!Number.isFinite(minutes)) {
    return 0;
  }

  return Math.max(0, Math.min(1439, Math.floor(minutes)));
}
