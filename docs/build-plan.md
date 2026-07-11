# Settl — Build Plan

**Single source of truth for what gets done, in what order.** Every task ladders up to the one demo path in `demo-script.md`. Milestones are ordered as vertical slices: each one ends in something demoable, not a half-finished foundation. Do not start a later milestone before the current one's acceptance criteria pass.

**Legend:** `[ ]` todo · `[~]` in progress · `[x]` done · `[!]` blocked

---

## Hackathon framing (read first)

**Event:** Stablecoin Commerce Stack Challenge (Ignyte · Circle + Arc as technical sponsors).
**Track:** **1 — Best Cross-Border Payments & Remittances Experience (UAE → Global).**
**Prize target:** 1st place 5000 USDC / 2nd 3000 USDC.

**Positioning:** Settl is a **freelancer/contractor payout rail with built-in escrow protection** on the UAE → Philippines corridor — one of the world's largest remittance corridors. A **UAE-based company (Northwind)** pays a **Manila-based freelancer (Maya)** in USDC on Arc, with milestone-gated escrow release and PHP off-ramp. Most Track 1 entries will be dumb transfers; the **escrow/milestone trust layer is our differentiator within the track.**

**Why we win = effective use of the Circle stack on Arc.** Judging explicitly scores "effective use of Circle's Developer tools." We do NOT use generic infra where a Circle product exists:

| Settl component                                     | Circle product (was → now)                                              |
| --------------------------------------------------- | ----------------------------------------------------------------------- |
| Maya's email-only, non-crypto-native experience     | generic wallet connect → **Circle Wallets** (embedded)                  |
| Northwind funding wallet                            | generic wallet connect → **Circle Wallets**                             |
| USD → PHP conversion                                | generic FX source → **StableFX** (or StableFX-shaped if access gated)   |
| Yield on escrowed float while milestones are locked | (none) → **USYC** (conceptual integration is allowed and not penalized) |
| Release + payout treasury routing                   | direct call → **Circle Gateway**                                        |
| Settlement + escrow balances                        | **USDC** (keep)                                                         |
| Cross-chain funding (optional bonus)                | (none) → **CCTP / Bridge Kit**                                          |

> **Gated tooling (USYC, StableFX):** request access early via Circle's form, then email `customer-support@circle.com` subject `"Circle Hackathon - USYC or StableFX testnet request"`. Per the rules, **conceptual / architecture-level integrations are not penalized if access isn't granted in time** — design them in regardless.

---

## What changed vs. the previous plan

1. **Track decided:** Track 1, with Northwind reframed as a **UAE company** (authentic UAE→PH corridor). No rebuild.
2. **Circle stack swapped in** across M1–M5 (Wallets, StableFX, USYC, Gateway) — the single biggest scoring lever.
3. **Contract deploy + real fund path is now blocking-priority**, not an afterthought. The "functional MVP" must hit the deployed contract.
4. **New M8 — Submission** milestone: public deploy URL, architecture diagram, presentation video, repo integration docs, Circle Product Feedback. These are scored deliverables.
5. **M7 rebalanced:** this is **async artifact-judged**, not a live pitch — one rehearsal, more weight on submission artifacts.

---

## M0 — Planning artifacts (no code)

_Goal: the coding agent has everything it needs before writing a line._

- [x] **T0.1 — Demo script** — `docs/demo-script.md`
- [x] **T0.2 — Screen inventory** — `docs/screens.md` (7 screens)
- [x] **T0.3 — Data model** — `docs/data-model.md` (Party, Invoice, Milestone, Transaction, FXQuote)
- [x] **T0.4 — Contract spec** — `docs/contract-spec.md` (state machine, transitions, timeout)
- [x] **T0.5 — Tech stack + scaffold spec** — `docs/stack.md`
- [x] **T0.6 — Circle integration spec** — `docs/circle-integration.md` _(new)_
  - [x] One section per Circle product: Wallets, StableFX, USYC, Gateway, USDC, CCTP.
  - [x] For each: what it replaces, SDK/endpoint, where it's called in our flow, fallback if gated.
  - [x] Mark which are live vs. conceptual for the submission.
  - **AC:** The agent can wire each Circle product from this doc without guessing, and we know exactly which checkbox we tick on the submission form.

**M0 done when:** all six docs exist and the agent can start without questions.

---

## M1 — Scaffold + Circle Wallets onboarding

_Goal: app runs, both account types exist via Circle Wallets, you can log in as Maya (email-only) and Northwind (UAE company)._

- [x] **T1.1 — Project scaffold** (`npm run dev` boots clean, blank dashboard)
- [x] **T1.2 — Database + migrations** (schema from `data-model.md`; Postgres-ready)
  - [x] **T1.2a — Update seed** — Maya (Manila freelancer, PHP, email-only) and **Northwind (UAE-based company)**, both backed by **real Circle Wallets** on ARC-TESTNET (`scripts/provision-wallets.ts`).
  - **AC:** ✅ Seed creates the two corridor-correct demo parties; `provision-wallets.ts` backs each with a real Circle developer-controlled wallet.
- [x] **T1.3 — Circle Wallets onboarding** _(replaces generic wallet connect)_ — ✅ REAL Circle Wallets wired
  - [x] Maya is backed by a real Circle wallet (`0x28bf6fe7…`); her payout lands in it (verified via Arc RPC + Circle API). No crypto vocab shown on Maya's side.
  - [x] Northwind is backed by a real Circle wallet (`0xdb6ff5fe…`) and is the **on-chain payer** — funds + approves are signed from its Circle wallet (verified: fund tx `from` = Circle wallet).
  - [x] Session persists (`settl_party_id`); dashboards redirect correctly.
  - [ ] Optional: provision the wallet *at sign-in* for brand-new parties (today the 2 demo parties are pre-provisioned via script).
  - **AC:** ✅ Both parties run on real Circle Wallets on Arc; the full fund→release path is Circle-signed. `src/lib/circle.ts` + `scripts/provision-wallets.ts`.

**M1 done when:** two Circle-Wallet-backed demo accounts, two tabs, both reach a dashboard.

---

## M2 — Invoice creation + pay link + StableFX quote

_Goal: Maya creates the demo invoice; a pay link renders for Northwind with a locked StableFX quote. No money yet._

- [x] **T2.1 — New Invoice form** (screen 2) — client, amount, USD bill / PHP receive, escrow toggle, 2 milestones, timeout. Persists + returns signed pay link.
  - **AC:** Demo invoice ($1,200 / 2×$600 / escrow on / 7-day auto-release) persists and returns a link.
- [x] **T2.2 — Invoice list on dashboard** (screen 1) — appears as _Awaiting payment_.
- [x] **T2.3 — StableFX quote service** _(replaces generic FX source)_ — `src/lib/fx.ts`
  - [x] USD→PHP quote sourced from **StableFX** (StableFX-shaped wrapper; `FX_SOURCE_URL` → live, else documented fallback), captured + cached server-side at invoice creation.
  - [x] 60-second validity, timestamped, stored in FXQuote table; pay link reads the cached value (no live call at view time).
  - **AC:** Quote is fetched once via StableFX, cached, and the pay link reads it. FXQuote row records `source = stablefx` when a live source is set, `fallback` otherwise.
- [x] **T2.4 — Pay link page (public)** (screen 6) — client→freelancer, total, milestones, "Maya receives ₱X (rate locked 60s)", network fee line, connect-to-fund button. No auth to view.
  - **AC:** Opening the link as Northwind shows the funded quote. No crypto vocab on Maya's side.

**M2 done when:** create→share→view-with-StableFX-quote works end to end.

---

## M3 — Escrow contract on Arc testnet (DEPLOYED)

_Goal: the contract exists, **deploys to Arc testnet**, and passes fund → lock → approve → release on-chain. This is the code-side boss fight AND a hard "functional MVP" requirement._

- [x] **T3.1 — Contract implementation** — `contracts/contracts/SettlEscrow.sol`
  - State machine: DRAFT→FUNDED→[M_LOCKED→M_APPROVED→M_RELEASED]×n→COMPLETED; edge states CANCELLED, REFUNDED (timeout AUTO_REFUND); both milestones funded in one deposit; only payer approves; release irreversible; on-chain timeout + `claimTimeout`.
- [x] **T3.2 — Events** — Funded, MilestoneReleased, MilestoneRefunded, Cancelled (each with invoice id, milestone index, amount).
- [x] **T3.3 — Tests** — `contracts/test/SettlEscrow.test.ts` (13-case matrix passes).
- [x] **T3.4 — Deploy to Arc testnet** ✅ **DONE — SettlEscrow at `0xcca0af9A2BBdB3171d84dA057c115515F8B79db2`**
  - [x] Fill `ARC_RPC_URL`, `ARC_CHAIN_ID`, `USDC_ADDRESS`, `DEPLOYER_PRIVATE_KEY` in `.env`.
  - [x] `cd contracts && npm run deploy:testnet`; set `ESCROW_ADDRESS` / `NEXT_PUBLIC_ESCROW_ADDRESS` from output.
  - [x] Confirm a real testnet tx opens on the Arc explorer.
  - **AC:** ✅ A scripted full cycle (fund→approve→release) completed on Arc testnet via `scripts/full-lifecycle.ts`; tx hashes resolve on the explorer; payee USDC balance increased on-chain.
- [x] **T3.5 — USYC float hook (conceptual)** _(new)_ — `src/lib/usyc.ts`
  - [x] Architecture + code stub showing escrowed USDC routed to **USYC** for yield while milestones are LOCKED, redeemed on release. Documented integration point.
  - **AC:** `circle-integration.md` §5 + a clearly-labelled stub demonstrate the USYC float design; no fake yield numbers presented as real (stub returns principal unchanged).

**M3 done when:** contract is deployed on Arc testnet and a scripted full cycle succeeds on-chain.

---

## M4 — Wire the money path (frontend ↔ deployed contract ↔ Gateway)

_Goal: the real demo money moment — Northwind funds via Circle Wallet, Maya delivers, Northwind approves, release fires on the deployed contract through Gateway. The core slice._

- [x] **T4.1 — Fund escrow from pay link** (screen 6 → confirmation) _(hits the REAL contract)_ — ✅ verified on-chain
  - [x] "Fund" → USDC `approve` → fund call to the **deployed** SettlEscrow via viem (`fundEscrow`), routed through the Gateway seam; Wallets seam signs. Falls back to simulated hash only when `ESCROW_ADDRESS` unset.
  - [x] On success: both milestones _Locked_, fund tx hash visible; invoice → FUNDED; payerId = Northwind. (`api/invoices/[id]/fund`)
  - **AC:** ✅ With `ESCROW_ADDRESS` set, funding executes a real on-chain tx on Arc; tx hash resolves on the explorer (verified via `/api/invoices/[id]/fund`).
- [x] **T4.2 — Mark delivered** (screen 3, Maya) — per-milestone "Mark delivered" → _Awaiting approval_.
- [x] **T4.3 — Approve milestone → release via Gateway** (screen 7, Northwind) — ✅ verified on-chain
  - [x] "Approve M1" → server action → on-chain release on the deployed contract (`approveMilestone`) → payout routed through the **Circle Gateway** seam. Simulated hash only when `ESCROW_ADDRESS` unset.
  - [x] Inline tx line + explorer-linked hash after approval (receipt).
  - **AC:** ✅ With `ESCROW_ADDRESS` set, approving fires the real on-chain release; milestone → _Released_; USDC reaches the payee wallet (verified, 2 milestones released to payee on-chain).

**M4 done when:** the fund→deliver→approve→release loop runs live on Arc testnet across two tabs. ✅ **DONE** — full loop verified on Arc.

---

## M5 — Convert & settle to PHP balance (StableFX + Gateway)

_Goal: on release, USDC converts via StableFX at the locked rate and lands in Maya's PHP balance._

- [x] **T5.1 — Conversion on release** _(via StableFX)_ — `src/lib/convert.ts`
  - [x] Released $600 converts at the **StableFX**-locked rate inside the approve action (`convertUSDCtoPHP`), referencing the FXQuote id; payout routing via the Gateway seam.
  - **AC:** A released $600 converts at the rate shown on the pay link and credits Maya's PHP balance; the conversion references the StableFX quote id (`fxQuoteId`).
- [x] **T5.2 — Balance display** (screen 1, Maya) — dashboard shows PHP balance, updates on release.
  - **AC:** After M1 release, Maya reads ₱33,600; M2 still _Locked_.

**M5 done when:** approving M1 yields a real PHP balance for Maya at the pay-link rate, via StableFX.

---

## M6 — Cash-out stub + receipts + history

_Goal: Maya cashes out (stub), both sides get receipts, invoice history is real._

- [x] **T6.1 — Cash-out stub** (screen 4) — "Cash out ₱X" → GCash modal → Confirm → `CPH-XXXXXXXX` ref + ETA. No real Coins.ph call (documented scope cut).
- [x] **T6.2 — Receipt view** (screen 5) — both parties named, milestone statuses, tx hashes (explorer-linked via `explorerTxUrl`), timestamps, timeout rule, funding tx, and a **Circle products used per step** section.
  - **AC:** A closed/partially-closed invoice renders a clean auditable receipt; tx hashes link to the Arc explorer (real hashes once T3.4 is deployed).
- [x] **T6.3 — Invoice history** — past invoices with status on both dashboards.

**M6 done when:** the full script runs end to end including cash-out and a receipt with real tx hashes.

---

## M7 — Polish + demo prep (async-judged)

_Goal: the path is clean and insured. Note: this is artifact-judged, so weight artifacts over live rehearsal._

- [x] **T7.1 — UI polish on the 7 demo screens** — honest loading states, toasts, inline errors, explorer tx hash visible after fund and release.
  - [x] Fund flow: staged loading (connect→approve→fund), error + retry, success shows the on-chain tx hash with an Arc explorer link (`FundButton`).
  - [x] Deliver + Approve buttons show a pending spinner (`Marking…` / `Releasing…`) via `SubmitButton` (`useFormStatus`) — critical now that approve fires a real ~10s on-chain release.
  - [x] New-invoice form + cash-out: loading states, validation, success/error toasts (already in place, verified).
  - [x] Dashboards: empty states; client "Connected wallet" now shows the real payer address (was the `0x...` placeholder).
  - **AC:** ✅ A non-technical person can follow the screens; every on-chain action surfaces a resolvable tx hash.
- [x] **T7.2 — Pre-demo seed + two-tab setup** — `npx tsx scripts/reset-demo.ts` resets to clean state.
- [ ] **T7.3 — Live failure plan** — cached StableFX quote (no live call at demo time); explorer bookmarked; tx hashes resolve (needs T3.4).
- [ ] **T7.4 — Record fallback demo video** — full ~90s run, plays offline. _(distinct from the M8 presentation video)_
- [ ] **T7.5 — One timed rehearsal** — single clean run under 2:30, no dead clicks. _(reduced from two — async judging)_

**M7 done when:** the path runs clean once on the deployed app and the fallback video exists.

---

## M8 — Submission (scored deliverables) ⭐ NEW

_Goal: produce everything the submission form requires. Most teams under-invest here; we don't._

- [ ] **T8.1 — Circle Developer Account + register** — sign up at `console.circle.com/signup`; register the hackathon; note the account email (the submission ties to it).
  - **AC:** Account live, hackathon registered, email recorded.
- [ ] **T8.2 — Deploy public demo** ⚠️ **required**
  - [ ] Deploy frontend + backend + Postgres to the VPS (Docker Compose); public HTTPS URL; persistent demo seed.
  - **AC:** A judge can open the URL and run the full path with no local setup.
- [x] **T8.3 — Architecture diagram** ⚠️ **required** — `docs/architecture.md`
  - [x] Mermaid diagram: Circle Wallets → SettlEscrow on Arc → Gateway → StableFX → USYC float → PHP off-ramp, plus the milestone state machine + a code-location table.
  - **AC:** Diagram shows every Circle product and where it's used; matches the running app. _(Renders on GitHub; export to PNG for the submission form if an image is required.)_
- [ ] **T8.4 — Presentation video** ⚠️ **required** _(distinct from T7.4)_
  - [ ] Succinct walkthrough of core functions + **effective use of each Circle tool**, with supporting narration.
  - **AC:** Video clearly maps each feature to the Circle product behind it.
- [~] **T8.5 — GitHub repo + integration docs** ⚠️ **required** — README written; **you still push to a public repo**
  - [x] Full setup instructions + a **"How each Circle tool is integrated"** table/section in `README.md` (Wallets, StableFX, USYC, Gateway, USDC, CCTP), linking the per-product spec + feedback.
  - **AC:** A stranger can clone, configure, and run from the README; Circle integration is documented per product. _(Remaining: `git init` + push to a public GitHub repo.)_
- [x] **T8.6 — "Circle Product Feedback" section** ⚠️ **required, scored** — `docs/circle-feedback.md`
  - [x] Why each product was chosen, what worked, what could improve, DX/scalability recommendations — per product, honest about which were live vs. conceptual.
  - **AC:** Specific, honest, per-product feedback; no filler.
- [ ] **T8.7 — Final submission form** — title, short description, track (1), Circle Developer email, **Circle products checklist** (USDC, Wallets, Gateway, StableFX, USYC, +CCTP if done), MVP + diagram, video, repo, demo URL, feedback.
  - **AC:** Form submitted before deadline with every field complete.

**M8 done when:** the submission is filed with all required artifacts and the Circle products checklist reflects what's actually wired.

---

## Out of scope — rejected for MVP

Card on-ramp UI · multi-corridor / currency picker beyond PHP · dispute resolution · file upload beyond "Mark delivered" · team/multi-seat · recurring invoices / streaming · accounting exports · native mobile app · push/email notifications · settings pages beyond onboarding · real Coins.ph API (cash-out stays stubbed) · CCTP cross-chain funding _(stretch only, not required)_.

_If it isn't in M0–M8, it doesn't get built for the submission._

---

## Critical path

```
M0 → M1 (Circle Wallets) → M2 (StableFX quote) → M3 (DEPLOY contract) → M4 (real money path + Gateway) → M5 (StableFX convert) → M6 → M7 → M8 (submission)
```

- **M3.4 deploy is the new hard gate** — M4 cannot be "functional" until the contract is live on Arc testnet. Do it first.
- M3 (contract) can run in parallel with M2 (invoice + StableFX quote); they don't touch until M4.
- **Biggest risks:** (1) on-chain correctness on a testnet you don't control (M3→M4), (2) StableFX/USYC access latency — start access requests on day 1, build StableFX-shaped fallbacks so a gate never blocks the path.
- **M8 is not optional polish** — a missing diagram, public URL, or feedback section costs scored points regardless of how good the app is.

---

## Remaining actions (in order)

1. **Day 1:** Create Circle Developer Account + register hackathon (T8.1). Request StableFX + USYC access (gated-tooling form + email).
2. Write `docs/circle-integration.md` (T0.6).
3. **Fill `.env`** with Arc testnet creds → `cd contracts && npm install && npm test` (verify 13 pass) → `npm run deploy:testnet`, copy address (T3.4).
4. Swap in **Circle Wallets** onboarding (T1.3) and corridor seed (T1.2a).
5. Wire **StableFX** quote (T2.3) and conversion (T5.1).
6. Make the fund/release path hit the **deployed contract via Gateway** (T4.1, T4.3); add **USYC** float stub (T3.5).
7. Receipts with real tx hashes (T6.2); UI polish (T7.1).
8. **Deploy public demo URL** (T8.2).
9. Architecture diagram (T8.3), presentation video (T8.4), repo + integration docs (T8.5), Circle Product Feedback (T8.6).
10. Fallback video (T7.4); one rehearsal (T7.5).
11. **Submit** (T8.7) before the deadline.
