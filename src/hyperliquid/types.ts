export type HyperliquidPortfolioWindow = "day" | "week" | "month" | "allTime";

export interface HyperliquidPortfolioSeriesApi {
  accountValueHistory: Array<[number, string]>;
  pnlHistory: Array<[number, string]>;
  vlm: string;
}

export interface HyperliquidVaultDetailsApi {
  name: string;
  vaultAddress: string;
  description?: string;
  portfolio: Array<[string, HyperliquidPortfolioSeriesApi]>;
}

export interface HyperliquidHistoryPoint {
  timestampMs: number;
  accountValue: number;
  pnl: number;
}

export interface HyperliquidReturnEstimate {
  endTimestampMs: number;
  returnPct: number;
  startTimestampMs: number;
}

export interface HyperliquidReturnPeriod {
  label: string;
  lookbackDays: number;
  lookbackMs: number;
  portfolioWindow: HyperliquidPortfolioWindow;
}

export interface HyperliquidRateRow {
  periodLabel: string;
  apyPct: number | null;
}
