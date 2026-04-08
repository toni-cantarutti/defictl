import { describe, expect, test } from "bun:test";

import {
  annualizeAverageFundingRateToAprPct,
  buildFundingRatePoints,
  buildHyperliquidFundingRateRows,
  estimateAverageFundingRate,
  resolveHyperliquidPerpMarket,
} from "../src/hyperliquid/funding";
import type {
  HyperliquidFundingHistoryEntryApi,
  HyperliquidPerpMetaApi,
} from "../src/hyperliquid/types";

const HOUR_IN_MS = 60 * 60 * 1_000;

describe("annualizeAverageFundingRateToAprPct", () => {
  test("converts an average hourly funding rate into a simple APR", () => {
    const aprPct = annualizeAverageFundingRateToAprPct(0.0000125);

    expect(aprPct).not.toBeNull();
    expect(aprPct!).toBeCloseTo(10.95, 10);
  });
});

describe("buildFundingRatePoints", () => {
  test("parses and sorts funding history points", () => {
    const points = buildFundingRatePoints([
      {
        coin: "BTC",
        fundingRate: "0.0001",
        premium: "0.0002",
        time: 2_000,
      },
      {
        coin: "BTC",
        fundingRate: "0.0002",
        premium: "0.0003",
        time: 1_000,
      },
    ]);

    expect(points).toEqual([
      { fundingRate: 0.0002, timestampMs: 1_000 },
      { fundingRate: 0.0001, timestampMs: 2_000 },
    ]);
  });
});

describe("estimateAverageFundingRate", () => {
  test("returns null when there are not enough hourly data points for the period", () => {
    const averageFundingRate = estimateAverageFundingRate(
      [
        { fundingRate: 0.0001, timestampMs: 0 },
        { fundingRate: 0.0002, timestampMs: HOUR_IN_MS },
      ],
      3 * HOUR_IN_MS,
    );

    expect(averageFundingRate).toBeNull();
  });

  test("returns null when the latest points span too much time for the period", () => {
    const averageFundingRate = estimateAverageFundingRate(
      [
        { fundingRate: 0.0001, timestampMs: 0 },
        { fundingRate: 0.0002, timestampMs: HOUR_IN_MS },
        { fundingRate: 0.0003, timestampMs: 3 * HOUR_IN_MS },
      ],
      3 * HOUR_IN_MS,
    );

    expect(averageFundingRate).toBeNull();
  });

  test("averages the latest hourly points for the requested lookback window", () => {
    const averageFundingRate = estimateAverageFundingRate(
      [
        { fundingRate: 0.0001, timestampMs: 0 },
        { fundingRate: 0.0002, timestampMs: HOUR_IN_MS },
        { fundingRate: 0.0004, timestampMs: 2 * HOUR_IN_MS },
      ],
      3 * HOUR_IN_MS,
    );

    expect(averageFundingRate).not.toBeNull();
    expect(averageFundingRate!).toBeCloseTo((0.0001 + 0.0002 + 0.0004) / 3, 10);
  });
});

describe("buildHyperliquidFundingRateRows", () => {
  test("builds annualized APR rows across the shared Hyperliquid periods", () => {
    const fundingHistory: HyperliquidFundingHistoryEntryApi[] = [];

    for (let hour = 0; hour <= 30 * 24; hour += 1) {
      fundingHistory.push({
        coin: "BTC",
        fundingRate: "0.0001",
        premium: "0",
        time: hour * HOUR_IN_MS,
      });
    }

    const rows = buildHyperliquidFundingRateRows(fundingHistory);

    expect(rows.map((row) => row.periodLabel)).toEqual([
      "1 day",
      "3 days",
      "1 week",
      "2 weeks",
      "1 month",
      "2 months",
      "3 months",
      "6 months",
      "1 year",
    ]);
    expect(rows.slice(0, 5).every((row) => row.ratePct !== null)).toBe(true);
    expect(rows.slice(0, 5).every((row) => row.ratePct !== null && Math.abs(row.ratePct - 87.6) < 1e-10)).toBe(true);
    expect(rows.slice(5).every((row) => row.ratePct === null)).toBe(true);
  });
});

describe("resolveHyperliquidPerpMarket", () => {
  const allPerpMetas: HyperliquidPerpMetaApi[] = [
    {
      universe: [
        { name: "BTC" },
        { name: "xyz:EUR" },
        { name: "xyz:TSLA" },
        { name: "flx:TSLA" },
        { name: "flx:BTC", isDelisted: true },
      ],
    },
  ];

  test("resolves a forex-style pair alias to the canonical market name", () => {
    expect(resolveHyperliquidPerpMarket("eurusd", allPerpMetas)).toBe("xyz:EUR");
  });

  test("prefers active markets over delisted aliases", () => {
    expect(resolveHyperliquidPerpMarket("btcusd", allPerpMetas)).toBe("BTC");
  });

  test("throws when an alias matches multiple active markets", () => {
    expect(() => resolveHyperliquidPerpMarket("tslausd", allPerpMetas)).toThrow(
      "Hyperliquid pair `tslausd` is ambiguous. Use one of: `xyz:TSLA`, `flx:TSLA`.",
    );
  });
});
