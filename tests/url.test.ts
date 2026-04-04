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
