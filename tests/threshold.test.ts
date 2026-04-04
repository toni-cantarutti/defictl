import { describe, expect, test } from "bun:test";

import { parseThresholdArg } from "../src/utils/threshold";

describe("parseThresholdArg", () => {
  test("accepts an integer percentage", () => {
    expect(parseThresholdArg("5")).toBe(5);
  });

  test("accepts a decimal percentage", () => {
    expect(parseThresholdArg("5.25")).toBe(5.25);
  });

  test("rejects negative values", () => {
    expect(() => parseThresholdArg("-1")).toThrow(
      "The APY threshold must be a non-negative number like `5` or `5.25`.",
    );
  });

  test("rejects non-numeric values", () => {
    expect(() => parseThresholdArg("abc")).toThrow(
      "The APY threshold must be a non-negative number like `5` or `5.25`.",
    );
  });
});
