import { parseThresholdArg } from "../utils/threshold";
import { parseMorphoAssetSymbolsArg } from "./assets";

export interface MorphoCommandArgs {
  assetSymbols?: string[];
  minWeeklyApyPercent: number;
}

const MORPHO_USAGE_HINT =
  "Use `defictl morpho <minWeeklyApyPercent>` or `defictl morpho <assetSymbols> <minWeeklyApyPercent>`, for example `defictl morpho 5`, `defictl morpho usdc 5`, or `defictl morpho usdc,ausd 5`.";

function isThresholdArg(value: string): boolean {
  try {
    parseThresholdArg(value);
    return true;
  } catch {
    return false;
  }
}

export function parseMorphoCommandArgs(parts: string[]): MorphoCommandArgs {
  if (parts.length === 1) {
    if (!isThresholdArg(parts[0])) {
      throw new Error(MORPHO_USAGE_HINT);
    }

    return {
      minWeeklyApyPercent: parseThresholdArg(parts[0]),
    };
  }

  if (parts.length === 2) {
    if (isThresholdArg(parts[0])) {
      throw new Error(
        "When providing asset filters, put them before the threshold. Use `defictl morpho usdc 5` or `defictl morpho usdc,ausd 5`.",
      );
    }

    return {
      assetSymbols: parseMorphoAssetSymbolsArg(parts[0]),
      minWeeklyApyPercent: parseThresholdArg(parts[1]),
    };
  }

  throw new Error(MORPHO_USAGE_HINT);
}
