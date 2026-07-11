# Settl — Data Model

**Five tables.** Plain Postgres. Maps 1:1 to the screens and the contract states — no orphan fields, nothing the demo doesn't read or write. The chain is the source of truth for money state; the DB mirrors it via the event listener and adds the off-chain context (names, emails, invoice metadata, FX quote) the chain doesn't carry.

**Design rule:** money-state truth lives on-chain. The DB's `status` fields are a cache updated by the event listener. Screens read the DB. Nothing writes a "released" status to the DB optimistically — only the MilestoneReleased event does.

---

## Table: `parties`

A user — either a freelancer (payee) or a client (payer).

| Field | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `role` | enum `FREELANCER` \| `CLIENT` | |
| `display_name` | text | "Maya Reyes" / "Northwind Labs" |
| `email` | text nullable | required for freelancer onboarding; clients identified by wallet |
| `wallet_address` | text nullable | payer's connected wallet; or freelancer's auto-provisioned receiving address (never shown in UI) |
| `receive_currency` | enum `PHP` | MVP: PHP only. Enum leaves room for later. |
| `balance_minor` | bigint default 0 | freelancer's settled balance in **minor units** of receive_currency (centavos). `33600.00 PHP` = `3360000`. Integer math only — never float for money. |
| `gcash_handle` | text nullable | stubbed linked GCash, e.g. masked "•••42" |
| `created_at` | timestamptz | |

---

## Table: `invoices`

| Field | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `payee_id` | uuid FK → parties | the freelancer |
| `client_name` | text | as typed at creation (client may not have an account yet) |
| `client_email` | text | |
| `payer_id` | uuid FK → parties nullable | set when the client connects a wallet and funds |
| `amount_minor` | bigint | total in **minor units of billing currency** (USD cents). $1,200 = `120000`. |
| `billing_currency` | enum `USD` | MVP: USD only |
| `receive_currency` | enum `PHP` | copied from payee at creation |
| `escrow` | boolean | true = conditional path, false = fast path |
| `timeout_days` | int default 7 | review window |
| `timeout_default` | enum `AUTO_RELEASE` \| `AUTO_REFUND` | what fires when the window lapses. Demo uses AUTO_RELEASE. |
| `status` | enum (see below) | mirrors contract; updated by event listener |
| `pay_token` | text unique | signed token for the public pay link |
| `contract_invoice_id` | text nullable | the invoice id as known to the on-chain contract (or contract address if one-contract-per-invoice — see contract-spec) |
| `fx_quote_id` | uuid FK → fx_quotes nullable | the rate locked at creation |
| `created_at` | timestamptz | |
| `funded_at` | timestamptz nullable | set on Funded event |

**`invoices.status` enum:** `DRAFT` → `AWAITING_PAYMENT` → `FUNDED` → `PARTIALLY_RELEASED` → `COMPLETED`. Edge: `EXPIRED`, `CANCELLED`, `REFUNDED`.

> `DRAFT` vs `AWAITING_PAYMENT`: DRAFT is pre-link (rarely used in MVP — we go straight to AWAITING_PAYMENT on "Create & copy link"). Keep DRAFT in the enum for the fast-path/save-later case; demo skips it.

---

## Table: `milestones`

| Field | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `invoice_id` | uuid FK → invoices | |
| `idx` | int | 0-based order; **matches the milestone index used by the contract** |
| `label` | text | "First designs" / "Final handoff" |
| `amount_minor` | bigint | in billing currency minor units. Sum of milestones MUST equal invoice.amount_minor (enforced at creation). |
| `status` | enum (see below) | mirrors contract; updated by event listener |
| `release_tx_hash` | text nullable | set on MilestoneReleased event |
| `released_at` | timestamptz nullable | |
| `delivered_at` | timestamptz nullable | set when freelancer clicks "Mark delivered" (off-chain only) |

**`milestones.status` enum:** `LOCKED` → `AWAITING_APPROVAL` → `RELEASED`. Edge: `REFUNDED`, `EXPIRED_RELEASED` (released via timeout rather than manual approval — can collapse into RELEASED if you prefer; keep separate only if the receipt should distinguish them).

> `AWAITING_APPROVAL` is purely off-chain — it's set when Maya marks delivered. The contract doesn't know about delivery; it only knows LOCKED vs RELEASED. This is intentional: delivery is a UX signal, approval is the on-chain action.

---

## Table: `transactions`

Every on-chain or stubbed money event, for the receipt and history.

| Field | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `invoice_id` | uuid FK → invoices | |
| `milestone_id` | uuid FK → milestones nullable | null for invoice-level events like FUND |
| `type` | enum `FUND` \| `RELEASE` \| `CONVERT` \| `CASHOUT` \| `REFUND` | |
| `tx_hash` | text nullable | on-chain hash (null for CASHOUT stub) |
| `amount_minor` | bigint | |
| `currency` | enum `USD` \| `PHP` | RELEASE is USD-side, CONVERT/CASHOUT are PHP-side |
| `fx_rate` | numeric nullable | for CONVERT rows; rate applied |
| `external_ref` | text nullable | CASHOUT fake ref `CPH-XXXXXXXX` |
| `created_at` | timestamptz | |

> A single milestone approval produces, in order: a RELEASE row (USDC out of escrow, has tx_hash) and a CONVERT row (USDC→PHP, has fx_rate). CASHOUT is separate, freelancer-initiated, no tx_hash.

---

## Table: `fx_quotes`

| Field | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `from_currency` | enum `USD` | |
| `to_currency` | enum `PHP` | |
| `rate` | numeric | `56.00` = 1 USD → 56 PHP |
| `source` | text | which FX source produced it |
| `created_at` | timestamptz | |
| `valid_until` | timestamptz | created_at + 60s |

> Captured once at invoice creation, cached, attached to the invoice. The pay link reads this — **no live external FX call at view time** (per the demo failure plan). Conversion on release uses this locked rate so the freelancer's "you receive ₱X" promise holds.

---

## Relationships

```
parties (1) ──< invoices (payee_id)
parties (1) ──< invoices (payer_id, nullable)
invoices (1) ──< milestones
invoices (1) ──< transactions
milestones (1) ──< transactions (nullable)
invoices (1) ──> fx_quotes (one locked quote)
```

---

## Money representation — the one rule that matters

**All money is stored as integer minor units. Never floats.** USD in cents, PHP in centavos. FX rate is the only `numeric`. Convert with integer math and round once, explicitly, at the conversion boundary (USDC→PHP). A floating-point bug in a payments demo is the kind of thing a judge catches live.

Worked example for the demo:
- Invoice: `amount_minor = 120000` (USD $1,200.00)
- Each milestone: `amount_minor = 60000` ($600.00)
- FX rate: `56.00`
- On M1 release: `60000 (USD cents) × 56.00 = 3360000` (PHP centavos = ₱33,600.00) → credited to `parties.balance_minor`.

---

## What's deliberately NOT modeled

- No `users`/`auth` table beyond `parties` — onboarding is minimal; wallet or email identifies the party.
- No `disputes` table — there is no dispute system.
- No `files`/`deliverables` table — "Mark delivered" is a timestamp, not an upload.
- No `corridors`/`currencies` config table — PHP/USD hardcoded via enums for MVP.
- No `notifications` table — toasts are ephemeral, no email beyond the pay-link share.

If a future feature needs one of these, it's a post-MVP migration, not a demo blocker.
