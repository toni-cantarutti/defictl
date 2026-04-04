export function parseThresholdArg(input: string): number {
  const trimmedValue = input.trim();

  if (trimmedValue.length === 0) {
    throw new Error("The APY threshold is required. Pass a number like `5` or `5.25`.");
  }

  const value = Number(trimmedValue);

  if (!Number.isFinite(value) || value < 0) {
    throw new Error("The APY threshold must be a non-negative number like `5` or `5.25`.");
  }

  return value;
}
