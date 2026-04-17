# defictl

defictl is a Bun-based TypeScript CLI that can list Morpho vaults by 7-day rolling APY and estimate multi-period returns for the main Hyperliquid protocol vault.

## Requirements

- [Bun](https://bun.sh/) 1.3 or later

## Install

```bash
bun install
```

## Run

Run the CLI directly with Bun:

```bash
bun run src/index.ts morpho 5
bun run src/index.ts morpho usdc 5
bun run src/index.ts morpho ausd 5
bun run src/index.ts morpho usdc,ausd 5
bun run src/index.ts hl vault
bun run src/index.ts hl vault 20260318
bun run src/index.ts hl vault 20260318-151515
bun run src/index.ts hl funding eurusd
```

Run it through the package binary name:

```bash
bun run defictl -- morpho 5
bun run defictl -- morpho usdc 5
bun run defictl -- morpho ausd 5
bun run defictl -- morpho usdc,ausd 5
bun run defictl -- hl vault
bun run defictl -- hl vault 20260318
bun run defictl -- hl vault 20260318-151515
bun run defictl -- hl funding eurusd
```

Link the binary globally if you want the `defictl` command in your shell:

```bash
bun link
defictl morpho 5
defictl morpho usdc 5
defictl morpho ausd 5
defictl morpho usdc,ausd 5
defictl hl vault
defictl hl vault 20260318
defictl hl vault 20260318-151515
defictl hl funding eurusd
```

## Commands

```bash
defictl morpho [assetSymbols] <minWeeklyApyPercent>
defictl hl vault [date]
defictl hl funding <pair>
```

Examples:

```bash
defictl morpho 5
defictl morpho 6.5
defictl morpho usdc 5
defictl morpho ausd 5
defictl morpho usdc,ausd 5
defictl hl vault
defictl hl vault 20260318
defictl hl vault 20260318-151515
defictl hl funding eurusd
```

`defictl morpho 5` means `>= 5.00%` 7-day rolling APY, with TVL strictly above `$1.00M`, using the default `USDC`/`USDS` asset filter.

## Morpho behavior

- Fetches Morpho Vault V1 and Vault V2 vaults from all chains exposed by the Morpho Blue API
- Uses `state.totalAssetsUsd` as TVL for V1
- Uses `totalAssetsUsd` as TVL for V2
- Uses the same 7-day APY source as [`morpho.gs`](/home/tonic/dev/defictl/morpho.gs): `avgNetApy(lookback: SEVEN_DAYS)` on the Morpho Blue API
- Keeps only vaults that are marked as listed by Morpho
- Excludes vaults that Morpho marks with paused deposits (`deposit_disabled`)
- Keeps only vaults whose underlying asset symbol is `USDC` or `USDS` by default
- When you pass an asset symbol such as `usdc` or `ausd`, keeps only vaults for that asset instead
- When you pass a comma-separated asset list such as `usdc,ausd`, keeps vaults for any asset in that list
- Filters vaults whose 7-day rolling APY is greater than or equal to the threshold you pass on the command line
- Keeps only vaults whose TVL is strictly above `$1.00M`
- Sorts matches by TVL in descending order
- Prints a six-column terminal table with `Vault`, `TVL`, `7D Rolling APY`, `Asset`, `Chain`, and `Version`
- Uses clickable Morpho frontend hyperlinks in the Vault column when the terminal supports OSC 8 hyperlinks

## Hyperliquid behavior

### `hl vault`

- Fetches the main Hyperliquid vault with the official `vaultDetails` info endpoint
- Uses the current Hyperliquidity Provider (HLP) vault address: `0xdfc24b077bc1425ad1dea75bcb6f8158e10df303`
- Computes annualized APY estimates for `1 day`, `3 days`, `1 week`, `2 weeks`, `1 month`, `2 months`, `3 months`, `6 months`, and `1 year`
- Accepts an optional UTC start value in `YYYYMMDD` or `YYYYMMDD-HHmmss`, such as `20260318` or `20260318-151515`
- Treats `YYYYMMDD` as `YYYYMMDD-000000`
- Uses the public `accountValueHistory` and `pnlHistory` series from `day`, `week`, `month`, and `allTime`
- Builds one best-available aligned history from `day`, `week`, `month`, and `allTime`, so even `6 months` and `1 year` benefit from the finest recent granularity that Hyperliquid exposes
- Estimates net external cash flows per interval as `delta accountValue - delta pnl`
- Chain-links interval returns after removing those estimated flows, which is the closest TWR-style approximation available from the public API snapshots
- Annualizes each period return with `((1 + periodReturn) ** (365 / periodDays) - 1) * 100`
- When you pass a date, computes the cumulative time-weighted return from that date to today and converts it to a simple annualized APR
- Uses the closest earlier snapshot for each requested lookback boundary
- Shows `NA` when a period cannot be computed from the available history
- Prints a two-column terminal table with `Period` and `APY`, or `APR` when a start date is provided

### `hl funding`

- Resolves friendly pair inputs such as `btcusd`, `eurusd`, `BTC`, or `xyz:EUR` to Hyperliquid's canonical perp market names
- Uses the official `allPerpMetas` info endpoint so builder-deployed markets such as `xyz:EUR` are supported
- Fetches historical funding data with the official `fundingHistory` info endpoint
- Computes the average observed hourly funding rate over the same periods used by `hl vault`: `1 day`, `3 days`, `1 week`, `2 weeks`, `1 month`, `2 months`, `3 months`, `6 months`, and `1 year`
- Annualizes each period's average funding rate with `averageHourlyFundingRate * 24 * 365 * 100`
- Shows `NA` when a period cannot be computed from the available funding history
- Prints the same two-column terminal table with `Period` and `Annualized Funding`

## Development

Run the tests:

```bash
bun test
```
