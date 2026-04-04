import { describe, expect, test } from "bun:test";

import { selectMorphoVaults } from "../src/morpho/select";
import type { NormalizedVault } from "../src/morpho/types";

function createVault(
  name: string,
  tvlUsd: number,
  weeklyApyPct: number,
  assetSymbol = "USDC",
  listed = true,
  depositsPaused = false,
): NormalizedVault {
  return {
    address: `0x${name}`,
    assetSymbol,
    chainId: 1,
    depositsPaused,
    listed,
    linkLabel: name,
    name,
    network: "Ethereum",
    tvlUsd,
    url: `https://example.com/${name}`,
    version: "V1",
    weeklyApyPct,
  };
}

describe("selectMorphoVaults", () => {
  test("keeps vaults whose 7-day rolling APY is at least the threshold", () => {
    const selectedVaults = selectMorphoVaults(
      [
        createVault("equal", 1_500_000, 4),
        createVault("above", 2_000_000, 4.01),
      ],
      4,
    );

    expect(selectedVaults.map((vault) => vault.name)).toEqual(["above", "equal"]);
  });

  test("sorts the matching vaults by TVL in descending order", () => {
    const selectedVaults = selectMorphoVaults(
      [
        createVault("smaller", 1_100_000, 7),
        createVault("bigger", 1_300_000, 6),
        createVault("middle", 1_200_000, 5),
      ],
      4,
    );

    expect(selectedVaults.map((vault) => vault.name)).toEqual(["bigger", "middle", "smaller"]);
  });

  test("keeps only vaults whose TVL is strictly above 1M", () => {
    const selectedVaults = selectMorphoVaults(
      [
        createVault("below", 999_999.99, 8),
        createVault("equal", 1_000_000, 8),
        createVault("above", 1_000_000.01, 8),
      ],
      4,
    );

    expect(selectedVaults.map((vault) => vault.name)).toEqual(["above"]);
  });

  test("keeps only vaults whose asset is USDC or USDS", () => {
    const selectedVaults = selectMorphoVaults(
      [
        createVault("usdc", 2_000_000, 8, "USDC"),
        createVault("usds", 2_000_000, 8, "USDS"),
        createVault("usdt", 2_000_000, 8, "USDT"),
      ],
      5,
    );

    expect(selectedVaults.map((vault) => vault.name)).toEqual(["usdc", "usds"]);
  });

  test("keeps only vaults that are listed", () => {
    const selectedVaults = selectMorphoVaults(
      [
        createVault("listed", 2_000_000, 8, "USDC", true),
        createVault("unlisted", 2_000_000, 8, "USDC", false),
      ],
      5,
    );

    expect(selectedVaults.map((vault) => vault.name)).toEqual(["listed"]);
  });

  test("keeps only vaults whose deposits are not paused", () => {
    const selectedVaults = selectMorphoVaults(
      [
        createVault("open", 2_000_000, 8, "USDC", true, false),
        createVault("paused", 2_000_000, 8, "USDC", true, true),
      ],
      5,
    );

    expect(selectedVaults.map((vault) => vault.name)).toEqual(["open"]);
  });
});
