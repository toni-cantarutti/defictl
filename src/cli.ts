import Table from "cli-table3";
import { Command, InvalidArgumentError } from "commander";

import {
  fetchAllHyperliquidPerpMetas,
  fetchHyperliquidFundingHistory,
  fetchMainHyperliquidVaultDetails,
} from "./hyperliquid/api";
import { parseHyperliquidDateArg } from "./hyperliquid/date";
import {
  buildHyperliquidFundingRateRows,
  resolveHyperliquidPerpMarket,
} from "./hyperliquid/funding";
import { HYPERLIQUID_RETURN_PERIODS } from "./hyperliquid/constants";
import {
  buildHyperliquidReturnRows,
  buildHyperliquidSinceDateAprRow,
} from "./hyperliquid/returns";
import type { HyperliquidRateRow } from "./hyperliquid/types";
import { fetchMorphoVaults } from "./morpho/api";
import { MIN_TVL_USD } from "./morpho/constants";
import { selectMorphoVaults } from "./morpho/select";
import type { NormalizedVault } from "./morpho/types";
import { formatNullablePercent, formatPercent, formatUsdShort } from "./utils/format";
import { parseThresholdArg } from "./utils/threshold";

function createDefaultTable(
  head: string[],
  colAligns: Array<"left" | "right" | "center">,
){
  return new Table({
    style: {
      compact: false,
      head: [],
      border: [],
    },
    head,
    colAligns,
  });
}

function renderMorphoTable(vaults: NormalizedVault[]): string {
  const table = createDefaultTable(
    ["Vault", "TVL", "7D Rolling APY", "Chain", "Version"],
    ["left", "right", "right", "left", "left"],
  );

  for (const vault of vaults) {
    table.push([
      vault.linkLabel,
      formatUsdShort(vault.tvlUsd),
      formatPercent(vault.weeklyApyPct),
      vault.network,
      vault.version,
    ]);
  }

  return table.toString();
}

function renderHyperliquidTable(
  rows: HyperliquidRateRow[],
  valueLabel: "APY" | "APR" | "Annualized Funding",
): string {
  const table = createDefaultTable(["Period", valueLabel], ["left", "right"]);

  for (const row of rows) {
    table.push([
      row.periodLabel,
      formatNullablePercent(row.ratePct),
    ]);
  }

  return table.toString();
}

function writeWarnings(warnings: string[]): void {
  for (const warning of warnings) {
    console.error(`Warning: ${warning}`);
  }
}

async function runMorphoCommand(minWeeklyApyPercent: number): Promise<void> {
  const { vaults, warnings } = await fetchMorphoVaults();

  if (warnings.length > 0) {
    writeWarnings(warnings);
  }

  const filteredVaults = selectMorphoVaults(vaults, minWeeklyApyPercent);

  if (filteredVaults.length === 0) {
    console.log(
      `No listed Morpho vaults were found with a 7-day rolling APY greater than or equal to ${formatPercent(minWeeklyApyPercent)} and a TVL above ${formatUsdShort(MIN_TVL_USD)}.`,
    );
    return;
  }

  console.log(renderMorphoTable(filteredVaults));
}

async function runHyperliquidVaultCommand(): Promise<void> {
  const vaultDetails = await fetchMainHyperliquidVaultDetails();
  const returnRows = buildHyperliquidReturnRows(vaultDetails);

  console.log(renderHyperliquidTable(returnRows, "APY"));
}

async function runHyperliquidVaultSinceDateCommand(
  startDate: ReturnType<typeof parseHyperliquidDateArg>,
): Promise<void> {
  const vaultDetails = await fetchMainHyperliquidVaultDetails();
  const row = buildHyperliquidSinceDateAprRow(
    vaultDetails,
    startDate.startTimestampMs,
    startDate.displayLabel,
  );

  console.log(renderHyperliquidTable([row], "APR"));
}

async function runHyperliquidFundingRateCommand(pair: string): Promise<void> {
  const maxLookbackMs =
    HYPERLIQUID_RETURN_PERIODS[HYPERLIQUID_RETURN_PERIODS.length - 1].lookbackMs;
  const allPerpMetas = await fetchAllHyperliquidPerpMetas();
  const canonicalPair = resolveHyperliquidPerpMarket(pair, allPerpMetas);
  const fundingHistory = await fetchHyperliquidFundingHistory(
    canonicalPair,
    Date.now() - maxLookbackMs,
  );
  const rows = buildHyperliquidFundingRateRows(fundingHistory);

  console.log(renderHyperliquidTable(rows, "Annualized Funding"));
}

export async function runCli(argv: string[]): Promise<void> {
  const program = new Command();

  program
    .name("defictl")
    .description("A CLI client for Morpho vault discovery and Hyperliquid vault performance/funding.")
    .showHelpAfterError("(Run `defictl morpho <minWeeklyApyPercent>`, `defictl hl vault`, `defictl hl vault 20260318`, or `defictl hl funding eurusd`.)");

  program
    .command("morpho")
    .description("List listed Morpho vaults whose 7-day rolling APY is at least the given threshold and whose TVL is above $1M.")
    .argument(
      "<minWeeklyApyPercent>",
      "7-day rolling APY threshold in percent, for example `5` or `5.25`.",
      (value: string) => {
        try {
          return parseThresholdArg(value);
        } catch (error) {
          if (error instanceof Error) {
            throw new InvalidArgumentError(error.message);
          }

          throw error;
        }
      },
    )
    .action(async (minWeeklyApyPercent: number) => {
      await runMorphoCommand(minWeeklyApyPercent);
    });

  const hyperliquidCommand = program
    .command("hl")
    .description("Hyperliquid vault analytics and perp funding rates.");

  hyperliquidCommand.action(() => {
    console.log(hyperliquidCommand.helpInformation());
  });

  hyperliquidCommand
    .command("vault")
    .description("Show multi-period annualized APY estimates, or a since-date annualized APR, for the main Hyperliquid vault.")
    .argument(
      "[date]",
      "Optional UTC start value in `YYYYMMDD` or `YYYYMMDD-HHmmss` format. `YYYYMMDD` is treated as `YYYYMMDD-000000`.",
      (value: string) => {
        try {
          return parseHyperliquidDateArg(value);
        } catch (error) {
          if (error instanceof Error) {
            throw new InvalidArgumentError(error.message);
          }

          throw error;
        }
      },
    )
    .action(async (date?: ReturnType<typeof parseHyperliquidDateArg>) => {
      if (date === undefined) {
        await runHyperliquidVaultCommand();
        return;
      }

      await runHyperliquidVaultSinceDateCommand(date);
    });

  hyperliquidCommand
    .command("funding")
    .description("Show multi-period annualized funding APR estimates for a Hyperliquid perp market.")
    .argument(
      "<pair>",
      "Hyperliquid pair, for example `BTC`, `btcusd`, `xyz:EUR`, or `eurusd`.",
    )
    .action(async (pair: string) => {
      await runHyperliquidFundingRateCommand(pair);
    });

  try {
    await program.parseAsync(argv);
  } catch (error) {
    if (error instanceof Error) {
      console.error(error.message);
      process.exitCode = 1;
      return;
    }

    throw error;
  }
}
