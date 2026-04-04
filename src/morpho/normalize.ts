import { normalizeRollingApyDecimalToPct } from "./apy";
import type { NormalizedVault, VaultV1ListItem, VaultV2ListItem } from "./types";
import { buildMorphoVaultUrl, makeTerminalHyperlink } from "./url";

function buildNormalizedVaultBase(params: {
  address: string;
  assetSymbol: string | null | undefined;
  chainId: number;
  depositsPaused: boolean;
  listed: boolean;
  name: string;
  network: string;
  tvlUsd: number | null | undefined;
}) {
  const url = buildMorphoVaultUrl({
    address: params.address,
    name: params.name,
    network: params.network,
  });

  return {
    address: params.address,
    assetSymbol: typeof params.assetSymbol === "string" ? params.assetSymbol.trim().toUpperCase() : "",
    chainId: params.chainId,
    depositsPaused: params.depositsPaused,
    listed: params.listed,
    linkLabel: makeTerminalHyperlink(params.name, url),
    name: params.name,
    network: params.network,
    tvlUsd: Number.isFinite(params.tvlUsd) ? Number(params.tvlUsd) : 0,
    url,
  };
}

export function normalizeV1Vault(item: VaultV1ListItem): NormalizedVault | null {
  const weeklyApyPct = normalizeRollingApyDecimalToPct(item.state?.avgNetApy);

  if (weeklyApyPct === null) {
    return null;
  }

  return {
    ...buildNormalizedVaultBase({
      address: item.address,
      assetSymbol: item.asset.symbol,
      chainId: item.chain.id,
      depositsPaused: item.warnings.some((warning) => warning.type === "deposit_disabled"),
      listed: item.listed,
      name: item.name,
      network: item.chain.network,
      tvlUsd: item.state?.totalAssetsUsd,
    }),
    version: "V1",
    weeklyApyPct,
  };
}

export function normalizeV2Vault(item: VaultV2ListItem): NormalizedVault | null {
  const weeklyApyPct = normalizeRollingApyDecimalToPct(item.avgNetApy);

  if (weeklyApyPct === null) {
    return null;
  }

  return {
    ...buildNormalizedVaultBase({
      address: item.address,
      assetSymbol: item.asset.symbol,
      chainId: item.chain.id,
      depositsPaused: item.warnings.some((warning) => warning.type === "deposit_disabled"),
      listed: item.listed,
      name: item.name,
      network: item.chain.network,
      tvlUsd: item.totalAssetsUsd,
    }),
    version: "V2",
    weeklyApyPct,
  };
}
