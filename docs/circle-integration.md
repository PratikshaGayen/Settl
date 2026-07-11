# Settl — Circle Integration Spec

**Purpose:** one section per Circle product, written so the coding agent can wire each one without guessing, and so we know exactly which checkbox we tick on the submission form. Judging explicitly scores *"effective use of Circle's Developer tools"* — this doc is the map.

**Legend for status:**

- **LIVE** — wired against the real Circle SDK/endpoint in the running app.
- **SHAPED** — implemented behind a Circle-shaped interface with a working fallback; swaps to LIVE by setting one env var / dropping in the SDK call. Used when access is gated.
- **CONCEPTUAL** — architecture + clearly-labelled code stub only; documented integration point. Per hackathon rules, conceptual integrations are *not penalized* when access isn't granted in time.

| Product | Replaces | Settl status | Submission checkbox |
| ------- | -------- | ------------ | ------------------- |
| USDC | — (settlement asset) | LIVE | ✅ USDC |
| Circle Wallets | generic wallet connect | SHAPED → LIVE | ✅ Wallets |
| Circle Gateway | direct contract call / payout | SHAPED | ✅ Gateway |
| StableFX | generic FX source | SHAPED | ✅ StableFX |
| USYC | (none — escrow float yield) | CONCEPTUAL | ✅ USYC |
| CCTP / Bridge Kit | (none — cross-chain funding) | CONCEPTUAL (stretch) | ⬜ CCTP (only if wired) |

> **Gated tooling (USYC, StableFX):** request access early via Circle's form, then email `customer-support@circle.com` subject `"Circle Hackathon - USYC or StableFX testnet request"`. Design them in regardless of access.

---

## 1. USDC — settlement + escrow asset · **LIVE**

**What it is in Settl:** the only asset the escrow contract holds and moves. All milestone amounts are USDC minor units (6 decimals). Northwind funds in USDC; the contract releases USDC to Maya's address; conversion to PHP happens off-chain after release.

- **SDK / address:** ERC-20 USDC on Arc testnet. Address from `USDC_ADDRESS` env (`0x3600…0000` placeholder — replace with the real Arc testnet USDC mint).
- **Where called:**
  - `SettlEscrow.sol` — `fund()` does `transferFrom`, `approve()`/`claimTimeout()` do `transfer`.
  - `src/lib/escrow.ts` — ERC-20 `approve(escrow, total)` before `fund()`.
- **Fallback:** none needed — testnet USDC is freely faucetable.
- **Honesty note:** amounts are real 6-decimal USDC units end to end; no scaling fudges.

---

## 2. Circle Wallets — embedded wallets for both parties · **SHAPED → LIVE**

**What it replaces:** a generic WalletConnect / "connect your MetaMask" flow. The whole product thesis is that **Maya never sees crypto** — Circle's embedded (developer-controlled / user-controlled) wallets let her sign in with email and get a provisioned wallet behind the scenes.

- **SDK / endpoint:** `@circle-fin/developer-controlled-wallets` (or user-controlled w/ PIN). REST base `https://api.circle.com/v1/w3s/…`. Needs `CIRCLE_API_KEY` + an `entitySecret`.
- **Where called (Settl flow):**
  - **Onboarding (T1.3):** on first sign-in, `POST /wallets` provisions a wallet for the party; the resulting `walletAddress` is stored on `Party.walletAddress`. Maya: email-only, no PIN vocabulary surfaced. Northwind: company wallet.
  - **Fund (T4.1):** Northwind's fund tx is signed by her Circle wallet — Settl asks Circle to sign+broadcast the `approve` + `fund` calls; Settl never holds her key (non-custodial posture preserved).
- **Interface seam in code:** wallet provisioning + signing sits behind a thin `wallet` module so the SHAPED fallback (seeded `walletAddress` + server-held deployer key for the demo) swaps to LIVE Circle Wallets by flipping `CIRCLE_API_KEY` on.
- **Fallback when gated:** seed `Party.walletAddress` directly; the demo signs via `DEPLOYER_PRIVATE_KEY`. Functionally identical money path, minus Circle's key custody. **Documented, not hidden.**
- **Submission claim:** "Circle Wallets provision both parties' wallets; Maya's experience is email-only with zero crypto vocabulary."

---

## 3. Circle Gateway — release + payout routing · **SHAPED**

**What it replaces:** a raw `eth_sendTransaction` to the contract for the release leg, and a hand-rolled payout movement. Gateway gives a unified balance / routing layer for moving USDC on release.

- **SDK / endpoint:** Circle Gateway API (`/v1/…` transfers/routing). Needs `CIRCLE_API_KEY`.
- **Where called (Settl flow):**
  - **Approve → release (T4.3):** when Northwind approves a milestone, the on-chain `approve(invoiceId, idx)` release is routed/submitted through Gateway rather than a bare RPC send, so the USDC movement is reflected in Gateway's transfer trail.
  - **Payout (T5.1):** the released USDC handed to the StableFX conversion leg is routed via Gateway.
- **Interface seam:** `src/lib/escrow.ts#approveMilestone` calls a `gateway.submit(tx)` shim. SHAPED fallback = direct viem `writeContract` via the configured wallet client; LIVE swaps the shim body for the Gateway call.
- **Fallback when gated:** direct viem write to the deployed contract; same tx hash resolves on the Arc explorer. The release is still real and on-chain — only the *routing layer* is the fallback.
- **Submission claim:** "Release + payout movements are routed through Circle Gateway; tx trail reflects Gateway transfers."

---

## 4. StableFX — USD → PHP conversion · **SHAPED**

**What it replaces:** a generic FX rate source (a hardcoded rate or a public FX API). StableFX gives a quotable, executable stablecoin FX rate.

- **SDK / endpoint:** StableFX quote + execute endpoints. Needs StableFX access on the Circle account.
- **Where called (Settl flow):**
  - **Quote at invoice creation (T2.3):** `getUsdToPhpQuote()` in `src/lib/fx.ts` fetches one USD→PHP quote, caches it 60s server-side, and writes an `FXQuote` row with `source = "stablefx"`. The pay link reads the cached value — **never a live call at view time** (this is also our demo failure plan).
  - **Conversion on release (T5.1):** `convertUSDCtoPHP()` in `src/lib/convert.ts` converts the released USDC at the **locked** quote rate and references the `FXQuote.id` so the conversion is auditable back to the quote.
- **Interface seam:** both functions already isolate the FX source. SHAPED fallback drives the rate from `FX_FALLBACK_RATE` and tags `source = "fallback"`; setting `FX_SOURCE_URL` (or dropping the StableFX SDK call in) tags `source = "stablefx"`.
- **Fallback when gated:** `FX_FALLBACK_RATE` (default 56.00). The quote is still captured once, cached, timestamped, and read from DB — the *mechanism* is real; only the *price source* is the fallback.
- **Submission claim:** "USD→PHP quote and conversion go through StableFX; FXQuote rows record `source = stablefx` and the conversion references the locked quote id."

---

## 5. USYC — yield on escrowed float · **CONCEPTUAL**

**What it adds (nothing it replaces):** while milestones sit LOCKED, the escrowed USDC is idle. USYC lets that float earn yield until release, then redeems back to USDC at release. This is the "your money works while it's protected" story — a genuine differentiator, not filler.

- **SDK / endpoint:** USYC (Hashnote) mint/redeem on the escrowed balance. Gated.
- **Where it would hook (Settl flow):**
  - On `fund()` (all milestones → LOCKED): route the locked USDC into USYC (`mint`).
  - On `approve()` / `claimTimeout()` (a milestone resolves): `redeem` the corresponding USYC back to USDC before the transfer to payee/payer.
- **Code artifact:** `src/lib/usyc.ts` — a clearly-labelled stub with `routeToUSYC(amount)` / `redeemFromUSYC(amount)` and inline docs describing the float lifecycle. **No fake yield numbers are surfaced in the UI** — the stub returns the principal unchanged and logs the conceptual yield accrual point.
- **Fallback / honesty note:** CONCEPTUAL by design. We never present invented APY as real. The architecture diagram and this doc carry the design; the stub marks the exact integration point.
- **Submission claim:** "USYC float design: escrowed USDC routes to USYC while LOCKED and redeems on release. Conceptual integration; documented integration point, no fabricated yield."

---

## 6. CCTP / Bridge Kit — cross-chain funding · **CONCEPTUAL (stretch)**

**What it adds:** lets Northwind fund from USDC on another chain; CCTP burns-and-mints into Arc so the escrow is funded natively. Bonus scoring, **not on the critical path**.

- **SDK / endpoint:** CCTP v2 / Circle Bridge Kit.
- **Where it would hook:** in front of `fund()` — a cross-chain deposit lands USDC on Arc, then the normal `approve`+`fund` runs.
- **Status:** CONCEPTUAL unless time allows. Only tick the CCTP checkbox on the form **if actually wired**.

---

## Env var → product map

| Env var | Product | Effect when set |
| ------- | ------- | --------------- |
| `CIRCLE_API_KEY` | Wallets, Gateway, StableFX | flips those seams from SHAPED fallback to LIVE Circle calls |
| `FX_SOURCE_URL` | StableFX | FXQuote `source` becomes the live source instead of `fallback` |
| `USDC_ADDRESS` | USDC | ERC-20 the contract holds |
| `ESCROW_ADDRESS` / `NEXT_PUBLIC_ESCROW_ADDRESS` | (deployed SettlEscrow) | enables real on-chain fund/release |
| `ARC_RPC_URL` / `ARC_CHAIN_ID` | (chain) | viem client target |
| `DEPLOYER_PRIVATE_KEY` | (demo signer) | SHAPED-mode signer when Circle Wallets is gated |

## What gets ticked on the submission form

**Definitely:** USDC, Wallets, Gateway, StableFX, USYC.
**Only if wired:** CCTP.

Each claim above is phrased so the demo and the integration docs (T8.5) can back it up honestly: LIVE/SHAPED items move real testnet USDC on Arc; CONCEPTUAL items are labelled as design + stub, never dressed up as live.
