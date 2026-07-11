// Circle developer-controlled wallets (real integration, ARC-TESTNET).
//
// Provides the embedded-wallet UX the hackathon calls for: Maya signs in
// email-only and a Circle wallet is provisioned for her behind the scenes;
// Northwind's paying wallet is also a Circle wallet. Released USDC lands in
// Maya's Circle wallet; the payer funds/approves from Northwind's.
//
// Requires CIRCLE_API_KEY + CIRCLE_ENTITY_SECRET in env (see
// scripts/register-entity-secret.ts). Guarded by isCircleConfigured().

import {
  initiateDeveloperControlledWalletsClient,
  type CircleDeveloperControlledWalletsClient,
} from "@circle-fin/developer-controlled-wallets";

export const ARC_BLOCKCHAIN = "ARC-TESTNET" as const;

export function isCircleConfigured(): boolean {
  return Boolean(process.env.CIRCLE_API_KEY && process.env.CIRCLE_ENTITY_SECRET);
}

let _client: CircleDeveloperControlledWalletsClient | null = null;
export function circle(): CircleDeveloperControlledWalletsClient {
  if (!isCircleConfigured()) {
    throw new Error("Circle not configured: set CIRCLE_API_KEY + CIRCLE_ENTITY_SECRET");
  }
  if (!_client) {
    _client = initiateDeveloperControlledWalletsClient({
      apiKey: process.env.CIRCLE_API_KEY!,
      entitySecret: process.env.CIRCLE_ENTITY_SECRET!,
    });
  }
  return _client;
}

/** Get the existing Settl wallet set id (from env) or create one and return it. */
export async function ensureWalletSet(): Promise<string> {
  if (process.env.CIRCLE_WALLET_SET_ID) return process.env.CIRCLE_WALLET_SET_ID;
  const res = await circle().createWalletSet({ name: "Settl" });
  const id = res.data?.walletSet?.id;
  if (!id) throw new Error("Failed to create wallet set");
  return id;
}

export interface ProvisionedWallet {
  walletId: string;
  address: string;
}

/** Provision one EOA wallet on ARC-TESTNET in the given wallet set. */
export async function provisionWallet(walletSetId: string): Promise<ProvisionedWallet> {
  const res = await circle().createWallets({
    walletSetId,
    blockchains: [ARC_BLOCKCHAIN],
    count: 1,
    accountType: "EOA", // self-pays gas (native USDC on Arc) — no paymaster needed
  });
  const w = res.data?.wallets?.[0];
  if (!w?.id || !w?.address) throw new Error("Wallet provisioning returned no wallet");
  return { walletId: w.id, address: w.address };
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Execute a contract call signed by a Circle wallet (the Wallets seam) and
 * wait for it to confirm on Arc. Returns the on-chain tx hash.
 */
export async function executeContract(
  walletId: string,
  contractAddress: string,
  abiFunctionSignature: string,
  abiParameters: (string | number)[],
): Promise<string> {
  const res = await circle().createContractExecutionTransaction({
    walletId,
    contractAddress,
    abiFunctionSignature,
    abiParameters,
    fee: { type: "level", config: { feeLevel: "MEDIUM" } },
  });
  const txId = res.data?.id;
  if (!txId) throw new Error("No transaction id returned from Circle");
  return waitForCircleTx(txId);
}

/** Poll a Circle transaction until it confirms; return the on-chain tx hash. */
export async function waitForCircleTx(txId: string, timeoutMs = 90_000): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const res = await circle().getTransaction({ id: txId });
    const tx = res.data?.transaction;
    const state = tx?.state;
    if (state === "CONFIRMED" || state === "COMPLETE") {
      if (!tx?.txHash) throw new Error(`Circle tx ${txId} ${state} but no txHash yet`);
      return tx.txHash;
    }
    if (state === "FAILED" || state === "CANCELLED" || state === "DENIED") {
      throw new Error(`Circle tx ${txId} ${state}: ${tx?.errorReason ?? "unknown"}`);
    }
    await sleep(2500);
  }
  throw new Error(`Circle tx ${txId} did not confirm within ${timeoutMs}ms`);
}

/** USDC (6-dp) balance for a Circle wallet, as a bigint of minor units. */
export async function circleUsdcBalance(walletId: string): Promise<bigint> {
  const res = await circle().getWalletTokenBalance({ id: walletId });
  const balances = res.data?.tokenBalances ?? [];
  const usdc = balances.find(
    (b) => b.token?.symbol === "USDC" || b.token?.symbol === "USDCN",
  );
  if (!usdc?.amount) return 0n;
  // amount is a decimal string like "5.0"; convert to 6-dp minor units.
  return BigInt(Math.round(parseFloat(usdc.amount) * 1e6));
}
