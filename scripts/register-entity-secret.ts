/**
 * One-time setup for Circle developer-controlled wallets.
 *
 * Generates a random 32-byte Entity Secret, registers its ciphertext with
 * Circle (using your CIRCLE_API_KEY), then writes CIRCLE_ENTITY_SECRET into
 * .env and saves a recovery file under ./recovery/.
 *
 * Prereq: CIRCLE_API_KEY must already be in .env.
 * Run:    npx tsx scripts/register-entity-secret.ts
 *
 * The Entity Secret cannot be recovered by Circle — keep .env and the
 * recovery file safe. Docs: https://developers.circle.com/wallets/dev-controlled/register-entity-secret
 */
import "dotenv/config";
import { randomBytes } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { registerEntitySecretCiphertext } from "@circle-fin/developer-controlled-wallets";

async function main() {
  const apiKey = process.env.CIRCLE_API_KEY;
  if (!apiKey) {
    throw new Error("CIRCLE_API_KEY is not set in .env. Add it first, then re-run.");
  }
  if (process.env.CIRCLE_ENTITY_SECRET && process.env.CIRCLE_ENTITY_SECRET.length >= 32) {
    console.log("CIRCLE_ENTITY_SECRET already set in .env (non-empty) — nothing to do.");
    return;
  }

  // 1. Generate a fresh 32-byte entity secret.
  const entitySecret = randomBytes(32).toString("hex");

  // 2. Persist it to .env FIRST so we never lose the plaintext, even if the
  //    network call below partially fails. Replace the (possibly empty) line.
  const envPath = ".env";
  let env = readFileSync(envPath, "utf8");
  if (/^CIRCLE_ENTITY_SECRET=/m.test(env)) {
    env = env.replace(/^CIRCLE_ENTITY_SECRET=.*$/m, `CIRCLE_ENTITY_SECRET="${entitySecret}"`);
  } else {
    const sep = env.endsWith("\n") ? "" : "\n";
    env = `${env}${sep}CIRCLE_ENTITY_SECRET="${entitySecret}"\n`;
  }
  writeFileSync(envPath, env);
  console.log("✅ CIRCLE_ENTITY_SECRET written to .env");

  // 3. Register its ciphertext with Circle; this also downloads a recovery file.
  if (!existsSync("./recovery")) mkdirSync("./recovery");
  await registerEntitySecretCiphertext({
    apiKey,
    entitySecret,
    recoveryFileDownloadPath: "./recovery",
  });
  console.log("✅ Entity secret registered with Circle.");
  console.log("   Recovery file saved under ./recovery/ — store it somewhere safe.");
}

main().catch((e) => {
  console.error("Registration failed:", e?.message ?? e);
  process.exit(1);
});
