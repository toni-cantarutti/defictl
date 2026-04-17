import { DEFAULT_ASSET_SYMBOLS } from "./constants";

export function normalizeMorphoAssetSymbol(assetSymbol: string): string {
  return assetSymbol.trim().toUpperCase();
}

const MORPHO_ASSET_LIST_HINT =
  "The Morpho asset filter must be a comma-separated list like `usdc` or `usdc,ausd`.";

export function parseMorphoAssetSymbolsArg(assetSymbolsArg: string): string[] {
  const normalizedAssetSymbols = assetSymbolsArg
    .split(",")
    .map((assetSymbol) => normalizeMorphoAssetSymbol(assetSymbol));

  if (normalizedAssetSymbols.some((assetSymbol) => assetSymbol.length === 0)) {
    throw new Error(MORPHO_ASSET_LIST_HINT);
  }

  return [...new Set(normalizedAssetSymbols)];
}

export function resolveMorphoAssetSymbols(assetSymbols?: ReadonlyArray<string>): string[] {
  if (assetSymbols === undefined) {
    return [...DEFAULT_ASSET_SYMBOLS];
  }

  return [...new Set(assetSymbols.map((assetSymbol) => normalizeMorphoAssetSymbol(assetSymbol)))];
}

export function formatMorphoAssetSymbols(assetSymbols: ReadonlyArray<string>): string {
  return assetSymbols.join(",");
}
