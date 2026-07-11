# Settl — Judge Interview Q&A

A prep sheet for hackathon judging. Questions grouped by theme, with answers grounded
in the actual code so nothing here over-claims. Where an integration is *shaped* or
*conceptual* rather than *live*, the answer says so plainly — judges reward honesty and
penalize fabricated "live" claims.

> **Status vocabulary** (use these exact words — they're in the README and integration spec):
> - **Live** = wired against the real Circle SDK/endpoint in the running app.
> - **Shaped** = real interface + working fallback; flip one env var / drop in the SDK call to go live.
> - **Conceptual** = documented design + clearly-labelled stub; no fabricated numbers.

---

## 1. The pitch / problem

**Q: What does Settl do, in one sentence?**
Settl is a freelancer payout rail with built-in escrow protection on the UAE → Philippines
corridor: a UAE company pays a Manila freelancer in USDC on Arc, with milestone-gated
escrow release and a PHP off-ramp.

**Q: Who are the two users in the demo?**
- **Maya** — a Manila-based freelancer (the payee). She signs in email-only and never sees
  crypto vocabulary.
- **Northwind** — a UAE company (the payer/client). It funds the invoice in USDC and approves
  milestones.

**Q: Why does this need crypto / blockchain at all? Why not Wise or PayPal?**
The differentiator isn't the transfer — it's the **on-chain escrow + milestone trust layer**.
Funds lock on funding and release *only* on the payer's per-milestone approval (or a pre-agreed
timeout). Neither side has to trust the other or a custodial intermediary: the contract is
non-custodial and never moves funds without payer approval or an elapsed timeout. A traditional
rail can't give a freelancer that cryptographic guarantee that the money is already locked and
earmarked for them.

**Q: What problem does the milestone model solve specifically?**
The classic freelancer fear ("will I get paid after I deliver?") and the client fear ("will I
get the work after I pay?"). Escrow funds upfront answers the freelancer; milestone-gated release
answers the client. The 7-day auto-release timeout means a passive/absent client can't trap funds
forever.

---

## 2. Architecture / how it works

**Q: Walk me through the end-to-end flow.**
1. Maya creates a $1,200 invoice (2 × $600 milestones, escrow on, 7-day auto-release).
2. A USD→PHP FX quote is captured and locked at creation time.
3. She shares a pay link.
4. Northwind funds in USDC → both milestones lock in the escrow contract on Arc.
5. Maya marks milestone 1 delivered.
6. Northwind approves milestone 1 → $600 releases on-chain to Maya's wallet.
7. The released USDC converts to ₱33,600 at the *locked* quote and credits Maya's PHP balance.
8. Maya cashes out to GCash (stubbed off-ramp).
9. Both sides get a receipt with real tx hashes that resolve on the Arc explorer.

**Q: What's the tech stack?**
- **Frontend/backend:** Next.js (App Router) — API routes under `src/app/api/...`, pages under `src/app/...`.
- **Smart contract:** `SettlEscrow.sol` (Solidity ^0.8.24), deployed on Arc testnet, tested with Hardhat.
- **Chain client:** viem (`src/lib/escrow.ts`, `src/lib/chain.ts`).
- **DB:** Prisma + SQLite for local dev (`src/lib/db.ts`, `prisma/`).
- **Circle SDK:** `@circle-fin/developer-controlled-wallets`.

**Q: Why a single contract keyed by invoiceId instead of one contract per invoice?**
Gas and simplicity. `SettlEscrow` holds a `mapping(bytes32 => Invoice)` so one deployed contract
serves every invoice. The `bytes32` key is `keccak256(invoiceId)` — see `toInvoiceKey()` in
`src/lib/escrow.ts`. No factory, no per-invoice deployment cost.

**Q: How do you keep the off-chain DB and on-chain state in sync?**
The contract emits events (`Funded`, `MilestoneReleased`, `MilestoneRefunded`, `Cancelled`).
`src/lib/listener.ts` uses viem's `watchContractEvent` to reconcile. The on-chain state is the
source of truth for money movement; the DB mirrors it for UI and records `Transaction` rows with
tx hashes.

---

## 3. Circle integration (the scored part)

**Q: Which Circle products do you use, and which are actually live?**

| Product | Role | Status |
| ------- | ---- | ------ |
| **USDC** | Settlement + escrow asset (6-decimal, on Arc) | **Live** |
| **Circle Wallets** | Embedded wallets for both parties; Maya signs in email-only | **Shaped → Live** |
| **Circle Gateway** | Routes fund + release/payout movements | **Shaped** |
| **StableFX** | USD→PHP quote (locked) + conversion on release | **Shaped** |
| **USYC** | Yield on escrowed float while milestones are LOCKED | **Conceptual** |
| **CCTP / Bridge Kit** | Cross-chain funding | **Conceptual (stretch)** |

I want to be precise about this: USDC is genuinely live and moves real testnet value on Arc.
Circle Wallets is live when `CIRCLE_API_KEY` + `CIRCLE_ENTITY_SECRET` are set — both demo parties
are then backed by real Circle developer-controlled wallets. Gateway and StableFX are *shaped*:
real interface, working fallback, one env var from live. USYC is conceptual by design — a
documented integration point with a labelled stub, no fabricated yield numbers.

**Q: Explain the Circle Wallets integration in detail.**
We use **developer-controlled wallets** from `@circle-fin/developer-controlled-wallets`.
- One-time setup (`scripts/register-entity-secret.ts`) generates a 32-byte Entity Secret and
  registers its ciphertext with Circle.
- `src/lib/circle.ts` lazily initializes the client and exposes `ensureWalletSet()`,
  `provisionWallet()`, `executeContract()`, and `waitForCircleTx()`.
- `scripts/provision-wallets.ts` provisions one EOA wallet per demo party on `ARC-TESTNET` and
  stores `circleWalletId` + `walletAddress` on the `Party` record.
- At fund time (`src/app/api/invoices/[id]/fund/route.ts`), if the payer has a `circleWalletId`,
  we call `fundEscrowViaCircle()` — Circle signs and broadcasts the `approve` + `fund` calls.
  Settl never holds the key, so the non-custodial posture is preserved.

**Q: Why EOA wallets and not smart-contract accounts?**
On Arc, gas is paid in native USDC, so an EOA self-pays gas — no paymaster needed. That's the
comment in `provisionWallet()` in `src/lib/circle.ts`. It keeps the demo simple without sacrificing
correctness.

**Q: What's the fallback when Circle Wallets isn't configured?**
The fund route falls through to `fundEscrow()`, which signs via `DEPLOYER_PRIVATE_KEY` using viem.
The money path is functionally identical — same on-chain `approve` + `fund` — it just loses Circle's
key custody. This is documented, not hidden. And if the escrow contract itself isn't deployed
(`ESCROW_ADDRESS` unset), we generate a clearly-labelled simulated tx hash so the UI is demoable
pre-deploy.

**Q: How does StableFX work here, and what happens if you don't have access?**
`getUsdToPhpQuote()` in `src/lib/fx.ts` fetches one USD→PHP quote at invoice creation, caches it
60s server-side, and writes an `FXQuote` row tagged `source = "stablefx"`. On release,
`convertUSDCtoPHP()` in `src/lib/convert.ts` converts at the *locked* quote and references the
quote id, so the conversion is auditable back to the rate the user was shown. The shaped fallback
drives the rate from `FX_FALLBACK_RATE` (default 56.00) and tags `source = "fallback"`. The
*mechanism* — quote once, cache, lock, reference on convert — is real; only the price source is the
fallback. Reading from cache at view time is also our demo failure plan: no live call can fail mid-demo.

**Q: Tell me honestly about USYC — is it real?**
No, it's **conceptual** and I won't pretend otherwise. The idea: while milestones sit LOCKED, the
escrowed USDC is idle float that could earn yield in USYC, redeemed back to USDC on release. The
artifact is `src/lib/usyc.ts` — a labelled stub with `routeToUSYC` / `redeemFromUSYC` that returns
principal unchanged and marks the exact mint/redeem hook points. We surface **no fake APY** in the
UI. It's the "your money works while it's protected" story, designed in but not claimed as live.

**Q: Where's the seam between shaped and live? How hard is "go live"?**
Env-gated. `CIRCLE_API_KEY` flips Wallets/Gateway/StableFX from fallback to live calls;
`FX_SOURCE_URL` flips the FX source; `ESCROW_ADDRESS` enables the real on-chain path. The
`submitViaGateway()` shim in `src/lib/escrow.ts` is a one-line swap to route through Gateway.
The full env-var → product map is in `docs/circle-integration.md`.

---

## 4. Smart contract deep-dive

**Q: Walk me through the contract state machine.**
Per invoice: `DRAFT → FUNDED → COMPLETED`, with `DRAFT → CANCELLED` (before funding) and a
timeout path to `REFUNDED`. Per milestone: `LOCKED → RELEASED` (via `approve` or AUTO_RELEASE
timeout) or `LOCKED → REFUNDED` (AUTO_REFUND timeout). `_checkCompletion()` flips the invoice to
COMPLETED once every milestone is resolved.

**Q: Who can do what?**
- `createInvoice` — anyone (the Settl backend), before funding. Sets payee + milestone amounts.
- `fund` — anyone; the caller *becomes* the recorded payer. Requires a prior `USDC.approve`.
- `approve(invoiceId, idx)` — **only the recorded payer**. Releases that milestone's USDC to the payee. Irreversible.
- `claimTimeout(invoiceId, idx)` — **permissionless**, but only after the timeout window elapses from `fundedAt`. Routes by `timeoutDefault`.
- `cancel` — **only the payee**, and only while DRAFT (before a payer is set).

**Q: How does funding actually move money?**
`fund()` sums milestone amounts and does `usdc.transferFrom(msg.sender, address(this), total)`.
That's why the client side does an ERC-20 `approve(escrow, total)` first — both in the viem path
(`fundEscrow`) and the Circle path (`fundEscrowViaCircle` calls `approve(address,uint256)` then
`fund(bytes32)`).

**Q: What stops the payer from clawing funds back after the freelancer delivers?**
Nothing — that's the point. `approve()` is irreversible and there's no payer-side withdraw.
Once a milestone is RELEASED, the USDC is transferred to the payee in the same call. The only
refund path is `claimTimeout` with `AUTO_REFUND`, and that only fires if the milestone was never
approved *and* the timeout elapsed.

**Q: Why is `claimTimeout` permissionless?**
So neither party can grief the other by refusing to "press the button." After the window, anyone
(including a keeper or the freelancer) can trigger the pre-agreed default — AUTO_RELEASE pays the
freelancer, AUTO_REFUND returns to the payer. The *direction* is fixed at invoice creation, so
making the *call* permissionless is safe.

**Q: Any reentrancy or security concerns?**
State is updated before the external `usdc.transfer` in `approve` and `claimTimeout`
(status set to RELEASED/REFUNDED first), so a malicious token can't re-enter into a double-release.
USDC is a known, trusted ERC-20, not arbitrary. Milestone count is capped at 10. Checks use
`require` with clear messages. For production I'd add OpenZeppelin `ReentrancyGuard` and `SafeERC20`
as belt-and-suspenders, and consider access control on `createInvoice`.

**Q: You return bool from transfer — what about non-standard ERC-20s?**
We `require()` the boolean return, which works for USDC. For a general token set I'd switch to
`SafeERC20.safeTransfer` to handle tokens that don't return a bool. Since the contract is hard-wired
to USDC via the immutable `usdc` set in the constructor, this is acceptable for the demo.

---

## 5. Data / units / correctness

**Q: There's a units mismatch risk — cents vs 6-decimal USDC. How do you handle it?**
The app speaks USD minor units as cents (2 decimals); the contract speaks 6-decimal USDC.
`src/lib/money.ts#centsToUsdc` converts at every contract boundary. The fund route calls it before
passing the amount on-chain. This is the single most error-prone spot, so it's isolated to one helper.

**Q: How is an invoice mapped to the on-chain key?**
`keccak256(toHex(invoiceId))` — `toInvoiceKey()` in `src/lib/escrow.ts`. The DB string id maps
deterministically to the contract's `bytes32` key.

---

## 6. Trade-offs / "what's not real"

**Q: What's faked or stubbed in the demo?**
Being upfront: the GCash off-ramp is a stub (no real PHP payout). USYC is conceptual. Gateway and
StableFX run through working fallbacks unless live env is set. If `ESCROW_ADDRESS` is unset, the
fund path returns a simulated hash. Everything faked is *labelled* in code and docs — we never dress
a stub up as live.

**Q: What would you build next with more time?**
1. Wire StableFX + Gateway live (interfaces already exist — env flip + SDK call).
2. Implement USYC mint/redeem on the LOCKED float for real yield.
3. CCTP for cross-chain funding so Northwind can pay from USDC on any chain.
4. Real GCash/PH bank off-ramp via a licensed partner.
5. Access control + `ReentrancyGuard` + `SafeERC20` hardening on the contract; a formal audit.

**Q: Why SQLite? Isn't that toy-grade?**
For local dev and demo, yes deliberately. Prisma abstracts the DB, so production swaps the
`DATABASE_URL` to Postgres with no code change. The DB is a mirror of on-chain truth, not the
custody layer, so its durability requirements are lower than they look.

---

## 7. Likely curveballs

**Q: If the FX rate moves between invoice creation and release, who eats the difference?**
By design the rate is locked at creation and the conversion references that quote id, so the
freelancer gets the rate they were shown. In a live deployment the spread/risk would sit with the
FX provider (StableFX) at execution; here the locked-quote model makes the UX deterministic and the
receipt auditable.

**Q: What if Circle's API is down during the demo?**
The fund path degrades gracefully: no Circle config → viem signer; no escrow address → simulated
hash. FX reads from a 60s cache, not a live call at view time. The demo can't hard-fail on an
external outage.

**Q: Is this custodial? Where do keys live?**
Non-custodial in posture. The contract never moves funds without payer approval or an elapsed
timeout. With Circle Wallets live, Circle holds the signing keys (developer-controlled) and Settl
never touches them. In the gated fallback, the demo signer key (`DEPLOYER_PRIVATE_KEY`) is a
demo-only convenience, clearly documented.

**Q: Why Arc specifically?**
Arc is Circle's chain where USDC is the native gas token, so a Circle EOA self-pays gas in USDC —
no separate gas token, no paymaster. That removes the single most confusing thing for a non-crypto
user like Maya.

**Q: What's the one thing you're proudest of?**
That the money path is honest end-to-end: real 6-decimal USDC, a real audited-shape escrow contract
with a 13-case test matrix, real tx hashes that resolve on the explorer — and that every place we
*couldn't* go live is labelled as shaped or conceptual rather than faked.
