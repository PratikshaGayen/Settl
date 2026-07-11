# Settl — Submission

> **The Stablecoin Commerce Stack Challenge** · Host: Arc (Circle) · **Track 1 — Best Cross-Border Payments & Remittances Experience (UAE → Global)**
> *(Also directly addresses Track 2 — SME Trade Finance, via milestone escrow + verifiable payment history.)*

---

## 1. Title & short description

**Settl — a cross-border freelancer payout rail with built-in escrow protection.**

A UAE company pays a Manila-based freelancer in **USDC on Arc**. The money sits in an **on-chain milestone escrow** and releases milestone-by-milestone as work is delivered and approved. On release, USDC converts to **Philippine Pesos at an FX rate locked at invoice time**, lands as the freelancer's balance, and can be cashed out to GCash. The freelancer never sees a seed phrase, gas, or a wallet address — a **Circle Wallet** is provisioned behind an email sign-in.

The differentiator vs. a plain transfer is the **escrow + milestone trust layer**: funds lock on funding and release only on the payer's per-milestone approval (or a pre-agreed timeout), with every step producing an on-chain receipt.

---

## 2. Track

**Primary: Track 1 — Cross-Border Payments & Remittances (UAE → Global).**
Settl is a UAE-based platform paying a global creator/contractor, with transparent fees, real-time settlement confirmation, and receipts — the exact "global payroll / contractor payouts with stablecoin settlement and receipts" example named in the track.

Secondary relevance: **Track 2 — SME Trade Finance**, through milestone-gated stablecoin escrow and a verifiable, on-chain payment history.

---

## 3. Circle Developer Account email

`pratikshagayen35118@gmail.com` *(the email tied to the Circle Developer Console account used to provision the API key, entity secret, and wallets — confirm this is correct before submitting).*

---

## 4. Circle products used on Arc

| Product | Used | Status | How it's integrated |
| --- | :---: | --- | --- |
| **USDC** | ✅ | **Live** | Settlement + escrow asset (6-decimal) on Arc. Real on-chain fund/release moves real testnet USDC. `contracts/contracts/SettlEscrow.sol`, `src/lib/escrow.ts`. |
| **Circle Wallets** | ✅ | **Live** | Developer-controlled wallets provisioned for both parties on `ARC-TESTNET`. Fund + approve are signed by the payer's Circle wallet; releases land in the payee's Circle wallet (verified via Arc RPC **and** Circle API). `src/lib/circle.ts`. |
| **Circle Gateway** | ➖ | Shaped | Routing/treasury seam (`submitViaGateway`) around the release call; falls back to a direct on-chain write so the release is always real. |
| **StableFX** | ➖ | Shaped | Quote → lock → execute USD→PHP model (`src/lib/fx.ts`); mechanism is production-shaped, price source is a documented fallback pending gated access. |
| **USYC** | ➖ | Conceptual | Yield-on-escrowed-float design (`src/lib/usyc.ts`); labelled stub, **zero fabricated APY**. |
| **CCTP / Bridge Kit** | ❌ | Out of scope | Single-corridor MVP; not wired, not claimed. |

**On the submission form, tick: USDC and Wallets** (the two live integrations). Gateway / StableFX / USYC are integrated as documented seams/concepts — per the rules, conceptual integrations of gated tools are not penalized. Do **not** tick CCTP/Bridge Kit.

---

## 5. Functional MVP (frontend + backend)

**Yes — working full-stack app, verified end-to-end on Arc testnet.**

- **Frontend:** Next.js app. Freelancer dashboard (invoice creation with milestones, live FX quote, balance, cash-out), public pay link, client dashboard (fund, approve milestones), dual receipts with tx hashes + explorer links.
- **Backend:** Next.js API routes + server actions, Prisma DB, `SettlEscrow` smart contract on Arc, Circle Wallets signing.
- **Proof it works:** `scripts/full-lifecycle.ts` runs create → fund → deliver → approve → approve through the real API routes and real contract calls; USDC actually moves to the payee's Circle wallet and the receipt renders real, explorer-resolvable tx hashes.

**Architecture diagram:** [`docs/architecture.md`](docs/architecture.md) (system diagram + escrow state machine, Mermaid).

---

## 6. Video demonstration + presentation

- **Presentation / slide outline & narration script:** [`docs/presentation.md`](docs/presentation.md)
- **Live demo click-through script (~90s):** [`docs/demo-script.md`](docs/demo-script.md)
- **Video link:** _[paste after recording]_

---

## 7. Code repository

- **GitHub:** https://github.com/PratikshaGayen/Settl
- **Setup + Circle integration docs:** [`README.md`](README.md), [`docs/circle-integration.md`](docs/circle-integration.md)
- **Full architecture walkthrough:** [`PROJECT_GUIDE.md`](PROJECT_GUIDE.md)

---

## 8. Demo application URL

**https://settl-two.vercel.app/** (Vercel + Neon Postgres)

Demo accounts are seeded (Maya Reyes / freelancer, Northwind / client); sign in via the role selector.

---

## 9. Circle Product Feedback

Full, per-product feedback (why chosen · what worked · what to improve · recommendations) is in [`docs/circle-feedback.md`](docs/circle-feedback.md). One-line summary: **the stack's clean per-product interface seams let us build the whole flow and swap fallbacks for live calls product-by-product; the single biggest improvement would be earlier, zero-approval sandbox access (Wallets entity secret, StableFX indicative rates, USYC labelled-fake yield) — access latency, not API complexity, was our main constraint.**

---

## Submission checklist

- [x] Title & short description
- [x] Track selected (Track 1)
- [ ] Circle Developer Account email confirmed
- [x] Circle products selected (USDC, Wallets)
- [x] Functional MVP (frontend + backend) + architecture diagram
- [ ] Video demonstration recorded + linked
- [x] GitHub repo pushed (public) + linked
- [x] Demo application URL deployed + linked (https://settl-two.vercel.app/)
- [x] Circle Product Feedback section
