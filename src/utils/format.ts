export function formatUsdShort(value: number): string {
  const absoluteValue = Math.abs(value);

  if (absoluteValue >= 1_000_000_000_000) {
    return `$${(value / 1_000_000_000_000).toFixed(2)}T`;
  }

  if (absoluteValue >= 1_000_000_000) {
    return `$${(value / 1_000_000_000).toFixed(2)}B`;
  }

  if (absoluteValue >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(2)}M`;
  }

  if (absoluteValue >= 1_000) {
    return `$${(value / 1_000).toFixed(2)}K`;
  }

  return `$${value.toFixed(2)}`;
}

export function formatPercent(value: number): string {
  const roundedValue = value.toFixed(2);
  return `${roundedValue === "-0.00" ? "0.00" : roundedValue}%`;
}

export function formatNullablePercent(value: number | null): string {
  return value === null ? "N/A" : formatPercent(value);
}
