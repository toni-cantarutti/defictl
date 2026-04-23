import { describe, expect, test } from "bun:test";

import { buildMorphoVaultUrl } from "../src/morpho/url";

describe("buildMorphoVaultUrl", () => {
  test("builds the canonical Morpho vault URL", () => {
    expect(
      buildMorphoVaultUrl({
        address: "0x1234",
        name: "Steakhouse USDC",
        network: "Ethereum",
      }),
    ).toBe("https://app.morpho.org/ethereum/vault/0x1234/steakhouse-usdc");
  });

  test("normalizes OP Mainnet to Morpho's canonical network route", () => {
    expect(
      buildMorphoVaultUrl({
        address: "0xC30ce6A5758786e0F640cC5f881Dd96e9a1C5C59",
        name: "Gauntlet USDC Prime",
        network: "OP Mainnet",
      }),
    ).toBe(
      "https://app.morpho.org/opmainnet/vault/0xC30ce6A5758786e0F640cC5f881Dd96e9a1C5C59/gauntlet-usdc-prime",
    );
  });

  test("falls back when the canonical network path cannot be built", () => {
    expect(
      buildMorphoVaultUrl({
        address: "0x1234",
        name: "Steakhouse USDC",
        network: " ",
      }),
    ).toBe("https://app.morpho.org/vaults?vault=0x1234");
  });
});
