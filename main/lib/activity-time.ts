export const ACTIVITY_TIME_ZONE = "Asia/Shanghai";

const ACTIVITY_TIME_ZONE_OFFSET = "+08:00";
const LOCAL_DATE_TIME_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/;
const OFFSET_DATE_TIME_PATTERN = /(?:Z|[+-]\d{2}:\d{2})$/i;

function parseLocalActivityDateTime(value: string, match: RegExpMatchArray) {
  const [, yearValue, monthValue, dayValue, hourValue, minuteValue, secondValue = "0", millisecondValue = "0"] = match;
  const parts = {
    year: Number(yearValue),
    month: Number(monthValue),
    day: Number(dayValue),
    hour: Number(hourValue),
    minute: Number(minuteValue),
    second: Number(secondValue),
    millisecond: Number(millisecondValue.padEnd(3, "0")),
  };
  const date = new Date(`${value}${ACTIVITY_TIME_ZONE_OFFSET}`);
  const shanghaiWallClock = new Date(date.getTime() + 8 * 60 * 60 * 1000);

  if (
    Number.isNaN(date.getTime()) ||
    shanghaiWallClock.getUTCFullYear() !== parts.year ||
    shanghaiWallClock.getUTCMonth() + 1 !== parts.month ||
    shanghaiWallClock.getUTCDate() !== parts.day ||
    shanghaiWallClock.getUTCHours() !== parts.hour ||
    shanghaiWallClock.getUTCMinutes() !== parts.minute ||
    shanghaiWallClock.getUTCSeconds() !== parts.second ||
    shanghaiWallClock.getUTCMilliseconds() !== parts.millisecond
  ) {
    throw new Error("Invalid activity time");
  }

  return date;
}

export function parseActivityDateTime(value: unknown): Date | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") throw new Error("Invalid activity time");

  const localMatch = value.match(LOCAL_DATE_TIME_PATTERN);
  if (localMatch) return parseLocalActivityDateTime(value, localMatch);
  if (!OFFSET_DATE_TIME_PATTERN.test(value)) throw new Error("Activity time must include a timezone");

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("Invalid activity time");
  return date;
}

export function activityDateTimeToISOString(value: string) {
  const date = parseActivityDateTime(value);
  if (!date) return undefined;
  return date.toISOString();
}

export function formatActivityDateTime(value: string | Date | null | undefined, locale: string) {
  if (!value) return "-";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat(locale, {
    timeZone: ACTIVITY_TIME_ZONE,
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(date);
}

export function formatActivityDate(value: string | Date | null | undefined, locale: string) {
  if (!value) return "-";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat(locale, {
    timeZone: ACTIVITY_TIME_ZONE,
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}
