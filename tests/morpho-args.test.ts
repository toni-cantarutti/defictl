import { describe, expect, test } from "bun:test";

import { parseMorphoCommandArgs } from "../src/morpho/args";

describe("parseMorphoCommandArgs", () => {
  test("accepts the threshold-only morpho syntax", () => {
    expect(parseMorphoCommandArgs(["5.25"])).toEqual({
      minWeeklyApyPercent: 5.25,
    });
  });

  test("accepts an asset symbol before the threshold", () => {
    expect(parseMorphoCommandArgs(["ausd", "5"])).toEqual({
      assetSymbols: ["AUSD"],
      minWeeklyApyPercent: 5,
    });
  });

  test("accepts a comma-separated asset list before the threshold", () => {
    expect(parseMorphoCommandArgs(["usdc,ausd", "5"])).toEqual({
      assetSymbols: ["USDC", "AUSD"],
      minWeeklyApyPercent: 5,
    });
  });

  test("normalizes and deduplicates a comma-separated asset list", () => {
    expect(parseMorphoCommandArgs([" usdc , AUSD , usdc ", "5"])).toEqual({
      assetSymbols: ["USDC", "AUSD"],
      minWeeklyApyPercent: 5,
    });
  });

  test("rejects reversed morpho arguments", () => {
    expect(() => parseMorphoCommandArgs(["5", "ausd"])).toThrow(
      "When providing asset filters, put them before the threshold. Use `defictl morpho usdc 5` or `defictl morpho usdc,ausd 5`.",
    );
  });

  test("rejects malformed comma-separated asset lists", () => {
    expect(() => parseMorphoCommandArgs(["usdc,,ausd", "5"])).toThrow(
      "The Morpho asset filter must be a comma-separated list like `usdc` or `usdc,ausd`.",
    );
  });

  test("rejects missing thresholds when only an asset symbol is provided", () => {
    expect(() => parseMorphoCommandArgs(["usdc"])).toThrow(
      "Use `defictl morpho <minWeeklyApyPercent>` or `defictl morpho <assetSymbols> <minWeeklyApyPercent>`, for example `defictl morpho 5`, `defictl morpho usdc 5`, or `defictl morpho usdc,ausd 5`.",
    );
  });
});
