import type { NormalizedVault } from "./types";
import { MIN_TVL_USD } from "./constants";
import { resolveMorphoAssetSymbols } from "./assets";

export function selectMorphoVaults(
  vaults: ReadonlyArray<NormalizedVault>,
  minWeeklyApyPercent: number,
  assetSymbols?: ReadonlyArray<string>,
): NormalizedVault[] {
  const allowedAssetSymbolSet: ReadonlySet<string> = new Set(
    resolveMorphoAssetSymbols(assetSymbols),
  );

  return [...vaults]
    .filter(
      (vault) =>
        !vault.depositsPaused &&
        vault.listed &&
        allowedAssetSymbolSet.has(vault.assetSymbol) &&
        vault.weeklyApyPct >= minWeeklyApyPercent &&
        vault.tvlUsd > MIN_TVL_USD,
    )
    .sort((left, right) => right.tvlUsd - left.tvlUsd);
}
