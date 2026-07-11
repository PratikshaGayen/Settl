// Event listener — watches the deployed SettlEscrow's events on Arc testnet
// and reconciles the DB. The contract events are the single source of money
// truth; this keeps invoices/milestones/transactions in sync even if a write
// path is interrupted.
//
// Wired with viem watchContractEvent. No-op (with a clear log) until the
// contract is deployed and ESCROW_ADDRESS is set.

import {
  createPublicClient,
  http,
  defineChain,
  type Hex,
  type Log,
} from "viem";
import { SETTL_ESCROW_ABI } from "./abi";
import { isEscrowConfigured } from "./escrow";

let stop: (() => void) | null = null;

export function startEventListener(): void {
  if (!isEscrowConfigured()) {
    console.log(
      "Event listener idle — ESCROW_ADDRESS not set (contract not deployed yet).",
    );
    return;
  }
  if (stop) return; // already running

  const chain = defineChain({
    id: Number(process.env.ARC_CHAIN_ID),
    name: "Arc Testnet",
    nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 6 },
    rpcUrls: { default: { http: [process.env.ARC_RPC_URL!] } },
  });

  const client = createPublicClient({ chain, transport: http() });

  const unwatch = client.watchContractEvent({
    address: process.env.ESCROW_ADDRESS as Hex,
    abi: SETTL_ESCROW_ABI,
    onLogs: (logs: Log[]) => {
      // The write paths (fund/approve routes) already update the DB optimistically.
      // This listener is the reconciliation/backstop: log each event with its tx
      // hash so the receipt's on-chain trail can be verified against the chain.
      for (const log of logs) {
        console.log("[escrow event]", (log as { eventName?: string }).eventName, log.transactionHash);
      }
    },
  });

  stop = unwatch;
  console.log("Event listener started on", process.env.ESCROW_ADDRESS);
}

export function stopEventListener(): void {
  stop?.();
  stop = null;
}
