import { HYPERLIQUID_API_URL, HYPERLIQUID_MAIN_VAULT_ADDRESS } from "./constants";
import type { HyperliquidVaultDetailsApi } from "./types";

interface HyperliquidErrorResponse {
  error?: string;
  message?: string;
}

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
