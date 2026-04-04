export interface ParsedHyperliquidDate {
  displayLabel: string;
  rawValue: string;
  startTimestampMs: number;
}

function padDatePart(value: number): string {
  return value.toString().padStart(2, "0");
}

export function parseHyperliquidDateArg(
  value: string,
  nowTimestampMs = Date.now(),
): ParsedHyperliquidDate {
  const trimmedValue = value.trim();
  const match = /^(\d{4})(\d{2})(\d{2})(?:-(\d{2})(\d{2})(\d{2}))?$/.exec(trimmedValue);

  if (match === null) {
    throw new Error(
      "The Hyperliquid start value must use `YYYYMMDD` or `YYYYMMDD-HHmmss`, for example `20260318` or `20260318-151515`.",
    );
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = match[4] === undefined ? 0 : Number(match[4]);
  const minute = match[5] === undefined ? 0 : Number(match[5]);
  const second = match[6] === undefined ? 0 : Number(match[6]);
  const hasExplicitTime = match[4] !== undefined;
  const startTimestampMs = Date.UTC(year, month - 1, day, hour, minute, second);
  const parsedDate = new Date(startTimestampMs);

  if (
    parsedDate.getUTCFullYear() !== year ||
    parsedDate.getUTCMonth() !== month - 1 ||
    parsedDate.getUTCDate() !== day ||
    parsedDate.getUTCHours() !== hour ||
    parsedDate.getUTCMinutes() !== minute ||
    parsedDate.getUTCSeconds() !== second
  ) {
    throw new Error("The Hyperliquid start value is not a valid UTC date/time.");
  }

  if (startTimestampMs > nowTimestampMs) {
    throw new Error("The Hyperliquid start value cannot be in the future.");
  }

  return {
    displayLabel: hasExplicitTime
      ? `${year}-${padDatePart(month)}-${padDatePart(day)} ${padDatePart(hour)}:${padDatePart(minute)}:${padDatePart(second)} UTC`
      : `${year}-${padDatePart(month)}-${padDatePart(day)}`,
    rawValue: trimmedValue,
    startTimestampMs,
  };
}
