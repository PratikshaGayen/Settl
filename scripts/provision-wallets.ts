/**
 * Provision real Circle wallets on ARC-TESTNET for the two demo parties and
 * store their wallet id + address in the DB. Idempotent: skips a party that
 * already has a circleWalletId. Persists the wallet set id to .env.
 *
 * Run: npx tsx scripts/provision-wallets.ts
 */
import "dotenv/config";
import { readFileSync, writeFileSync } from "node:fs";
import { prisma } from "../src/lib/db";
import { ensureWalletSet, provisionWallet, isCircleConfigured } from "../src/lib/circle";

function persistWalletSetId(id: string) {
  if (process.env.CIRCLE_WALLET_SET_ID) return;
  const env = readFileSync(".env", "utf8");
  const sep = env.endsWith("\n") ? "" : "\n";
  writeFileSync(".env", `${env}${sep}CIRCLE_WALLET_SET_ID="${id}"\n`);
  console.log("  saved CIRCLE_WALLET_SET_ID to .env");
}

async function main() {
  if (!isCircleConfigured()) throw new Error("Circle not configured in .env");

  const walletSetId = await ensureWalletSet();
  console.log("wallet set:", walletSetId);
  persistWalletSetId(walletSetId);

  for (const id of ["maya-demo-id", "northwind-demo-id"]) {
    const party = await prisma.party.findUnique({ where: { id } });
    if (!party) {
      console.log(`  ${id}: not found, skipping`);
      continue;
    }
    if (party.circleWalletId) {
      console.log(`  ${party.displayName}: already has Circle wallet ${party.walletAddress}`);
      continue;
    }
    const { walletId, address } = await provisionWallet(walletSetId);
    await prisma.party.update({
      where: { id },
      data: { circleWalletId: walletId, walletAddress: address },
    });
    console.log(`  ${party.displayName}: ${address}  (wallet ${walletId})`);
  }

  console.log("\nDone. Both demo parties are backed by Circle wallets on ARC-TESTNET.");
}

main()
  .catch((e) => {
    console.error("Provisioning failed:", e?.response?.data ?? e?.message ?? e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
