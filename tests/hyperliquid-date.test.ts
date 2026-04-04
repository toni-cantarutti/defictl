import { describe, expect, test } from "bun:test";

import { parseHyperliquidDateArg } from "../src/hyperliquid/date";

describe("parseHyperliquidDateArg", () => {
  test("accepts a valid YYYYMMDD date", () => {
    expect(parseHyperliquidDateArg("20260318", Date.UTC(2026, 3, 4))).toEqual({
      displayLabel: "2026-03-18",
      rawValue: "20260318",
      startTimestampMs: Date.UTC(2026, 2, 18),
    });
  });

  test("treats a date-only value as midnight UTC", () => {
    expect(parseHyperliquidDateArg("20260318", Date.UTC(2026, 3, 4)).startTimestampMs).toBe(
      parseHyperliquidDateArg("20260318-000000", Date.UTC(2026, 3, 4)).startTimestampMs,
    );
  });

  test("accepts a valid YYYYMMDD-HHmmss timestamp", () => {
    expect(parseHyperliquidDateArg("20260318-151515", Date.UTC(2026, 3, 4))).toEqual({
      displayLabel: "2026-03-18 15:15:15 UTC",
      rawValue: "20260318-151515",
      startTimestampMs: Date.UTC(2026, 2, 18, 15, 15, 15),
    });
  });

  test("rejects an invalid format", () => {
    expect(() => parseHyperliquidDateArg("2026-03-18")).toThrow(
      "The Hyperliquid start value must use `YYYYMMDD` or `YYYYMMDD-HHmmss`, for example `20260318` or `20260318-151515`.",
    );
  });

  test("rejects an invalid UTC date/time", () => {
    expect(() => parseHyperliquidDateArg("20260230")).toThrow(
      "The Hyperliquid start value is not a valid UTC date/time.",
    );
  });

  test("rejects a future date", () => {
    expect(() => parseHyperliquidDateArg("20260405", Date.UTC(2026, 3, 4))).toThrow(
      "The Hyperliquid start value cannot be in the future.",
    );
  });

  test("rejects an invalid UTC time", () => {
    expect(() => parseHyperliquidDateArg("20260318-251515", Date.UTC(2026, 3, 4))).toThrow(
      "The Hyperliquid start value is not a valid UTC date/time.",
    );
  });

  test("rejects a future timestamp", () => {
    expect(() => parseHyperliquidDateArg("20260404-000001", Date.UTC(2026, 3, 4))).toThrow(
      "The Hyperliquid start value cannot be in the future.",
    );
  });
});
