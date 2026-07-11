import "dotenv/config";
import { createPublicClient, http, getContract, type Hex } from "viem";
import {
  createInvoiceOnChain,
  fundEscrow,
  approveMilestone,
  isEscrowConfigured,
  toInvoiceKey,
} from "../src/lib/escrow";
import { ERC20_ABI } from "../src/lib/abi";

const PAYEE = "0x36fe44DB0E041d6B29B799CB9aDa7DE556D2EE01" as Hex;
const USDC = process.env.USDC_ADDRESS as Hex;

async function usdcBalance(addr: Hex): Promise<bigint> {
  const pub = createPublicClient({
    chain: {
      id: Number(process.env.ARC_CHAIN_ID),
      name: "arc",
      nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 6 },
      rpcUrls: { default: { http: [process.env.ARC_RPC_URL!] } },
    },
    transport: http(),
  });
  const c = getContract({ address: USDC, abi: ERC20_ABI, client: pub });
  return (await c.read.balanceOf([addr])) as bigint;
}

async function main() {
  console.log("isEscrowConfigured:", isEscrowConfigured());
  if (!isEscrowConfigured()) throw new Error("escrow not configured");

  const invoiceId = `smoketest-${Date.now()}`;
  const amount = 5_000000n; // 5 USDC (6 decimals)
  console.log("invoiceId:", invoiceId, "key:", toInvoiceKey(invoiceId));

  const before = await usdcBalance(PAYEE);
  console.log("payee USDC before:", before.toString());

  console.log("\n1. createInvoiceOnChain...");
  const createTx = await createInvoiceOnChain(invoiceId, PAYEE, [amount], 604800n, 0);
  console.log("   tx:", createTx);

  console.log("2. fundEscrow...");
  const fundTx = await fundEscrow(invoiceId, amount);
  console.log("   tx:", fundTx);

  console.log("3. approveMilestone(0)...");
  const approveTx = await approveMilestone(invoiceId, 0);
  console.log("   tx:", approveTx);

  const after = await usdcBalance(PAYEE);
  console.log("\npayee USDC after:", after.toString());
  console.log("delta:", (after - before).toString(), "(expected 5000000)");
  console.log(after - before === amount ? "✅ PASS — USDC released to payee" : "❌ delta mismatch");

  const base = process.env.ARC_EXPLORER_URL;
  console.log("\nExplorer links:");
  for (const [k, tx] of [["create", createTx], ["fund", fundTx], ["approve", approveTx]] as const) {
    console.log(`  ${k}: ${base}/tx/${tx}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
