import { describe, expect, test } from "bun:test";

import { calculateWeeklyApyPctFromReturn, calculateWeeklyApyPctFromSharePrices } from "../src/morpho/apy";

describe("calculateWeeklyApyPctFromSharePrices", () => {
  test("annualizes a 7-day return from share prices", () => {
    const apy = calculateWeeklyApyPctFromSharePrices([
      { x: 0, y: 1.0 },
      { x: 7 * 24 * 60 * 60, y: 1.01 },
    ]);

    expect(apy).not.toBeNull();
    expect(apy!).toBeCloseTo(calculateWeeklyApyPctFromReturn(0.01), 10);
  });

  test("returns null when there is not enough history", () => {
    const apy = calculateWeeklyApyPctFromSharePrices([
      { x: 0, y: 1.0 },
      { x: 6 * 24 * 60 * 60, y: 1.01 },
    ]);

    expect(apy).toBeNull();
  });
});
