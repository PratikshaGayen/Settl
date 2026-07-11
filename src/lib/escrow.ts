// Escrow contract call wrappers — fund(), approve() against the DEPLOYED
// SettlEscrow on Arc testnet (T4.1 / T4.3).
//
// Circle products: Circle Wallets (signs the payer's txs) + Circle Gateway
// (routes the release/payout). See docs/circle-integration.md §2, §3.
//
// SHAPED posture: the on-chain calls are real viem writes against the deployed
// contract. The *signer* and the *routing layer* are the seams:
//   - Wallets seam:  in LIVE mode the payer's Circle Wallet signs; in the
//     gated fallback the demo signer (DEPLOYER_PRIVATE_KEY) signs.
//   - Gateway seam:  `submitViaGateway` wraps the send so LIVE mode routes
//     through Circle Gateway; the fallback is a direct viem write. Either way
//     the tx is real and the hash resolves on the Arc explorer.
//
// If ESCROW_ADDRESS is not set, the contract isn't deployed yet: these throw a
// clear, catchable error so callers can keep the pre-deploy simulated path.

import {
  createPublicClient,
  createWalletClient,
  http,
  keccak256,
  toHex,
  defineChain,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { SETTL_ESCROW_ABI, ERC20_ABI } from "./abi";

export class EscrowNotConfiguredError extends Error {
  constructor() {
    super(
      "ESCROW_ADDRESS not set — contract not deployed yet (T3.4). Using simulated path.",
    );
    this.name = "EscrowNotConfiguredError";
  }
}

export function isEscrowConfigured(): boolean {
  return Boolean(
    process.env.ESCROW_ADDRESS &&
      process.env.ARC_RPC_URL &&
      process.env.ARC_CHAIN_ID &&
      process.env.USDC_ADDRESS &&
      process.env.DEPLOYER_PRIVATE_KEY,
  );
}

/** Map a string invoice id to the bytes32 the contract keys on. */
export function toInvoiceKey(invoiceId: string): Hex {
  return keccak256(toHex(invoiceId));
}

function chain() {
  const id = Number(process.env.ARC_CHAIN_ID);
  return defineChain({
    id,
    name: "Arc Testnet",
    nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 6 },
    rpcUrls: { default: { http: [process.env.ARC_RPC_URL!] } },
    blockExplorers: process.env.ARC_EXPLORER_URL
      ? { default: { name: "ArcScan", url: process.env.ARC_EXPLORER_URL } }
      : undefined,
  });
}

function publicClient() {
  return createPublicClient({ chain: chain(), transport: http() });
}

/**
 * Wallets seam. In the gated fallback the demo signer signs every tx.
 * LIVE: resolve the *payer's* Circle Wallet here and return a Circle-backed
 * wallet client / signing shim instead of the local account.
 */
function walletClient() {
  const account = privateKeyToAccount(process.env.DEPLOYER_PRIVATE_KEY! as Hex);
  return createWalletClient({ account, chain: chain(), transport: http() });
}

/**
 * Gateway seam. LIVE mode routes the prepared tx through Circle Gateway so the
 * movement shows up in Gateway's transfer trail; the fallback sends directly.
 * Both return the on-chain tx hash.
 */
async function submitViaGateway(
  send: () => Promise<Hex>,
): Promise<Hex> {
  // LIVE: const { txHash } = await gateway.submit(preparedTx); return txHash;
  return send();
}

const ESCROW_ADDRESS = () => process.env.ESCROW_ADDRESS as Hex;
const USDC_ADDRESS = () => process.env.USDC_ADDRESS as Hex;

/**
 * Fund the escrow for an invoice: ERC-20 approve(total) then fund(invoiceKey).
 * Returns the fund tx hash. The contract must already have the invoice
 * registered via createInvoice (done at invoice creation).
 */
export async function fundEscrow(
  invoiceId: string,
  amount: bigint,
): Promise<string> {
  if (!isEscrowConfigured()) throw new EscrowNotConfiguredError();

  const pub = publicClient();
  const wallet = walletClient();
  const key = toInvoiceKey(invoiceId);

  // 1. USDC approve(escrow, amount)
  const approveHash = await wallet.writeContract({
    address: USDC_ADDRESS(),
    abi: ERC20_ABI,
    functionName: "approve",
    args: [ESCROW_ADDRESS(), amount],
  });
  await pub.waitForTransactionReceipt({ hash: approveHash });

  // 2. fund(invoiceId) — routed via Gateway seam
  const fundHash = await submitViaGateway(() =>
    wallet.writeContract({
      address: ESCROW_ADDRESS(),
      abi: SETTL_ESCROW_ABI,
      functionName: "fund",
      args: [key],
    }),
  );
  await pub.waitForTransactionReceipt({ hash: fundHash });

  return fundHash;
}

/**
 * Circle Wallets path — fund the escrow signed by the payer's Circle wallet
 * (USDC approve → fund). This is the real "Circle Wallets" integration: the
 * paying company (Northwind) signs from its Circle developer-controlled wallet
 * instead of a raw key. Returns the fund tx hash.
 */
export async function fundEscrowViaCircle(
  invoiceId: string,
  amount: bigint,
  circleWalletId: string,
): Promise<string> {
  const { executeContract } = await import("./circle");
  const key = toInvoiceKey(invoiceId);
  await executeContract(
    circleWalletId,
    USDC_ADDRESS(),
    "approve(address,uint256)",
    [ESCROW_ADDRESS(), amount.toString()],
  );
  return executeContract(circleWalletId, ESCROW_ADDRESS(), "fund(bytes32)", [key]);
}

/**
 * Circle Wallets path — release a milestone signed by the payer's Circle
 * wallet. Returns the release tx hash.
 */
export async function approveMilestoneViaCircle(
  invoiceId: string,
  milestoneIndex: number,
  circleWalletId: string,
): Promise<string> {
  const { executeContract } = await import("./circle");
  const key = toInvoiceKey(invoiceId);
  return executeContract(circleWalletId, ESCROW_ADDRESS(), "approve(bytes32,uint8)", [
    key,
    milestoneIndex,
  ]);
}

/**
 * Approve (release) a milestone on-chain. Only the recorded payer can call;
 * routed through the Gateway seam. Returns the release tx hash.
 */
export async function approveMilestone(
  invoiceId: string,
  milestoneIndex: number,
): Promise<string> {
  if (!isEscrowConfigured()) throw new EscrowNotConfiguredError();

  const pub = publicClient();
  const wallet = walletClient();
  const key = toInvoiceKey(invoiceId);

  const hash = await submitViaGateway(() =>
    wallet.writeContract({
      address: ESCROW_ADDRESS(),
      abi: SETTL_ESCROW_ABI,
      functionName: "approve",
      args: [key, milestoneIndex],
    }),
  );
  await pub.waitForTransactionReceipt({ hash });

  return hash;
}

/**
 * Register an invoice on-chain (createInvoice). Called at invoice creation so
 * the contract knows the payee + milestone amounts before funding.
 */
export async function createInvoiceOnChain(
  invoiceId: string,
  payee: Hex,
  milestoneAmounts: bigint[],
  timeoutSeconds: bigint,
  timeoutDefault: 0 | 1, // 0 = AUTO_RELEASE, 1 = AUTO_REFUND
): Promise<string> {
  if (!isEscrowConfigured()) throw new EscrowNotConfiguredError();

  const pub = publicClient();
  const wallet = walletClient();
  const key = toInvoiceKey(invoiceId);

  const hash = await wallet.writeContract({
    address: ESCROW_ADDRESS(),
    abi: SETTL_ESCROW_ABI,
    functionName: "createInvoice",
    args: [key, payee, milestoneAmounts, timeoutSeconds, timeoutDefault],
  });
  await pub.waitForTransactionReceipt({ hash });

  return hash;
}
