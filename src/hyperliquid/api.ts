import { HYPERLIQUID_API_URL, HYPERLIQUID_MAIN_VAULT_ADDRESS } from "./constants";
import type {
  HyperliquidFundingHistoryEntryApi,
  HyperliquidPerpMetaApi,
  HyperliquidVaultDetailsApi,
} from "./types";

interface HyperliquidErrorResponse {
  error?: string;
  message?: string;
}

const MAX_HYPERLIQUID_FUNDING_HISTORY_PAGES = 256;

async function hyperliquidRequest<TData>(payload: Record<string, unknown>): Promise<TData> {
  const response = await fetch(HYPERLIQUID_API_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Hyperliquid API request failed with HTTP ${response.status}.`);
  }

  const json = (await response.json()) as TData | HyperliquidErrorResponse;

  if (typeof json === "object" && json !== null) {
    const errorMessage = "error" in json && typeof json.error === "string"
      ? json.error
      : "message" in json && typeof json.message === "string"
        ? json.message
        : null;

    if (errorMessage !== null) {
      throw new Error(`Hyperliquid API error: ${errorMessage}`);
    }
  }

  return json as TData;
}

export async function fetchHyperliquidVaultDetails(
  vaultAddress: string,
): Promise<HyperliquidVaultDetailsApi> {
  const details = await hyperliquidRequest<HyperliquidVaultDetailsApi>({
    type: "vaultDetails",
    vaultAddress,
  });

  if (!Array.isArray(details.portfolio)) {
    throw new Error("Hyperliquid API response did not include a valid vault portfolio.");
  }

  return details;
}

export async function fetchMainHyperliquidVaultDetails(): Promise<HyperliquidVaultDetailsApi> {
  return fetchHyperliquidVaultDetails(HYPERLIQUID_MAIN_VAULT_ADDRESS);
}

export async function fetchAllHyperliquidPerpMetas(): Promise<HyperliquidPerpMetaApi[]> {
  const allPerpMetas = await hyperliquidRequest<HyperliquidPerpMetaApi[]>({
    type: "allPerpMetas",
  });

  if (!Array.isArray(allPerpMetas)) {
    throw new Error("Hyperliquid API response did not include valid perp metadata.");
  }

  return allPerpMetas;
}

async function fetchHyperliquidFundingHistoryPage(
  coin: string,
  startTimeMs: number,
  endTimeMs = Date.now(),
): Promise<HyperliquidFundingHistoryEntryApi[]> {
  const fundingHistory = await hyperliquidRequest<HyperliquidFundingHistoryEntryApi[] | null>({
    type: "fundingHistory",
    coin,
    startTime: startTimeMs,
    endTime: endTimeMs,
  });

  if (!Array.isArray(fundingHistory)) {
    throw new Error(`Hyperliquid API response did not include a valid funding history for ${coin}.`);
  }

  return fundingHistory;
}

export async function fetchHyperliquidFundingHistory(
  coin: string,
  startTimeMs: number,
  endTimeMs = Date.now(),
): Promise<HyperliquidFundingHistoryEntryApi[]> {
  const fundingHistoryByTimestamp = new Map<number, HyperliquidFundingHistoryEntryApi>();
  let nextStartTimeMs = startTimeMs;

  for (let pageIndex = 0; pageIndex < MAX_HYPERLIQUID_FUNDING_HISTORY_PAGES; pageIndex += 1) {
    const fundingHistoryPage = await fetchHyperliquidFundingHistoryPage(
      coin,
      nextStartTimeMs,
      endTimeMs,
    );

    if (fundingHistoryPage.length === 0) {
      return [...fundingHistoryByTimestamp.values()].sort((left, right) => left.time - right.time);
    }

    const sortedFundingHistoryPage = [...fundingHistoryPage].sort(
      (left, right) => left.time - right.time,
    );

    for (const entry of sortedFundingHistoryPage) {
      fundingHistoryByTimestamp.set(entry.time, entry);
    }

    const lastTimestampMs = sortedFundingHistoryPage[sortedFundingHistoryPage.length - 1]?.time;

    if (
      lastTimestampMs === undefined
      || lastTimestampMs >= endTimeMs
    ) {
      return [...fundingHistoryByTimestamp.values()].sort((left, right) => left.time - right.time);
    }

    if (lastTimestampMs < nextStartTimeMs) {
      throw new Error(`Hyperliquid funding history pagination did not advance for ${coin}.`);
    }

    nextStartTimeMs = lastTimestampMs + 1;
  }

  throw new Error(`Hyperliquid funding history pagination exceeded ${MAX_HYPERLIQUID_FUNDING_HISTORY_PAGES} pages for ${coin}.`);
}
