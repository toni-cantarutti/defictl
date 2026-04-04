const FALLBACK_BASE_URL = "https://app.morpho.org/vaults";

function normalizeAddress(address: string): string | null {
  const trimmedAddress = address.trim();
  return trimmedAddress.length > 0 ? trimmedAddress : null;
}

export function slugifyVaultName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function buildMorphoVaultUrl(params: {
  address: string;
  name: string;
  network: string;
}): string {
  const address = normalizeAddress(params.address);

  if (!address) {
    return FALLBACK_BASE_URL;
  }

  const slug = slugifyVaultName(params.name);
  const network = params.network.trim().toLowerCase();

  if (network.length === 0 || slug.length === 0) {
    return `${FALLBACK_BASE_URL}?vault=${encodeURIComponent(address)}`;
  }

  return `https://app.morpho.org/${encodeURIComponent(network)}/vault/${encodeURIComponent(address)}/${encodeURIComponent(slug)}`;
}

export function makeTerminalHyperlink(label: string, url: string): string {
  return `\u001B]8;;${url}\u0007${label}\u001B]8;;\u0007`;
}
