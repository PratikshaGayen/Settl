/**
 * Prints an entity-secret ciphertext for the CIRCLE_ENTITY_SECRET currently in
 * .env, for pasting into the Circle Console Configurator (register / reset).
 * Run: npx tsx scripts/gen-entity-ciphertext.ts
 */
import "dotenv/config";
import { generateEntitySecretCiphertext } from "@circle-fin/developer-controlled-wallets";

async function main() {
  const apiKey = process.env.CIRCLE_API_KEY;
  const entitySecret = process.env.CIRCLE_ENTITY_SECRET;
  if (!apiKey) throw new Error("CIRCLE_API_KEY missing in .env");
  if (!entitySecret) throw new Error("CIRCLE_ENTITY_SECRET missing in .env");

  const ciphertext = await generateEntitySecretCiphertext({ apiKey, entitySecret });
  console.log("\n=== Entity Secret Ciphertext (paste this into the Circle Console) ===\n");
  console.log(ciphertext);
  console.log("\n====================================================================\n");
}

main().catch((e) => {
  console.error("Failed:", e?.message ?? e);
  process.exit(1);
});
