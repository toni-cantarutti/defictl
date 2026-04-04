import type { NormalizedVault } from "./types";
import { ALLOWED_ASSET_SYMBOLS, MIN_TVL_USD } from "./constants";

const ALLOWED_ASSET_SYMBOL_SET: ReadonlySet<string> = new Set(ALLOWED_ASSET_SYMBOLS);

export function selectMorphoVaults(
  vaults: ReadonlyArray<NormalizedVault>,
  minWeeklyApyPercent: number,
): NormalizedVault[] {
  return [...vaults]
    .filter(
      (vault) =>
        !vault.depositsPaused &&
        vault.listed &&
        ALLOWED_ASSET_SYMBOL_SET.has(vault.assetSymbol) &&
        vault.weeklyApyPct >= minWeeklyApyPercent &&
        vault.tvlUsd > MIN_TVL_USD,
    )
    .sort((left, right) => right.tvlUsd - left.tvlUsd);
}
