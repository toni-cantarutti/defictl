import type { HyperliquidPortfolioWindow, HyperliquidReturnPeriod } from "./types";

export const HYPERLIQUID_API_URL = "https://api.hyperliquid.xyz/info";

// This is the current HLP vault address shown in the official Hyperliquid
// `vaultDetails` example and confirmed by the live API response.
export const HYPERLIQUID_MAIN_VAULT_ADDRESS = "0xdfc24b077bc1425ad1dea75bcb6f8158e10df303";

const DAY_IN_MS = 24 * 60 * 60 * 1_000;

function definePeriod(
  label: string,
  lookbackDays: number,
  lookbackMs: number,
  portfolioWindow: HyperliquidPortfolioWindow,
): HyperliquidReturnPeriod {
  return {
    label,
    lookbackDays,
    lookbackMs,
    portfolioWindow,
  };
}

export const HYPERLIQUID_RETURN_PERIODS = [
  definePeriod("1 day", 1, DAY_IN_MS, "day"),
  definePeriod("3 days", 3, 3 * DAY_IN_MS, "week"),
  definePeriod("1 week", 7, 7 * DAY_IN_MS, "week"),
  definePeriod("2 weeks", 14, 14 * DAY_IN_MS, "month"),
  definePeriod("1 month", 30, 30 * DAY_IN_MS, "month"),
  definePeriod("2 months", 60, 60 * DAY_IN_MS, "allTime"),
  definePeriod("3 months", 90, 90 * DAY_IN_MS, "allTime"),
  definePeriod("6 months", 180, 180 * DAY_IN_MS, "allTime"),
  definePeriod("1 year", 365, 365 * DAY_IN_MS, "allTime"),
] as const satisfies readonly HyperliquidReturnPeriod[];
