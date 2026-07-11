// USYC float hook — yield on escrowed USDC while milestones are LOCKED.
//
// Circle product: USYC (see docs/circle-integration.md §5). Status: CONCEPTUAL.
//
// THE DESIGN
// ----------
// While an invoice's milestones sit LOCKED in escrow, the deposited USDC is
// idle. USYC lets that float earn yield until release:
//
//   fund()      → all milestones LOCKED → routeToUSYC(total)   (mint USYC)
//   approve(i)  → milestone i resolves  → redeemFromUSYC(amt)  (redeem to USDC)
//   claimTimeout(i)                     → redeemFromUSYC(amt)
//
// This is the "your money works while it's protected" differentiator — escrow
// that isn't dead weight. It is intentionally NOT on the critical money path:
// the demo's fund→release loop is correct with or without USYC wired.
//
// HONESTY CONTRACT
// ----------------
// This is a CONCEPTUAL integration. We do not have USYC testnet access wired,
// so:
//   - these functions are no-ops that return the principal UNCHANGED,
//   - we surface NO invented APY / yield numbers anywhere in the UI,
//   - the integration point is marked here and in the architecture diagram.
// When access lands, replace the bodies with real USYC mint/redeem calls.

export interface USYCPosition {
  /** Principal routed into USYC, in USDC minor units. */
  principalMinor: bigint;
  /** Yield accrued so far, in USDC minor units. CONCEPTUAL: always 0n here. */
  accruedYieldMinor: bigint;
}

/**
 * Route LOCKED escrow float into USYC for yield. Called on fund().
 *
 * LIVE path:
 *   const pos = await usyc.mint({ amount: amountMinor, asset: "USDC" });
 *   return { principalMinor: amountMinor, accruedYieldMinor: 0n };
 *
 * CONCEPTUAL path (current): no-op. Records the integration point; no yield is
 * fabricated.
 */
export async function routeToUSYC(amountMinor: bigint): Promise<USYCPosition> {
  // CONCEPTUAL: would mint USYC against the escrowed USDC here.
  return { principalMinor: amountMinor, accruedYieldMinor: 0n };
}

/**
 * Redeem USYC back to USDC before a milestone's funds move out. Called on
 * approve() / claimTimeout(), before the transfer to payee/payer.
 *
 * LIVE path:
 *   const out = await usyc.redeem({ amount: amountMinor });
 *   return out.usdcMinor; // principal + realized yield
 *
 * CONCEPTUAL path (current): returns the principal unchanged. No yield added.
 */
export async function redeemFromUSYC(amountMinor: bigint): Promise<bigint> {
  // CONCEPTUAL: would redeem USYC → USDC here. Principal only; no fake yield.
  return amountMinor;
}
