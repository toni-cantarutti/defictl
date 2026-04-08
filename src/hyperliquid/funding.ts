import { HYPERLIQUID_RETURN_PERIODS } from "./constants";
import type {
  HyperliquidFundingHistoryEntryApi,
  HyperliquidFundingRatePoint,
  HyperliquidPerpMetaApi,
  HyperliquidRateRow,
} from "./types";

const HOURS_PER_YEAR = 24 * 365;
const FUNDING_INTERVAL_MS = 60 * 60 * 1_000;
const FUNDING_INTERVAL_TOLERANCE_MS = 5 * 60 * 1_000;

function parseNumericField(value: string, fieldName: string): number {
  const parsedValue = Number(value);

  if (!Number.isFinite(parsedValue)) {
    throw new Error(`Hyperliquid API returned an invalid numeric value for ${fieldName}.`);
  }

  return parsedValue;
}

function normalizeMarketAlias(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function buildMarketAliases(canonicalName: string): Set<string> {
  const aliases = new Set<string>();
  const addAlias = (value: string): void => {
    const normalizedValue = normalizeMarketAlias(value);

    if (normalizedValue.length > 0) {
      aliases.add(normalizedValue);
    }
  };
  const baseName = canonicalName.includes(":")
    ? canonicalName.slice(canonicalName.indexOf(":") + 1)
    : canonicalName;

  addAlias(canonicalName);
  addAlias(baseName);
  addAlias(`${baseName}usd`);
  addAlias(`${baseName}usdc`);

  return aliases;
}

export function buildFundingRatePoints(
  fundingHistory: ReadonlyArray<HyperliquidFundingHistoryEntryApi>,
): HyperliquidFundingRatePoint[] {
  return fundingHistory
    .map((entry) => ({
      fundingRate: parseNumericField(entry.fundingRate, "fundingRate"),
      timestampMs: entry.time,
    }))
    .sort((left, right) => left.timestampMs - right.timestampMs);
}

export function annualizeAverageFundingRateToAprPct(
  averageFundingRate: number,
): number | null {
  if (!Number.isFinite(averageFundingRate)) {
    return null;
  }

  return averageFundingRate * HOURS_PER_YEAR * 100;
}

export function estimateAverageFundingRate(
  points: ReadonlyArray<HyperliquidFundingRatePoint>,
  lookbackMs: number,
): number | null {
  if (points.length === 0 || lookbackMs <= 0) {
    return null;
  }

  const requiredPointCount = Math.round(lookbackMs / FUNDING_INTERVAL_MS);

  if (requiredPointCount <= 0 || points.length < requiredPointCount) {
    return null;
  }

  const periodPoints = points.slice(-requiredPointCount);
  const firstTimestampMs = periodPoints[0]?.timestampMs;
  const lastTimestampMs = periodPoints[periodPoints.length - 1]?.timestampMs;

  if (firstTimestampMs === undefined || lastTimestampMs === undefined) {
    return null;
  }

  const expectedSpanMs = (requiredPointCount - 1) * FUNDING_INTERVAL_MS;
  const actualSpanMs = lastTimestampMs - firstTimestampMs;

  if (actualSpanMs > expectedSpanMs + FUNDING_INTERVAL_TOLERANCE_MS) {
    return null;
  }

  const averageFundingRate =
    periodPoints.reduce((sum, point) => sum + point.fundingRate, 0) / periodPoints.length;

  return Number.isFinite(averageFundingRate) ? averageFundingRate : null;
}

export function buildHyperliquidFundingRateRows(
  fundingHistory: ReadonlyArray<HyperliquidFundingHistoryEntryApi>,
): HyperliquidRateRow[] {
  const points = buildFundingRatePoints(fundingHistory);

  return HYPERLIQUID_RETURN_PERIODS.map((period) => ({
    periodLabel: period.label,
    ratePct: (() => {
      const averageFundingRate = estimateAverageFundingRate(points, period.lookbackMs);

      return averageFundingRate === null
        ? null
        : annualizeAverageFundingRateToAprPct(averageFundingRate);
    })(),
  }));
}

export function resolveHyperliquidPerpMarket(
  pair: string,
  allPerpMetas: ReadonlyArray<HyperliquidPerpMetaApi>,
): string {
  const trimmedPair = pair.trim();

  if (trimmedPair.length === 0) {
    throw new Error("The Hyperliquid pair must not be empty.");
  }

  const markets = allPerpMetas
    .flatMap((meta) => Array.isArray(meta.universe) ? meta.universe : [])
    .filter((market) => typeof market?.name === "string")
    .map((market) => ({
      isDelisted: market.isDelisted === true,
      name: market.name,
    }));
  const exactMatch = markets.find(
    (market) => market.name.toLowerCase() === trimmedPair.toLowerCase(),
  );

  if (exactMatch !== undefined) {
    return exactMatch.name;
  }

  const normalizedPair = normalizeMarketAlias(trimmedPair);
  const matchingMarkets = markets.filter((market) => (
    buildMarketAliases(market.name).has(normalizedPair)
  ));
  const preferredMarkets = matchingMarkets.filter((market) => !market.isDelisted);
  const candidates = preferredMarkets.length > 0 ? preferredMarkets : matchingMarkets;
  const candidateNames = [...new Set(candidates.map((market) => market.name))];

  if (candidateNames.length === 1) {
    return candidateNames[0];
  }

  if (candidateNames.length > 1) {
    throw new Error(
      `Hyperliquid pair \`${pair}\` is ambiguous. Use one of: ${candidateNames.map((name) => `\`${name}\``).join(", ")}.`,
    );
  }

  throw new Error(
    `Unable to resolve Hyperliquid pair \`${pair}\`. Try a canonical market name such as \`BTC\` or \`xyz:EUR\`.`,
  );
}
