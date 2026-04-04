import Table from "cli-table3";
import { Command, InvalidArgumentError } from "commander";

import { fetchMainHyperliquidVaultDetails } from "./hyperliquid/api";
import { parseHyperliquidDateArg } from "./hyperliquid/date";
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
  valueLabel: "APY" | "APR",
): string {
  const table = createDefaultTable(["Period", valueLabel], ["left", "right"]);

  for (const row of rows) {
    table.push([
      row.periodLabel,
      formatNullablePercent(row.apyPct),
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

async function runHyperliquidCommand(): Promise<void> {
  const vaultDetails = await fetchMainHyperliquidVaultDetails();
  const returnRows = buildHyperliquidReturnRows(vaultDetails);

  console.log(renderHyperliquidTable(returnRows, "APY"));
}

async function runHyperliquidSinceDateCommand(
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

export async function runCli(argv: string[]): Promise<void> {
  const program = new Command();

  program
    .name("defictl")
    .description("A CLI client for Morpho vault discovery and Hyperliquid vault performance.")
    .showHelpAfterError("(Run `defictl morpho <minWeeklyApyPercent>`, `defictl hl`, `defictl hl 20260318`, or `defictl hl 20260318-151515`.)");

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

  program
    .command("hl")
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
        await runHyperliquidCommand();
        return;
      }

      await runHyperliquidSinceDateCommand(date);
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
