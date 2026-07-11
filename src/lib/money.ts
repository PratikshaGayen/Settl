// Money math helpers — integer minor-unit arithmetic only.
// Never use floating-point for money values.

/**
 * Format minor units as a display string.
 * e.g. 3360000 PHP centavos → "₱33,600.00"
 *       60000 USD cents      → "$600.00"
 */
export function formatMoney(
  minor: bigint | number,
  currency: "USD" | "PHP",
): string {
  const value = typeof minor === "bigint" ? Number(minor) : minor;
  const amount = value / 100;
  const symbol = currency === "USD" ? "$" : "₱";
  return `${symbol}${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Convert this app's USD minor units (cents, 2 decimals) to on-chain USDC
 * base units (6 decimals). 60000 cents ($600) → 600000000 (600 USDC).
 * Use this at every contract boundary — the contract speaks 6-decimal USDC.
 */
export function centsToUsdc(usdCents: bigint): bigint {
  return usdCents * 10_000n;
}

/**
 * Convert USD minor units (cents) to PHP minor units (centavos) using the given rate.
 * Rate is numeric (e.g. "56.00" = 1 USD → 56 PHP).
 * Rounds to the nearest centavo.
 */
export function usdToPhp(usdMinor: bigint, rate: string): bigint {
  const rateNum = Number(rate);
  const phpFloat = Number(usdMinor) * rateNum;
  return BigInt(Math.round(phpFloat));
}
