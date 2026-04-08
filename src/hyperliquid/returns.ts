import { HYPERLIQUID_RETURN_PERIODS } from "./constants";
import type {
  HyperliquidHistoryPoint,
  HyperliquidPortfolioSeriesApi,
  HyperliquidPortfolioWindow,
  HyperliquidRateRow,
  HyperliquidReturnEstimate,
  HyperliquidVaultDetailsApi,
} from "./types";

const DAY_IN_MS = 24 * 60 * 60 * 1_000;
const HYPERLIQUID_PRECISION_ORDER: readonly HyperliquidPortfolioWindow[] = [
  "day",
  "week",
  "month",
  "allTime",
] as const;
const HYPERLIQUID_ALIGNMENT_ORDER: readonly HyperliquidPortfolioWindow[] = [
  "allTime",
  "month",
  "week",
  "day",
] as const;
const HYPERLIQUID_WINDOW_PRIORITY: Readonly<Record<HyperliquidPortfolioWindow, number>> = {
  day: 0,
  week: 1,
  month: 2,
  allTime: 3,
};

function parseNumericField(value: string, fieldName: string): number {
  const parsedValue = Number(value);

  if (!Number.isFinite(parsedValue)) {
    throw new Error(`Hyperliquid API returned an invalid numeric value for ${fieldName}.`);
  }

  return parsedValue;
}

function isPrimaryPortfolioWindow(value: string): value is HyperliquidPortfolioWindow {
  return value === "day" || value === "week" || value === "month" || value === "allTime";
}

export function buildPointsByWindow(
  vaultDetails: HyperliquidVaultDetailsApi,
): Map<HyperliquidPortfolioWindow, HyperliquidHistoryPoint[]> {
  const pointsByWindow = new Map<HyperliquidPortfolioWindow, HyperliquidHistoryPoint[]>();

  for (const [window, series] of vaultDetails.portfolio) {
    if (!isPrimaryPortfolioWindow(window)) {
      continue;
    }

    pointsByWindow.set(window, buildHistoryPoints(series));
  }

  return pointsByWindow;
}

export function buildHistoryPoints(
  series: HyperliquidPortfolioSeriesApi,
): HyperliquidHistoryPoint[] {
  const pnlByTimestamp = new Map<number, number>();

  for (const [timestampMs, pnl] of series.pnlHistory) {
    pnlByTimestamp.set(timestampMs, parseNumericField(pnl, "pnlHistory"));
  }

  return series.accountValueHistory
    .flatMap(([timestampMs, accountValue]) => {
      const pnl = pnlByTimestamp.get(timestampMs);

      if (pnl === undefined) {
        return [];
      }

      return [{
        timestampMs,
        accountValue: parseNumericField(accountValue, "accountValueHistory"),
        pnl,
      }];
    })
    .sort((left, right) => left.timestampMs - right.timestampMs);
}

function findStartIndex(
  points: ReadonlyArray<HyperliquidHistoryPoint>,
  targetStartTimestamp: number,
): number {
  let startIndex = -1;

  for (let index = 0; index < points.length; index += 1) {
    if (points[index].timestampMs <= targetStartTimestamp) {
      startIndex = index;
      continue;
    }

    break;
  }

  return startIndex;
}

function calculateTimeWeightedReturnFromStartIndex(
  points: ReadonlyArray<HyperliquidHistoryPoint>,
  startIndex: number,
): HyperliquidReturnEstimate | null {
  if (points.length < 2) {
    return null;
  }

  const endPoint = points[points.length - 1];

  if (startIndex < 0 || startIndex >= points.length - 1) {
    return null;
  }

  let compoundedReturn = 1;

  for (let index = startIndex + 1; index < points.length; index += 1) {
    const previousPoint = points[index - 1];
    const currentPoint = points[index];

    if (previousPoint.accountValue <= 0) {
      return null;
    }

    const pnlDelta = currentPoint.pnl - previousPoint.pnl;
    const externalFlowEstimate =
      (currentPoint.accountValue - previousPoint.accountValue) - pnlDelta;

    // Hyperliquid does not expose a share-price history for vaults. We estimate
    // the net external cash flow over each interval as delta account value minus
    // delta pnl, then remove that flow before chaining the interval return.
    // This assumes the flow lands after the interval's performance, which is the
    // closest TWR-style approximation available from the public snapshot data.
    const accountValueExcludingFlow = currentPoint.accountValue - externalFlowEstimate;
    const intervalReturn = (accountValueExcludingFlow / previousPoint.accountValue) - 1;

    if (!Number.isFinite(intervalReturn) || intervalReturn <= -1) {
      return null;
    }

    compoundedReturn *= 1 + intervalReturn;
  }

  return {
    endTimestampMs: endPoint.timestampMs,
    returnPct: (compoundedReturn - 1) * 100,
    startTimestampMs: points[startIndex].timestampMs,
  };
}

export function estimateTimeWeightedReturn(
  points: ReadonlyArray<HyperliquidHistoryPoint>,
  lookbackMs: number,
): HyperliquidReturnEstimate | null {
  if (points.length < 2) {
    return null;
  }

  const endPoint = points[points.length - 1];
  const targetStartTimestamp = endPoint.timestampMs - lookbackMs;

  return calculateTimeWeightedReturnFromStartIndex(
    points,
    findStartIndex(points, targetStartTimestamp),
  );
}

export function estimateTimeWeightedReturnFromTimestamp(
  points: ReadonlyArray<HyperliquidHistoryPoint>,
  startTimestampMs: number,
): HyperliquidReturnEstimate | null {
  return calculateTimeWeightedReturnFromStartIndex(
    points,
    findStartIndex(points, startTimestampMs),
  );
}

export function estimateTimeWeightedReturnPct(
  points: ReadonlyArray<HyperliquidHistoryPoint>,
  lookbackMs: number,
): number | null {
  return estimateTimeWeightedReturn(points, lookbackMs)?.returnPct ?? null;
}

function alignPointsToReference(
  points: ReadonlyArray<HyperliquidHistoryPoint>,
  referencePoints: ReadonlyArray<HyperliquidHistoryPoint>,
): HyperliquidHistoryPoint[] | null {
  const referencePnlByTimestamp = new Map(
    referencePoints.map((point) => [point.timestampMs, point.pnl]),
  );

  const anchorPoint = points.find((point) => referencePnlByTimestamp.has(point.timestampMs));

  if (anchorPoint === undefined) {
    return null;
  }

  const referencePnl = referencePnlByTimestamp.get(anchorPoint.timestampMs);

  if (referencePnl === undefined) {
    return null;
  }

  // Hyperliquid rebases pnlHistory within each portfolio window. When two
  // windows share a timestamp, we can recover a consistent cumulative pnl scale
  // by offsetting the finer window to the already-normalized reference window.
  const pnlOffset = referencePnl - anchorPoint.pnl;

  return points.map((point) => ({
    ...point,
    pnl: point.pnl + pnlOffset,
  }));
}

function buildNormalizedPointsByWindow(
  pointsByWindow: ReadonlyMap<HyperliquidPortfolioWindow, ReadonlyArray<HyperliquidHistoryPoint>>,
): Map<HyperliquidPortfolioWindow, HyperliquidHistoryPoint[]> {
  const normalizedPointsByWindow = new Map<HyperliquidPortfolioWindow, HyperliquidHistoryPoint[]>();
  const seedWindow = HYPERLIQUID_ALIGNMENT_ORDER.find(
    (window) => (pointsByWindow.get(window)?.length ?? 0) > 0,
  );

  if (seedWindow === undefined) {
    return normalizedPointsByWindow;
  }

  normalizedPointsByWindow.set(seedWindow, [...(pointsByWindow.get(seedWindow) ?? [])]);

  const seedIndex = HYPERLIQUID_ALIGNMENT_ORDER.indexOf(seedWindow);

  for (let windowIndex = seedIndex + 1; windowIndex < HYPERLIQUID_ALIGNMENT_ORDER.length; windowIndex += 1) {
    const window = HYPERLIQUID_ALIGNMENT_ORDER[windowIndex];
    const rawPoints = pointsByWindow.get(window);

    if (rawPoints === undefined || rawPoints.length === 0) {
      continue;
    }

    let alignedPoints: HyperliquidHistoryPoint[] | null = null;

    for (let anchorIndex = windowIndex - 1; anchorIndex >= seedIndex; anchorIndex -= 1) {
      const anchorWindow = HYPERLIQUID_ALIGNMENT_ORDER[anchorIndex];
      const anchorPoints = normalizedPointsByWindow.get(anchorWindow);

      if (anchorPoints === undefined || anchorPoints.length === 0) {
        continue;
      }

      alignedPoints = alignPointsToReference(rawPoints, anchorPoints);

      if (alignedPoints !== null) {
        normalizedPointsByWindow.set(window, alignedPoints);
        break;
      }
    }
  }

  return normalizedPointsByWindow;
}

export function buildBestAvailableHistoryPoints(
  pointsByWindow: ReadonlyMap<HyperliquidPortfolioWindow, ReadonlyArray<HyperliquidHistoryPoint>>,
): HyperliquidHistoryPoint[] {
  const normalizedPointsByWindow = buildNormalizedPointsByWindow(pointsByWindow);
  const pointsByTimestamp = new Map<
    number,
    { point: HyperliquidHistoryPoint; priority: number }
  >();

  for (const window of HYPERLIQUID_PRECISION_ORDER) {
    const priority = HYPERLIQUID_WINDOW_PRIORITY[window];
    const points = normalizedPointsByWindow.get(window) ?? [];

    for (const point of points) {
      const existingPoint = pointsByTimestamp.get(point.timestampMs);

      if (existingPoint === undefined || priority < existingPoint.priority) {
        pointsByTimestamp.set(point.timestampMs, {
          point,
          priority,
        });
      }
    }
  }

  return [...pointsByTimestamp.values()]
    .map((entry) => entry.point)
    .sort((left, right) => left.timestampMs - right.timestampMs);
}

function selectMostPreciseReturnEstimate(
  pointsByWindow: ReadonlyMap<HyperliquidPortfolioWindow, ReadonlyArray<HyperliquidHistoryPoint>>,
  estimateBuilder: (
    points: ReadonlyArray<HyperliquidHistoryPoint>,
  ) => HyperliquidReturnEstimate | null,
): HyperliquidReturnEstimate | null {
  return estimateBuilder(buildBestAvailableHistoryPoints(pointsByWindow));
}

export function selectMostPreciseReturnEstimateForLookback(
  pointsByWindow: ReadonlyMap<HyperliquidPortfolioWindow, ReadonlyArray<HyperliquidHistoryPoint>>,
  lookbackMs: number,
): HyperliquidReturnEstimate | null {
  return selectMostPreciseReturnEstimate(
    pointsByWindow,
    (points) => estimateTimeWeightedReturn(points, lookbackMs),
  );
}

export function selectMostPreciseReturnEstimateFromTimestamp(
  pointsByWindow: ReadonlyMap<HyperliquidPortfolioWindow, ReadonlyArray<HyperliquidHistoryPoint>>,
  startTimestampMs: number,
): HyperliquidReturnEstimate | null {
  return selectMostPreciseReturnEstimate(
    pointsByWindow,
    (points) => estimateTimeWeightedReturnFromTimestamp(points, startTimestampMs),
  );
}

export function annualizeReturnToApyPct(
  returnPct: number,
  periodDays: number,
): number | null {
  if (!Number.isFinite(returnPct) || periodDays <= 0) {
    return null;
  }

  const grossReturn = 1 + (returnPct / 100);

  if (grossReturn <= 0) {
    return null;
  }

  return ((grossReturn ** (365 / periodDays)) - 1) * 100;
}

export function annualizeReturnToAprPct(
  returnPct: number,
  periodMs: number,
): number | null {
  if (!Number.isFinite(returnPct) || periodMs <= 0) {
    return null;
  }

  return returnPct * ((365 * DAY_IN_MS) / periodMs);
}

export function buildHyperliquidReturnRows(
  vaultDetails: HyperliquidVaultDetailsApi,
): HyperliquidRateRow[] {
  const pointsByWindow = buildPointsByWindow(vaultDetails);

  return HYPERLIQUID_RETURN_PERIODS.map((period) => ({
    periodLabel: period.label,
    ratePct: (() => {
      const returnEstimate = selectMostPreciseReturnEstimateForLookback(
        pointsByWindow,
        period.lookbackMs,
      );

      return returnEstimate === null
        ? null
        : annualizeReturnToApyPct(returnEstimate.returnPct, period.lookbackDays);
    })(),
  }));
}

export function buildHyperliquidSinceDateAprRow(
  vaultDetails: HyperliquidVaultDetailsApi,
  startTimestampMs: number,
  displayLabel: string,
): HyperliquidRateRow {
  const pointsByWindow = buildPointsByWindow(vaultDetails);
  const returnEstimate = selectMostPreciseReturnEstimateFromTimestamp(
    pointsByWindow,
    startTimestampMs,
  );

  return {
    periodLabel: `Since ${displayLabel}`,
    ratePct: returnEstimate === null
      ? null
      : annualizeReturnToAprPct(
          returnEstimate.returnPct,
          returnEstimate.endTimestampMs - returnEstimate.startTimestampMs,
        ),
  };
}
