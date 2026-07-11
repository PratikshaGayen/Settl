// Chain config — viem clients, contract ABI + addresses.
// All values read from env; nothing hardcoded.

export const ARC_RPC_URL = process.env.ARC_RPC_URL ?? "";
export const ARC_CHAIN_ID = process.env.ARC_CHAIN_ID ?? "";
export const ESCROW_ADDRESS = process.env.ESCROW_ADDRESS ?? "";
export const USDC_ADDRESS = process.env.USDC_ADDRESS ?? "";
export const ARC_EXPLORER_URL = process.env.ARC_EXPLORER_URL ?? "";

/** Build an Arc explorer URL for a tx hash, or null if no explorer configured. */
export function explorerTxUrl(txHash: string | null | undefined): string | null {
  if (!txHash || !ARC_EXPLORER_URL) return null;
  return `${ARC_EXPLORER_URL.replace(/\/$/, "")}/tx/${txHash}`;
}
