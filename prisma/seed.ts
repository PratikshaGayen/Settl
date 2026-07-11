import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding demo accounts...");

  // ── Maya Reyes (freelancer) ────────────────────────────
  const maya = await prisma.party.upsert({
    where: { id: "maya-demo-id" },
    update: {},
    create: {
      id: "maya-demo-id",
      role: "FREELANCER",
      displayName: "Maya Reyes",
      email: "maya@settl.dev",
      receiveCurrency: "PHP",
      balanceMinor: 0n,
      gcashHandle: "•••42",
      // Maya's payee wallet — receives released USDC on-chain. Override with
      // SEED_FREELANCER_WALLET; defaults to the demo payee used on Arc testnet.
      walletAddress:
        process.env.SEED_FREELANCER_WALLET ??
        "0x36fe44DB0E041d6B29B799CB9aDa7DE556D2EE01",
    },
  });
  console.log(`  Freelancer: ${maya.displayName} (${maya.id})`);

  // ── Northwind Labs (client) ────────────────────────────
  const payerWallet = process.env.SEED_PAYER_WALLET ?? "0x0000000000000000000000000000000000000000";
  const northwind = await prisma.party.upsert({
    where: { id: "northwind-demo-id" },
    update: {},
    create: {
      id: "northwind-demo-id",
      role: "CLIENT",
      displayName: "Northwind Labs",
      email: "finance@northwind.xyz",
      receiveCurrency: "PHP",
      balanceMinor: 0n,
      walletAddress: payerWallet,
    },
  });
  console.log(`  Client:    ${northwind.displayName} (${northwind.id})`);
  console.log(`             wallet: ${northwind.walletAddress}`);

  console.log("\nSeed complete. Set DEMO_FREELANCER_ID=maya-demo-id in .env for the hardcoded session.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
