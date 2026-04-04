export type VaultVersion = "V1" | "V2";

export interface ChainInfo {
  id: number;
  network: string;
}

export interface SharePricePoint {
  x: number;
  y: number | null;
}

export interface NormalizedVault {
  name: string;
  address: string;
  assetSymbol: string;
  depositsPaused: boolean;
  listed: boolean;
  chainId: number;
  network: string;
  tvlUsd: number;
  weeklyApyPct: number;
  version: VaultVersion;
  url: string;
  linkLabel: string;
}

export interface GraphQlErrorLike {
  message: string;
}

export interface GraphQlWarningLike {
  field?: string;
  message?: string;
  path?: string;
  type?: string;
}

export interface GraphQlResponse<TData> {
  data?: TData;
  errors?: GraphQlErrorLike[];
  extensions?: {
    warnings?: GraphQlWarningLike[];
  };
}

export interface PageInfo {
  count: number;
  countTotal: number;
  limit: number;
  skip: number;
}

export interface PaginatedResponse<TItem> {
  items: TItem[];
  pageInfo: PageInfo;
}

export interface VaultV1State {
  avgNetApy?: number | null;
  totalAssetsUsd: number | null;
}

export interface MorphoVaultWarning {
  type: string;
}

export interface VaultV1ListItem {
  address: string;
  asset: {
    symbol: string | null;
  };
  chain: ChainInfo;
  listed: boolean;
  name: string;
  state: VaultV1State | null;
  warnings: MorphoVaultWarning[];
}

export interface VaultV2ListItem {
  address: string;
  avgNetApy?: number | null;
  asset: {
    symbol: string | null;
  };
  chain: ChainInfo;
  listed: boolean;
  name: string;
  totalAssetsUsd: number | null;
  warnings: MorphoVaultWarning[];
}

export interface AssetListItem {
  address: string;
  chain: ChainInfo;
  symbol: string;
}
