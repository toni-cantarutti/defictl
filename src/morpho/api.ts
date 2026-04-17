import {
  ASSETS_QUERY,
  PAGE_SIZE,
  MORPHO_GRAPHQL_URL,
  V1_VAULTS_QUERY,
  V2_VAULTS_QUERY,
} from "./queries";
import { MIN_TVL_USD } from "./constants";
import { formatMorphoAssetSymbols, resolveMorphoAssetSymbols } from "./assets";
import {
  normalizeV1Vault,
  normalizeV2Vault,
} from "./normalize";
import type {
  AssetListItem,
  GraphQlResponse,
  NormalizedVault,
  PaginatedResponse,
  VaultV1ListItem,
  VaultV2ListItem,
} from "./types";

interface FetchMorphoVaultsResult {
  vaults: NormalizedVault[];
  warnings: string[];
}

async function morphoRequest<TData>(
  query: string,
  variables?: Record<string, unknown>,
): Promise<TData> {
  const response = await fetch(MORPHO_GRAPHQL_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      query,
      variables,
    }),
  });

  if (!response.ok) {
    throw new Error(`Morpho API request failed with HTTP ${response.status}.`);
  }

  const payload = (await response.json()) as GraphQlResponse<TData>;

  if (payload.errors !== undefined && payload.errors.length > 0 && payload.data === undefined) {
    throw new Error(payload.errors.map((error) => error.message).join(" "));
  }

  if (payload.data === undefined) {
    throw new Error("Morpho API returned no data.");
  }

  return payload.data;
}

async function fetchAllPages<TItem>(
  query: string,
  rootField: string,
  extraVariables: Record<string, unknown> = {},
  pageSize = PAGE_SIZE,
): Promise<TItem[]> {
  const items: TItem[] = [];
  let skip = 0;

  while (true) {
    const data = await morphoRequest<Record<string, PaginatedResponse<TItem>>>(query, {
      ...extraVariables,
      first: pageSize,
      skip,
    });

    const page = data[rootField];

    if (page === undefined) {
      throw new Error(`Morpho API response did not include the expected \`${rootField}\` field.`);
    }

    items.push(...page.items);

    skip += page.items.length;

    if (page.items.length === 0 || skip >= page.pageInfo.countTotal) {
      break;
    }
  }

  return items;
}

async function fetchVaultV1List(assetSymbols: ReadonlyArray<string>): Promise<VaultV1ListItem[]> {
  return fetchAllPages<VaultV1ListItem>(V1_VAULTS_QUERY, "vaults", {
    assetSymbols: [...assetSymbols],
    minTvlUsd: MIN_TVL_USD,
  });
}

async function fetchAllowedAssets(assetSymbols: ReadonlyArray<string>): Promise<AssetListItem[]> {
  return fetchAllPages<AssetListItem>(ASSETS_QUERY, "assets", {
    assetSymbols: [...assetSymbols],
  });
}

async function fetchVaultV2List(assetAddresses?: string[]): Promise<VaultV2ListItem[]> {
  return fetchAllPages<VaultV2ListItem>(V2_VAULTS_QUERY, "vaultV2s", {
    minTvlUsd: MIN_TVL_USD,
    ...(assetAddresses !== undefined && assetAddresses.length > 0 ? { assetAddresses } : {}),
  });
}

async function resolveV1Vaults(vaults: VaultV1ListItem[]): Promise<{
  normalizedVaults: NormalizedVault[];
  warnings: string[];
}> {
  const normalizedVaults = vaults
    .map((vault) => normalizeV1Vault(vault))
    .filter((vault): vault is NormalizedVault => vault !== null);

  return {
    normalizedVaults,
    warnings: [],
  };
}

async function resolveV2Vaults(vaults: VaultV2ListItem[]): Promise<{
  normalizedVaults: NormalizedVault[];
  warnings: string[];
}> {
  const normalizedVaults = vaults
    .map((vault) => {
      const normalizedVault = normalizeV2Vault(vault);
      return normalizedVault;
    })
    .filter((vault): vault is NormalizedVault => vault !== null);

  return {
    normalizedVaults,
    warnings: [],
  };
}

export async function fetchMorphoVaults(
  assetSymbols?: ReadonlyArray<string>,
): Promise<FetchMorphoVaultsResult> {
  const warnings: string[] = [];
  const resolvedAssetSymbols = resolveMorphoAssetSymbols(assetSymbols);
  const assetSymbolLabel = formatMorphoAssetSymbols(resolvedAssetSymbols);

  const assetsPromise = fetchAllowedAssets(resolvedAssetSymbols);
  const v1Promise = fetchVaultV1List(resolvedAssetSymbols);
  const v2Promise = assetsPromise
    .then((assets) => fetchVaultV2List(assets.map((asset) => asset.address)))
    .catch(() => fetchVaultV2List());

  const [assetsResult, v1Result, v2Result] = await Promise.allSettled([
    assetsPromise,
    v1Promise,
    v2Promise,
  ]);

  const v1Vaults = v1Result.status === "fulfilled" ? v1Result.value : [];
  const v2Vaults = v2Result.status === "fulfilled" ? v2Result.value : [];

  if (assetsResult.status === "rejected") {
    warnings.push(
      `Failed to fetch Morpho asset addresses for ${assetSymbolLabel} filtering. Falling back to a slower V2 query: ${assetsResult.reason instanceof Error ? assetsResult.reason.message : "unknown error"}`,
    );
  } else if (assetsResult.value.length === 0) {
    warnings.push(
      `No Morpho assets matched ${assetSymbolLabel} on the available Morpho chains.`,
    );
  }

  if (v1Result.status === "rejected") {
    warnings.push(`Failed to fetch Morpho V1 vaults: ${v1Result.reason instanceof Error ? v1Result.reason.message : "unknown error"}`);
  }

  if (v2Result.status === "rejected") {
    warnings.push(`Failed to fetch Morpho V2 vaults: ${v2Result.reason instanceof Error ? v2Result.reason.message : "unknown error"}`);
  }

  if (v1Result.status === "rejected" && v2Result.status === "rejected") {
    throw new Error("Unable to fetch Morpho vault data from the public GraphQL API.");
  }

  const [resolvedV1, resolvedV2] = await Promise.all([
    resolveV1Vaults(v1Vaults),
    resolveV2Vaults(v2Vaults),
  ]);

  warnings.push(...resolvedV1.warnings, ...resolvedV2.warnings);

  return {
    vaults: [...resolvedV1.normalizedVaults, ...resolvedV2.normalizedVaults],
    warnings,
  };
}
