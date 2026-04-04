import type { SharePricePoint } from "./types";

const DAY_IN_SECONDS = 24 * 60 * 60;
export const WEEK_IN_SECONDS = 7 * DAY_IN_SECONDS;
export const SHARE_PRICE_LOOKBACK_SECONDS = 8 * DAY_IN_SECONDS;

function sortPointsAscending(points: ReadonlyArray<SharePricePoint>): SharePricePoint[] {
  return [...points].sort((left, right) => left.x - right.x);
}

export function calculateWeeklyApyPctFromReturn(weeklyReturn: number): number {
  return ((1 + weeklyReturn) ** (365 / 7) - 1) * 100;
}

export function normalizeRollingApyDecimalToPct(value: number | null | undefined): number | null {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return null;
  }

  return value * 100;
}

export function calculateWeeklyApyPctFromSharePrices(
  points: ReadonlyArray<SharePricePoint>,
): number | null {
  const normalizedPoints = sortPointsAscending(points).filter(
    (point): point is { x: number; y: number } =>
      point.y !== null && Number.isFinite(point.x) && Number.isFinite(point.y) && point.y > 0,
  );

  if (normalizedPoints.length < 2) {
    return null;
  }

  const oldestPoint = normalizedPoints[0];
  const latestPoint = normalizedPoints[normalizedPoints.length - 1];

  if (latestPoint.x - oldestPoint.x < WEEK_IN_SECONDS) {
    return null;
  }

  const weeklyReturn = latestPoint.y / oldestPoint.y - 1;

  if (!Number.isFinite(weeklyReturn) || weeklyReturn <= -1) {
    return null;
  }

  const weeklyApyPct = calculateWeeklyApyPctFromReturn(weeklyReturn);

  return Number.isFinite(weeklyApyPct) ? weeklyApyPct : null;
}

export function normalizeV1WeeklyNetApyToPct(weeklyNetApy: number | null | undefined): number | null {
  return normalizeRollingApyDecimalToPct(weeklyNetApy);
}
