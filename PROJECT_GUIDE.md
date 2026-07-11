# Settl — The Whole Project, Explained

> Read this top to bottom and you'll understand what Settl is, how it works, and
> where every piece lives. No prior context needed. Written for one developer
> sitting down with the codebase for the first time.

---

## 1. What Settl is (in one breath)

Settl is a **cross-border freelancer payment rail with built-in escrow**.

A **UAE company (Northwind Labs)** hires a **freelancer in Manila (Maya Reyes)**.
Northwind pays in **USDC**; the money sits in an **on-chain escrow** and is released
**milestone by milestone** as Maya delivers. When a milestone is approved, the USDC
is converted to **Philippine Pesos (PHP)** at a locked FX rate and shows up as Maya's
balance, which she can cash out to GCash.

The whole thing runs on **Arc** (Circle's stablecoin L1) and uses **Circle Wallets**
so Maya never has to know what a seed phrase, gas, or a blockchain is. She signs in
with an email; a wallet is provisioned for her behind the scenes.

**Why it matters:** most "send money abroad" demos are a single transfer. Settl's
differentiator is the **trust layer** — escrow + milestones + a verifiable receipt —
which is exactly what freelancers and the companies paying them actually need.

---

## 2. The one flow that matters (the demo path)

Everything in the app ladders up to this single story. If you understand these
seven beats, you understand Settl:

1. **Maya creates an invoice** — $1,200, split into two $600 milestones, escrow on,
   7-day timeout. She gets a **pay link** to send to Northwind.
2. **Northwind opens the pay link** — sees the amount, the milestones, and
   "Maya receives ₱X (rate locked)". No login needed to view.
3. **Northwind funds the escrow** — USDC moves from Northwind's wallet into the
   escrow contract on Arc. Both milestones are now **Locked**.
4. **Maya marks milestone 1 delivered** — its status flips to **Awaiting approval**.
5. **Northwind approves milestone 1** — the contract **releases** that milestone's
   USDC to Maya. It's **converted to PHP** at the locked rate and added to her balance.
6. **Repeat for milestone 2** — when the last one is released, the invoice is **Completed**.
7. **Receipts + cash-out** — both sides get an auditable receipt with real transaction
   hashes; Maya cashes out her PHP balance to GCash (stubbed).

There's also a safety net: if Northwind never responds, after the timeout the funds
**auto-release** to Maya (the contract enforces this on-chain).

---

## 3. The tech stack

| Layer | Choice | Why |
|-------|--------|-----|
| Frontend + backend | **Next.js 16** (App Router, Turbopack), **React 19** | One codebase, server components do the DB work, server actions handle mutations |
| Database | **SQLite** via **Prisma** | Zero-setup local dev; Postgres-ready for deploy |
| Blockchain client | **viem** | Talks to Arc; signs the fallback (non-Circle) transactions |
| Smart contract | **Solidity 0.8.24** (`SettlEscrow.sol`), Hardhat | The escrow state machine, deployed on Arc |
| Wallets / signing | **Circle Developer-Controlled Wallets** SDK | Real embedded wallets on Arc for both parties |
| Styling | Tailwind + a few shadcn-style UI primitives | — |

> ⚠️ **This is not the Next.js you may know.** This repo runs a build of Next 16 with
> breaking changes. If you write new app code, check `node_modules/next/dist/docs/`
> before assuming an API behaves like older Next.

---

## 4. The mental model: three layers + two signing paths

### The three layers

```
┌─────────────────────────────────────────────────────────────┐
│  1. THE APP (Next.js)                                        │
│     - Screens for Maya (freelancer) and Northwind (client)   │
│     - SQLite is the source of truth for app state            │
│     - Server actions / API routes orchestrate everything     │
└───────────────┬─────────────────────────────────────────────┘
                │ calls
┌───────────────▼─────────────────────────────────────────────┐
│  2. THE MONEY (Circle Wallets + USDC on Arc)                 │
│     - Each party has a real Circle wallet                    │
│     - Circle signs the on-chain transactions                 │
└───────────────┬─────────────────────────────────────────────┘
                │ executes against
┌───────────────▼─────────────────────────────────────────────┐
│  3. THE ESCROW (SettlEscrow.sol, deployed on Arc)            │
│     - Holds USDC, enforces milestone release rules           │
│     - The single source of truth for *who gets paid*         │
└─────────────────────────────────────────────────────────────┘
```

### The two signing paths (important!)

Every on-chain action (fund, approve/release) can be signed **two ways**, and the
code picks automatically:

- **Circle path (the real one):** if the paying party has a `circleWalletId`, the
  transaction is signed by their **Circle wallet** via the Circle SDK. This is the
  headline integration — Northwind funds and approves from his Circle wallet.
- **viem fallback:** if Circle isn't configured, the same transaction is signed
  locally with `DEPLOYER_PRIVATE_KEY` (a raw key) via viem.

Both produce a **real on-chain transaction** on Arc. The fallback exists so the app
still works before Circle is set up, and so development isn't blocked. The selection
logic lives in the fund route and the approve action (`if (isCircleConfigured() &&
payer.circleWalletId) … else …`).

> There's a **third, simulated** path too: before the contract is deployed
> (`ESCROW_ADDRESS` unset), tx hashes are faked so the UI flow is demoable. With the
> contract deployed (it is), you never hit this path.

### A quirk worth knowing: on Arc, **gas is paid in USDC**

Arc's native token *is* USDC. So a wallet's "gas balance" and its "USDC balance" are
the same pot. That's why funding a Circle wallet with USDC also lets it pay for its
own transactions — no separate gas token, no faucet for ETH. This is a genuine Arc
property and part of the "predictable, dollar-denominated fees" story.

---

## 5. The data model

Five tables (see `prisma/schema.prisma`). Money is always stored in **minor units**
(integer cents / centavos) as `BigInt` — never floats.

- **Party** — a user. Either a `FREELANCER` (Maya) or a `CLIENT` (Northwind).
  Key fields: `walletAddress` (their on-chain address), `circleWalletId` (their
  Circle wallet id, if provisioned), `balanceMinor` (Maya's PHP balance),
  `receiveCurrency`, `gcashHandle`.
- **Invoice** — one bill. Has `amountMinor` (USD cents), `payeeId` (Maya),
  `payerId` (set when funded → Northwind), `status`, `payToken` (the public pay-link
  token), `escrow`, `timeoutDays`, `timeoutDefault`, and a link to the `FXQuote` it
  was priced with.
- **Milestone** — a slice of an invoice. `idx`, `label`, `amountMinor`, `status`
  (`LOCKED` → `AWAITING_APPROVAL` → `RELEASED`), `releaseTxHash`, timestamps.
- **Transaction** — an append-only audit log. Types: `FUND`, `RELEASE`, `CONVERT`.
  Each records an amount, a currency, a tx hash, and (for conversions) the FX rate.
- **FXQuote** — a captured USD→PHP rate (from StableFX or the fallback), with a
  validity window. The invoice references the quote it was priced at, so the rate the
  payer saw is the rate that's honored — auditable forever.

**Invoice status flow:** `AWAITING_PAYMENT` → `FUNDED` →
`PARTIALLY_RELEASED` → `COMPLETED` (or `EXPIRED`/`CANCELLED`/`REFUNDED` on the edges).

---

## 6. The money path, in code

Follow the seven beats from §2 through the actual files:

| Beat | Entry point | What it does |
|------|-------------|--------------|
| Create invoice | `src/app/api/invoices/route.ts` | Persists the invoice + milestones, captures an FX quote (`lib/fx.ts`), then **registers it on-chain** via `createInvoiceOnChain` (records payee = Maya's wallet + milestone amounts). Returns the pay link. |
| View pay link | `src/app/pay/[token]/page.tsx` | Public page; reads the cached quote, shows what Maya will receive. |
| Fund escrow | `FundButton.tsx` → `src/app/api/invoices/[id]/fund/route.ts` | Picks the signer: **Circle** (`fundEscrowViaCircle`) if Northwind has a Circle wallet, else viem (`fundEscrow`). Does USDC `approve` then `fund`. Marks invoice `FUNDED`. |
| Mark delivered | server action in `src/app/freelancer/invoices/[id]/page.tsx` | Pure DB update: milestone → `AWAITING_APPROVAL`. No chain call. |
| Approve / release | server action in `src/app/client/invoices/[id]/page.tsx` | Picks the signer (`approveMilestoneViaCircle` or `approveMilestone`), releases the milestone on-chain, then **converts USDC→PHP** (`lib/convert.ts`) and credits Maya's `balanceMinor`. Updates invoice status. |
| Receipts | `.../invoices/[id]/receipt/page.tsx` (both sides) | Renders the transaction log with explorer-linked tx hashes. |
| Cash out | `src/app/freelancer/cash-out/page.tsx` → `api/cashout/route.ts` | Stub: returns a `CPH-XXXXXXXX` reference + ETA. No real Coins.ph call. |

The on-chain wrappers all live in **`src/lib/escrow.ts`**:
- `createInvoiceOnChain` — register an invoice on the contract
- `fundEscrow` / `fundEscrowViaCircle` — fund it (viem / Circle)
- `approveMilestone` / `approveMilestoneViaCircle` — release a milestone (viem / Circle)
- `isEscrowConfigured()` — true once `ESCROW_ADDRESS` is set

The amount conversion `centsToUsdc` (2-decimal cents → 6-decimal USDC) lives in
`src/lib/money.ts` — that boundary is easy to get wrong, so it's centralized.

---

## 7. The Circle integration (what's real vs. shaped)

The hackathon scores **effective use of Circle's tools**. Here's the honest map:

| Circle product | Status in Settl | Where |
|----------------|-----------------|-------|
| **USDC** | ✅ **Real** — settlement + escrow currency on Arc | everywhere on-chain |
| **Circle Wallets** | ✅ **Real** — both parties have Circle wallets on Arc; fund + release are Circle-signed | `src/lib/circle.ts` |
| **Gateway** | 🟡 Shaped — release/payout routing is modeled as a "seam" (`submitViaGateway`) and documented; the tx is real, the *routing* leg is conceptual | `escrow.ts`, docs |
| **StableFX** | 🟡 Shaped — FX is StableFX-shaped (`FX_SOURCE_URL` → live; else documented fallback rate) | `src/lib/fx.ts`, `convert.ts` |
| **USYC** | 🟡 Conceptual — yield-on-escrow-float stub, no fake numbers | `src/lib/usyc.ts` |
| **CCTP / Bridge Kit** | ⚪ Not used (cross-chain funding is out of scope) | — |

The "shaped/conceptual" ones are deliberate: USYC and StableFX are **gated** (require
Circle approval), and the rules explicitly **don't penalize conceptual integrations**
when access isn't granted. USDC and Wallets are the two we made genuinely live.

**How Circle Wallets actually works here** (`src/lib/circle.ts`):
- `circle()` — the SDK client, built from `CIRCLE_API_KEY` + `CIRCLE_ENTITY_SECRET`
- `provisionWallet()` — creates an EOA wallet on `ARC-TESTNET`
- `executeContract()` — signs + submits a contract call from a Circle wallet, then
  polls `getTransaction` until it confirms, returning the real tx hash
- `circleUsdcBalance()` — reads a wallet's USDC balance via Circle's API

> **EOA, not SCA:** wallets are provisioned as EOAs so they self-pay gas (in USDC,
> the native token on Arc). That avoids needing a paymaster / Gas Station policy —
> the simplest path that actually works on Arc.

---

## 8. File-by-file map

```
src/
  app/
    page.tsx                         Role selector / sign-in (sets settl_party_id cookie)
    layout.tsx                       Root layout + <Toaster/>
    freelancer/
      page.tsx                       Maya's dashboard (balance + invoices)
      invoices/new/page.tsx          New invoice form (client component)
      invoices/[id]/page.tsx         Invoice detail + "Mark delivered" action
      invoices/[id]/receipt/page.tsx Freelancer receipt
      cash-out/page.tsx              GCash cash-out (stub)
    client/
      page.tsx                       Northwind's dashboard
      invoices/[id]/page.tsx         Invoice detail + "Approve" (release) action
      invoices/[id]/receipt/page.tsx Client receipt
    pay/[token]/
      page.tsx                       Public pay link
      FundButton.tsx                 Funding UX (connect→approve→fund, shows tx hash)
    api/
      invoices/route.ts              Create invoice (+ on-chain register)
      invoices/[id]/fund/route.ts    Fund escrow (Circle or viem)
      cashout/route.ts               Cash-out stub
      balance/route.ts               Maya's balance (for cash-out screen)
  lib/
    circle.ts        Circle Wallets: client, provisioning, contract execution
    escrow.ts        On-chain wrappers (fund/approve/createInvoice; Circle + viem)
    abi.ts           Minimal ABIs for SettlEscrow + ERC-20 USDC
    chain.ts         Env-driven chain config + explorerTxUrl()
    fx.ts            StableFX-shaped USD→PHP quote service (cached)
    convert.ts       USDC→PHP conversion at the locked rate
    money.ts         formatMoney + centsToUsdc (the 2→6 decimal boundary)
    usyc.ts          USYC float stub (conceptual)
    listener.ts      viem watchContractEvent listener (event indexing)
    session.ts       Cookie session helpers (settl_party_id)
    db.ts            Prisma client singleton
  components/
    SubmitButton.tsx Pending-state submit button (useFormStatus) for the async actions
    ui/*             Button, Input, Label, Select, Switch primitives

contracts/
  contracts/SettlEscrow.sol          The escrow state machine
  test/SettlEscrow.test.ts           15-case test matrix
  scripts/deploy.ts                  Deploy to Arc
  hardhat.config.ts, tsconfig.json   Hardhat (CommonJS) setup

scripts/
  register-entity-secret.ts          One-time: generate + register the Circle entity secret
  gen-entity-ciphertext.ts           Produce a ciphertext (for console reset/rotation)
  provision-wallets.ts               Provision Circle wallets for Maya + Northwind
  full-lifecycle.ts                  End-to-end test: create→fund→deliver→approve×2
  onchain-smoketest.ts               Low-level escrow smoke test
  reset-demo.ts                      Wipe invoices/quotes, zero Maya's balance

prisma/
  schema.prisma                      The 5-table data model
  seed.ts                            Seeds Maya + Northwind
  prisma/dev.db                      The SQLite file (note the nested path!)

docs/                                Planning + Circle integration write-ups
```

---

## 9. How to run it locally

**Prerequisites:** Node 22+, the repo cloned.

```bash
# 1. Install
npm install

# 2. Set up .env (see the keys below). The contract is already deployed, so the
#    only things you must supply are Circle credentials if you want the real
#    Circle path (otherwise the viem fallback runs).

# 3. Seed the two demo accounts
npx tsx prisma/seed.ts

# 4. (Optional, for real Circle Wallets) one-time Circle setup:
npx tsx scripts/register-entity-secret.ts   # needs CIRCLE_API_KEY in .env
npx tsx scripts/provision-wallets.ts         # creates Circle wallets on Arc

# 5. Run
npm run dev    # http://localhost:3000
```

To run the contract tests:
```bash
cd contracts && npm install && npx hardhat test   # 15 passing
```

**The env vars that matter** (`.env`):
```
DATABASE_URL              Absolute path to the SQLite file (see gotcha #1)
ARC_RPC_URL / ARC_CHAIN_ID / ARC_EXPLORER_URL    Arc testnet config
USDC_ADDRESS              0x3600…0000 (Arc's USDC predeploy)
ESCROW_ADDRESS            Deployed SettlEscrow (already set)
DEPLOYER_PRIVATE_KEY      Signs createInvoice + the viem fallback path
CIRCLE_API_KEY            Circle Developer console API key (testnet)
CIRCLE_ENTITY_SECRET      Written by register-entity-secret.ts
CIRCLE_WALLET_SET_ID      Written by provision-wallets.ts
FX_FALLBACK_RATE          USD→PHP rate used when StableFX isn't wired (56.00)
SEED_PAYER_WALLET / SEED_FREELANCER_WALLET / DEMO_FREELANCER_ID
```

**Try the whole thing without clicking:**
```bash
npx tsx scripts/full-lifecycle.ts   # runs a $2 invoice end-to-end, prints tx hashes
```

---

## 10. Gotchas (things that actually bit us)

1. **The SQLite path is nested and must be absolute.** Prisma resolves a relative
   `file:./prisma/dev.db` *from the schema directory*, so the DB ends up at
   `prisma/prisma/dev.db`. The Next.js runtime resolves the same relative path from
   the project root and looks at `prisma/dev.db` — mismatch → "unable to open
   database file." Fix: `DATABASE_URL` is an **absolute** path.
2. **The entity secret is generated once and is unrecoverable.** Circle never stores
   it. `register-entity-secret.ts` writes it to `.env` and drops a recovery file in
   `recovery/` (gitignored). If you lose the plaintext, you must **rotate** it in the
   Circle console using that recovery file. Don't re-run registration blindly — Circle
   rejects a second registration ("secret already set").
3. **Northwind's Circle wallet needs USDC to pay.** Because it's the on-chain payer
   *and* pays its own gas (in USDC) on Arc, it must be funded. Keep demo invoice
   amounts under its balance, or top it up from the deployer, or `fund` returns a 502.
4. **The dev server locks the generated Prisma client.** If `prisma generate` throws
   `EPERM: rename …src/generated/prisma…`, stop the dev server first, then regenerate.
5. **Contract tests need their own `tsconfig.json`.** Without `contracts/tsconfig.json`
   (CommonJS), ts-node inherits the Next.js ESM config and Hardhat fails to load
   `ethers`. That file is committed; don't delete it.

---

## 11. What's done vs. what's left

**Done and verified on Arc:**
- Full app (7 screens), SQLite, seeded demo accounts
- `SettlEscrow.sol` deployed; 15/15 tests pass; full fund→release cycle runs on-chain
- **USDC + Circle Wallets genuinely live** — both parties on real Circle wallets;
  fund + release are Circle-signed; payouts land in Maya's Circle wallet
- StableFX-shaped FX, USYC stub, Gateway seam (conceptual, documented, not faked)
- Loading states, toasts, explorer-linked tx hashes, receipts

**Left (all external — needs a human, not more code):**
- Create the public deploy URL (VPS / Docker)
- Record the presentation + fallback videos
- Push to a public GitHub repo
- Submit the hackathon form
- *(Optional)* provision a Circle wallet at sign-in for brand-new users (today the two
  demo parties are pre-provisioned via `provision-wallets.ts`)

---

## TL;DR for the impatient

Settl = **escrow-protected USDC payments from a UAE company to a Manila freelancer,
on Arc, with Circle Wallets so the freelancer never touches crypto.** The app
(Next.js + SQLite) orchestrates; the escrow contract on Arc holds and releases the
money; Circle wallets sign the transactions; releases convert to PHP at a locked rate.
Read `src/lib/escrow.ts` and `src/lib/circle.ts` to see the engine, and run
`scripts/full-lifecycle.ts` to watch the whole thing execute.
