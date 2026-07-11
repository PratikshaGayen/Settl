/**
 * Reset the demo to its pre-run state.
 *
 * Run with: npx tsx scripts/reset-demo.ts
 *
 * Deletes all invoices (cascade-deletes milestones, transactions),
 * zeros Maya's PHP balance, and re-seeds demo accounts (idempotent upsert).
 */
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Resetting demo state…");

  // Delete all invoices — milestones and transactions cascade.
  const { count: invoiceCount } = await prisma.invoice.deleteMany({});
  console.log(`  Deleted ${invoiceCount} invoice(s)`);

  // Delete all FX quotes (orphaned after invoice deletion).
  const { count: fxCount } = await prisma.fXQuote.deleteMany({});
  console.log(`  Deleted ${fxCount} FX quote(s)`);

  // Zero Maya's balance.
  const updated = await prisma.party.updateMany({
    where: { role: "FREELANCER" },
    data: { balanceMinor: 0n },
  });
  console.log(`  Zeroed balance for ${updated.count} freelancer(s)`);

  console.log("\nDemo reset complete. Run the app and log in as Maya to start fresh.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
