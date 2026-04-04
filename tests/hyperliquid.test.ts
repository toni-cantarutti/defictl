import { describe, expect, test } from "bun:test";

import {
  annualizeReturnToAprPct,
  annualizeReturnToApyPct,
  buildBestAvailableHistoryPoints,
  buildPointsByWindow,
  buildHyperliquidSinceDateAprRow,
  buildHistoryPoints,
  buildHyperliquidReturnRows,
  estimateTimeWeightedReturn,
  estimateTimeWeightedReturnFromTimestamp,
  estimateTimeWeightedReturnPct,
  selectMostPreciseReturnEstimateForLookback,
  selectMostPreciseReturnEstimateFromTimestamp,
} from "../src/hyperliquid/returns";
import type { HyperliquidVaultDetailsApi } from "../src/hyperliquid/types";

describe("estimateTimeWeightedReturnPct", () => {
  test("neutralizes external flows while chaining interval returns", () => {
    const returnPct = estimateTimeWeightedReturnPct(
      [
        { timestampMs: 0, accountValue: 100, pnl: 0 },
        { timestampMs: 1_000, accountValue: 130, pnl: 10 },
        { timestampMs: 2_000, accountValue: 126, pnl: 6 },
      ],
      2_000,
    );

    expect(returnPct).not.toBeNull();
    expect(returnPct!).toBeCloseTo(6.6153846154, 10);
  });

  test("returns null when the lookback starts before the available history", () => {
    const returnPct = estimateTimeWeightedReturnPct(
      [
        { timestampMs: 1_000, accountValue: 100, pnl: 0 },
        { timestampMs: 2_000, accountValue: 105, pnl: 5 },
      ],
      2_000,
    );

    expect(returnPct).toBeNull();
  });
});

describe("estimateTimeWeightedReturn", () => {
  test("returns the actual start and end timestamps used for the estimate", () => {
    const estimate = estimateTimeWeightedReturn(
      [
        { timestampMs: 1_000, accountValue: 100, pnl: 0 },
        { timestampMs: 2_000, accountValue: 105, pnl: 5 },
        { timestampMs: 3_000, accountValue: 110, pnl: 10 },
      ],
      1_500,
    );

    expect(estimate).not.toBeNull();
    expect(estimate?.startTimestampMs).toBe(1_000);
    expect(estimate?.endTimestampMs).toBe(3_000);
    expect(estimate?.returnPct).toBeCloseTo(10, 10);
  });
});

describe("estimateTimeWeightedReturnFromTimestamp", () => {
  test("uses the closest earlier snapshot for the requested start date", () => {
    const estimate = estimateTimeWeightedReturnFromTimestamp(
      [
        { timestampMs: 1_000, accountValue: 100, pnl: 0 },
        { timestampMs: 2_000, accountValue: 105, pnl: 5 },
        { timestampMs: 3_000, accountValue: 110, pnl: 10 },
      ],
      2_500,
    );

    expect(estimate).toEqual({
      endTimestampMs: 3_000,
      returnPct: 4.761904761904767,
      startTimestampMs: 2_000,
    });
  });
});

describe("annualizeReturnToApyPct", () => {
  test("converts a period return into an annualized APY", () => {
    const apyPct = annualizeReturnToApyPct(10, 30);

    expect(apyPct).not.toBeNull();
    expect(apyPct!).toBeCloseTo(218.8680476905, 10);
  });

  test("returns null when annualization is not mathematically valid", () => {
    expect(annualizeReturnToApyPct(-100, 30)).toBeNull();
  });
});

describe("annualizeReturnToAprPct", () => {
  test("converts a period return into a simple annualized APR", () => {
    const aprPct = annualizeReturnToAprPct(10, 30 * 24 * 60 * 60 * 1_000);

    expect(aprPct).toBeCloseTo(121.6666666667, 10);
  });
});

describe("buildHistoryPoints", () => {
  test("joins account value and pnl points by timestamp", () => {
    const points = buildHistoryPoints({
      accountValueHistory: [
        [1_000, "100"],
        [2_000, "105"],
      ],
      pnlHistory: [
        [1_000, "0"],
        [2_000, "5"],
        [3_000, "6"],
      ],
      vlm: "0",
    });

    expect(points).toEqual([
      { timestampMs: 1_000, accountValue: 100, pnl: 0 },
      { timestampMs: 2_000, accountValue: 105, pnl: 5 },
    ]);
  });
});

describe("buildHyperliquidReturnRows", () => {
  test("uses the mapped portfolio windows and preserves the output order", () => {
    const vaultDetails: HyperliquidVaultDetailsApi = {
      name: "Test Vault",
      vaultAddress: "0x123",
      portfolio: [
        [
          "day",
          {
            accountValueHistory: [
              [1_000, "100"],
              [2_000, "101"],
            ],
            pnlHistory: [
              [1_000, "0"],
              [2_000, "1"],
            ],
            vlm: "0",
          },
        ],
        [
          "week",
          {
            accountValueHistory: [
              [0, "100"],
              [1_000, "102"],
              [2_000, "101"],
            ],
            pnlHistory: [
              [0, "0"],
              [1_000, "2"],
              [2_000, "1"],
            ],
            vlm: "0",
          },
        ],
        [
          "month",
          {
            accountValueHistory: [
              [0, "100"],
              [1_000, "103"],
              [2_000, "105"],
            ],
            pnlHistory: [
              [0, "0"],
              [1_000, "3"],
              [2_000, "5"],
            ],
            vlm: "0",
          },
        ],
        [
          "allTime",
          {
            accountValueHistory: [
              [0, "100"],
              [1_000, "104"],
              [2_000, "106"],
            ],
            pnlHistory: [
              [0, "0"],
              [1_000, "4"],
              [2_000, "6"],
            ],
            vlm: "0",
          },
        ],
      ],
    };

    const rows = buildHyperliquidReturnRows(vaultDetails);

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
    expect(rows.every((row) => row.apyPct === null)).toBe(true);
  });

  test("builds a since-date APR row from the all-time portfolio", () => {
    const vaultDetails: HyperliquidVaultDetailsApi = {
      name: "Test Vault",
      vaultAddress: "0x123",
      portfolio: [
        [
          "allTime",
          {
            accountValueHistory: [
              [1_000, "100"],
              [2_000, "105"],
              [3_000, "110"],
            ],
            pnlHistory: [
              [1_000, "0"],
              [2_000, "5"],
              [3_000, "10"],
            ],
            vlm: "0",
          },
        ],
      ],
    };

    const row = buildHyperliquidSinceDateAprRow(vaultDetails, 2_500, "2026-03-18");

    expect(row.periodLabel).toBe("Since 2026-03-18");
    expect(row.apyPct).not.toBeNull();
    expect(row.apyPct!).toBeCloseTo(150171428.57142875, 10);
  });

  test("merges finer recent history into longer-range calculations", () => {
    const vaultDetails: HyperliquidVaultDetailsApi = {
      name: "Test Vault",
      vaultAddress: "0x123",
      portfolio: [
        [
          "month",
          {
            accountValueHistory: [
              [4_000, "160"],
              [5_000, "170"],
            ],
            pnlHistory: [
              [4_000, "20"],
              [5_000, "25"],
            ],
            vlm: "0",
          },
        ],
        [
          "allTime",
          {
            accountValueHistory: [
              [0, "100"],
              [5_000, "170"],
            ],
            pnlHistory: [
              [0, "0"],
              [5_000, "25"],
            ],
            vlm: "0",
          },
        ],
      ],
    };

    const mergedPoints = buildBestAvailableHistoryPoints(buildPointsByWindow(vaultDetails));
    const estimate = estimateTimeWeightedReturn(mergedPoints, 5_000);

    expect(mergedPoints.map((point) => point.timestampMs)).toEqual([0, 4_000, 5_000]);
    expect(estimate).not.toBeNull();
    expect(estimate?.returnPct).toBeCloseTo(23.750000000000004, 10);
  });

  test("chooses the finest series that covers a requested start timestamp", () => {
    const expectedPoints = [
      { timestampMs: 0, accountValue: 100, pnl: 0 },
      { timestampMs: 1_000, accountValue: 101, pnl: 1 },
      { timestampMs: 2_000, accountValue: 103, pnl: 3 },
      { timestampMs: 3_000, accountValue: 105, pnl: 5 },
      { timestampMs: 3_500, accountValue: 116, pnl: 6 },
      { timestampMs: 4_000, accountValue: 118, pnl: 8 },
      { timestampMs: 4_500, accountValue: 119.5, pnl: 9.5 },
      { timestampMs: 5_000, accountValue: 121, pnl: 11 },
    ];
    const vaultDetails: HyperliquidVaultDetailsApi = {
      name: "Test Vault",
      vaultAddress: "0x123",
      portfolio: [
        [
          "week",
          {
            accountValueHistory: [
              [3_000, "105"],
              [3_500, "116"],
              [4_000, "118"],
              [4_500, "119.5"],
              [5_000, "121"],
            ],
            pnlHistory: [
              [3_000, "0"],
              [3_500, "1"],
              [4_000, "3"],
              [4_500, "4.5"],
              [5_000, "6"],
            ],
            vlm: "0",
          },
        ],
        [
          "month",
          {
            accountValueHistory: [
              [1_000, "101"],
              [2_000, "103"],
              [3_000, "105"],
              [4_000, "118"],
              [5_000, "121"],
            ],
            pnlHistory: [
              [1_000, "0"],
              [2_000, "2"],
              [3_000, "4"],
              [4_000, "7"],
              [5_000, "10"],
            ],
            vlm: "0",
          },
        ],
        [
          "allTime",
          {
            accountValueHistory: [
              [0, "100"],
              [5_000, "121"],
            ],
            pnlHistory: [
              [0, "0"],
              [5_000, "11"],
            ],
            vlm: "0",
          },
        ],
      ],
    };
    const pointsByWindow = buildPointsByWindow(vaultDetails);
    const mergedPoints = buildBestAvailableHistoryPoints(pointsByWindow);
    const estimate = selectMostPreciseReturnEstimateFromTimestamp(pointsByWindow, 2_500);
    const expectedEstimate = estimateTimeWeightedReturnFromTimestamp(expectedPoints, 2_500);

    expect(mergedPoints).toEqual(expectedPoints);
    expect(estimate).not.toBeNull();
    expect(expectedEstimate).not.toBeNull();
    expect(estimate?.startTimestampMs).toBe(expectedEstimate?.startTimestampMs);
    expect(estimate?.returnPct).toBeCloseTo(expectedEstimate!.returnPct, 10);
  });

  test("chooses the finest series that covers a requested lookback", () => {
    const expectedPoints = [
      { timestampMs: 0, accountValue: 100, pnl: 0 },
      { timestampMs: 1_000, accountValue: 101, pnl: 1 },
      { timestampMs: 2_000, accountValue: 103, pnl: 3 },
      { timestampMs: 3_000, accountValue: 105, pnl: 5 },
      { timestampMs: 3_500, accountValue: 116, pnl: 6 },
      { timestampMs: 4_000, accountValue: 118, pnl: 8 },
      { timestampMs: 4_500, accountValue: 119.5, pnl: 9.5 },
      { timestampMs: 5_000, accountValue: 121, pnl: 11 },
    ];
    const vaultDetails: HyperliquidVaultDetailsApi = {
      name: "Test Vault",
      vaultAddress: "0x123",
      portfolio: [
        [
          "week",
          {
            accountValueHistory: [
              [3_000, "105"],
              [3_500, "116"],
              [4_000, "118"],
              [4_500, "119.5"],
              [5_000, "121"],
            ],
            pnlHistory: [
              [3_000, "0"],
              [3_500, "1"],
              [4_000, "3"],
              [4_500, "4.5"],
              [5_000, "6"],
            ],
            vlm: "0",
          },
        ],
        [
          "month",
          {
            accountValueHistory: [
              [1_000, "101"],
              [2_000, "103"],
              [3_000, "105"],
              [4_000, "118"],
              [5_000, "121"],
            ],
            pnlHistory: [
              [1_000, "0"],
              [2_000, "2"],
              [3_000, "4"],
              [4_000, "7"],
              [5_000, "10"],
            ],
            vlm: "0",
          },
        ],
        [
          "allTime",
          {
            accountValueHistory: [
              [0, "100"],
              [5_000, "121"],
            ],
            pnlHistory: [
              [0, "0"],
              [5_000, "11"],
            ],
            vlm: "0",
          },
        ],
      ],
    };
    const pointsByWindow = buildPointsByWindow(vaultDetails);
    const mergedPoints = buildBestAvailableHistoryPoints(pointsByWindow);
    const estimate = selectMostPreciseReturnEstimateForLookback(pointsByWindow, 2_500);
    const expectedEstimate = estimateTimeWeightedReturn(expectedPoints, 2_500);

    expect(mergedPoints).toEqual(expectedPoints);
    expect(estimate).not.toBeNull();
    expect(expectedEstimate).not.toBeNull();
    expect(estimate?.startTimestampMs).toBe(expectedEstimate?.startTimestampMs);
    expect(estimate?.returnPct).toBeCloseTo(expectedEstimate!.returnPct, 10);
  });
});
