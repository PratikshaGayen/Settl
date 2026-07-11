// ConvertService — USDC → PHP conversion at the locked StableFX rate.
//
// Circle products: StableFX (the rate/execution) + Gateway (payout routing).
// See docs/circle-integration.md §4 (StableFX) and §3 (Gateway).
//
// Conversion happens off-chain *after* a milestone releases on-chain. It
// converts the released USDC at the rate locked on the FXQuote captured at
// invoice creation (never a fresh rate), and references that quote id so the
// conversion is auditable back to the quote the payer saw on the pay link.

export interface ConvertResult {
  /** PHP amount in minor units (centavos). */
  phpMinor: bigint;
  /** The locked rate used (USD→PHP). */
  rate: string;
  /** The FXQuote.id this conversion was priced from. */
  fxQuoteId?: string;
  /** Settlement tx hash, when the conversion is executed on-chain via Gateway. */
  txHash?: string;
}

/**
 * Convert released USDC to PHP at the locked StableFX rate.
 *
 * @param usdMinor  released amount in USDC minor units (USD cents in this app's
 *                  minor-unit convention)
 * @param rate      the locked USD→PHP rate from the invoice's FXQuote
 * @param fxQuoteId the FXQuote.id the rate came from (for audit trail)
 *
 * LIVE path: with StableFX access, execute the conversion against the held
 * quote and route the payout via Circle Gateway:
 *   const exec = await stableFx.executeQuote({ quoteId: fxQuoteId, amount: usdMinor });
 *   const payout = await gateway.transfer({ ... });
 *   return { phpMinor: exec.toAmount, rate, fxQuoteId, txHash: payout.txHash };
 *
 * SHAPED path (current): applies the locked rate arithmetically. The rate and
 * quote id are real and auditable; only the StableFX/Gateway *execution* leg is
 * the documented fallback.
 */
export async function convertUSDCtoPHP(
  usdMinor: bigint,
  rate: string,
  fxQuoteId?: string,
): Promise<ConvertResult> {
  const rateNum = Number(rate);
  const phpMinor = BigInt(Math.round(Number(usdMinor) * rateNum));
  return { phpMinor, rate, fxQuoteId };
}
