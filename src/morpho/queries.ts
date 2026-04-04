export const MORPHO_GRAPHQL_URL = "https://blue-api.morpho.org/graphql";

export const PAGE_SIZE = 100;

export const V1_VAULTS_QUERY = /* GraphQL */ `
  query VaultsV1(
    $first: Int!
    $skip: Int!
    $assetSymbols: [String!]
    $minTvlUsd: Float!
  ) {
    vaults(
      first: $first
      skip: $skip
      orderBy: TotalAssetsUsd
      orderDirection: Desc
      where: {
        listed: true
        assetSymbol_in: $assetSymbols
        totalAssetsUsd_gte: $minTvlUsd
      }
    ) {
      items {
        address
        listed
        name
        warnings {
          type
        }
        asset {
          symbol
        }
        chain {
          id
          network
        }
        state {
          avgNetApy(lookback: SEVEN_DAYS)
          totalAssetsUsd
        }
      }
      pageInfo {
        count
        countTotal
        limit
        skip
      }
    }
  }
`;

export const V2_VAULTS_QUERY = /* GraphQL */ `
  query VaultsV2(
    $first: Int!
    $skip: Int!
    $assetAddresses: [Address!]
    $minTvlUsd: Float!
  ) {
    vaultV2s(
      first: $first
      skip: $skip
      orderBy: TotalAssetsUsd
      orderDirection: Desc
      where: {
        listed: true
        assetAddress_in: $assetAddresses
        totalAssetsUsd_gte: $minTvlUsd
      }
    ) {
      items {
        address
        listed
        name
        warnings {
          type
        }
        asset {
          symbol
        }
        chain {
          id
          network
        }
        avgNetApy(lookback: SEVEN_DAYS)
        totalAssetsUsd
      }
      pageInfo {
        count
        countTotal
        limit
        skip
      }
    }
  }
`;

export const ASSETS_QUERY = /* GraphQL */ `
  query AssetsBySymbol(
    $first: Int!
    $skip: Int!
    $assetSymbols: [String!]
  ) {
    assets(
      first: $first
      skip: $skip
      where: {
        symbol_in: $assetSymbols
      }
    ) {
      items {
        address
        symbol
        chain {
          id
          network
        }
      }
      pageInfo {
        count
        countTotal
        limit
        skip
      }
    }
  }
`;
