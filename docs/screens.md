# Settl — Screen Inventory

**Seven screens. That's the entire build surface for the demo.** Each section is everything a dev needs to build that screen: what it shows, what actions it exposes, what state it reads, what it writes/triggers. Derived directly from `demo-script.md`. If a screen isn't here, it doesn't exist for the MVP.

**Language rule reminder:** on Maya's (freelancer) screens, these words are banned in UI copy — *wallet, gas, USDC, stablecoin, on-chain, blockchain, smart contract, signature, address*. On Northwind's (client) screens, only *Connect wallet, Approve in wallet, Network fee, USDC balance* are allowed.

---

## Screen 1 — Freelancer Dashboard (Maya)

**Route:** `/` (authenticated as freelancer)
**Purpose:** Maya's home. Shows her balance, her invoices, and the entry point to create one and to cash out.

**Shows:**
- Header with display name.
- **Balance card:** PHP balance (e.g. `₱33,600`). Reads from Party.balance. Updates after a milestone release.
- **Cash out** button on the balance card (only enabled when balance > 0). → opens Screen 4.
- **+ New invoice** button → Screen 2.
- **Invoice list:** each row = client name, total, status badge, receive amount. Tap → Screen 3.

**Reads:** Party (balance, currency), Invoice list (where payee = this user) with derived status.

**Writes / triggers:** none directly. Navigation only.

**States to handle:** empty (no invoices yet → friendly empty state), populated, balance zero vs positive.

---

## Screen 2 — New Invoice (Maya)

**Route:** `/invoices/new`
**Purpose:** Maya creates the demo invoice and gets a shareable pay link.

**Shows / fields:**
- Client name (text) — *Northwind Labs*
- Client email (text) — *finance@northwind.xyz*
- Amount (number) + currency dropdown (USD, locked to USD for MVP)
- **Receive in** (dropdown, defaults PHP — only PHP available in MVP)
- **Hold in escrow, release per milestone** toggle (default ON for demo)
- Milestone editor (only visible when escrow ON): add rows, each = label + amount. Two rows for demo: "First designs" $600, "Final handoff" $600. Validation: milestone sum must equal total.
- **If no response within** dropdown: `7 days → auto-release to freelancer` (default). Other option exists in data but demo uses this.
- **Create & copy link** button.

**Reads:** current user (payee).

**Writes / triggers:**
- Creates Invoice (status DRAFT) + Milestones.
- Calls FX quote service → creates FXQuote, attaches to invoice.
- Generates signed pay-link token.
- Copies link to clipboard, toast "Link copied", navigate to Screen 1 with new invoice listed as *Awaiting payment*.

**States to handle:** validation errors (milestone sum mismatch, empty fields), escrow toggle off hides milestone editor (fast path — not demoed but must not break).

---

## Screen 3 — Invoice Detail (Maya)

**Route:** `/invoices/:id` (as payee)
**Purpose:** Maya watches escrow status and acts on her side — mark delivered, then later cash out.

**Shows:**
- Invoice header: client name, total, status badge (*Awaiting payment* / *Funded — in escrow* / *Paid*).
- Milestone list, each: label, receive amount (`₱33,600 on release`), status (*Locked* / *Awaiting approval* / *Paid*), and tx link once released.
- Per-milestone action: **Mark delivered** button (only when milestone is *Locked* and invoice is FUNDED). No file upload — single click.
- Timeout rule shown as plain text: "If not approved within 7 days, releases to you."
- Link to **Receipt** (Screen 5) once anything is paid.

**Reads:** Invoice + Milestones + Transactions for this invoice.

**Writes / triggers:**
- **Mark delivered** → milestone status → AWAITING_APPROVAL (DB only, no chain call). Northwind's side then shows "ready for review."

**States to handle:** before funding (milestones greyed, no actions), funded (mark-delivered available), awaiting approval (button disabled, "waiting on client"), released (tx link shown).

---

## Screen 4 — Cash Out (Maya) — modal + confirmation

**Route:** modal over Screen 1 (or `/cash-out`)
**Purpose:** Maya moves her PHP balance to GCash. **Stub** — no real API call.

**Shows:**
- Modal: "Send `₱33,600` to GCash •••42 via Coins.ph" + **Confirm** / Cancel.
- On Confirm → confirmation screen: "On its way. Reference `CPH-XXXXXXXX` · est. arrival 3 min." (ref generated client-side, fake format).

**Reads:** Party.balance, linked GCash (stubbed value).

**Writes / triggers:**
- Decrements balance to 0 (DB), creates a Transaction row type=CASHOUT with the fake ref.
- Cannot error. Hardcoded success.

**States to handle:** balance zero (button disabled upstream), success only.

---

## Screen 5 — Receipt (both sides)

**Route:** `/invoices/:id/receipt`
**Purpose:** The audit trail. Proves what happened, ties everything to the job.

**Shows:**
- Both parties named (client + freelancer).
- Total, per-milestone breakdown: amount, status, **tx hash with explorer link** for released ones, timestamps.
- FX rate used (`$1 = ₱56.00`).
- Timeout rule as agreed.
- Cash-out reference if cashed out.

**Reads:** Invoice + Milestones + Transactions + FXQuote.

**Writes / triggers:** none. Read-only.

**States to handle:** partially complete (M1 paid, M2 locked) and fully complete.

---

## Screen 6 — Pay Link (Northwind) — public

**Route:** `/pay/:token` (no auth to view; wallet connect to act)
**Purpose:** Northwind sees the deal and funds escrow. The payer's entry point.

**Shows (clean, large):**
- "Northwind Labs → Maya Reyes"
- "$1,200 · 2 milestones · funds held until you approve each one"
- Milestone list with labels + amounts.
- **Receive box:** "Maya receives `₱67,200` (rate locked 60s · $1 = ₱56.00)". Reads cached FXQuote — no live external call.
- **Network fee:** "~$0.04, paid in USDC."
- **Connect wallet** button → after connect → **Fund escrow — 1,200 USDC**.

**Reads:** Invoice + Milestones + cached FXQuote via signed token (no login).

**Writes / triggers:**
- Connect wallet (library).
- **Fund escrow** → contract `fund()` call (signature) → on Funded event: Invoice → FUNDED, milestones → LOCKED. Then renders confirmation: "Funded. Both milestones locked. Maya can start work." with per-milestone explorer links.

**States to handle:** not connected, connected/ready to fund, funding (≤1s spinner — do not fake long load), funded (confirmation), already-funded (if link reopened, show funded state, not the fund button).

---

## Screen 7 — Invoice Detail (Northwind) — client view

**Route:** `/invoices/:id` (as payer, authenticated by wallet)
**Purpose:** Northwind reviews delivered milestones and approves to release.

**Shows:**
- Invoice header, milestones with status.
- Banner when a milestone is awaiting approval: "M1 ready for your review."
- Per-milestone **Approve** button (only when milestone is AWAITING_APPROVAL).
- After approve: milestone → *Released*, inline "Converted on-chain · rate $1=₱56 · tx 0x…" + explorer link.
- USDC balance reference (allowed on client side).

**Reads:** Invoice + Milestones + Transactions, connected wallet.

**Writes / triggers:**
- **Approve M1** → contract `approve(milestoneIndex)` (signature) → on MilestoneReleased event: triggers conversion (Screen 5 / balance logic), milestone → RELEASED, Transaction row created with tx hash.

**States to handle:** awaiting payment (nothing to approve), funded but nothing delivered (approve disabled), milestone awaiting approval (approve enabled), released (tx shown).

---

## Shared infrastructure (not screens, but required)

- **Onboarding (one screen, used once before demo):** freelancer = email + name + receive-currency; payer = wallet connect. Auto-provision freelancer receiving address in background, never display it.
- **Wallet connect:** library/modal, not a custom screen.
- **Toast/notification system:** for "Link copied", funding success, release.
- **Explorer link-out:** plain `<a target="_blank">` to ARC testnet explorer + tx hash.
- **Event listener:** backend watches contract events (Funded, MilestoneReleased) and updates DB. Screens read DB state — they do not derive truth optimistically from the wallet.

---

## Screen ↔ script cross-check

| Script beat | Screen |
|---|---|
| 0:15 Maya creates invoice | 2 → 1 |
| 0:30 Northwind opens link, funds | 6 |
| 0:50 Maya sees funded, marks delivered | 3 |
| 1:05 Northwind approves M1 | 7 |
| 1:05 Maya's balance updates | 1 |
| 1:25 Block explorer | link-out from 7 / 5 |
| 1:45 Cash out | 4 |
| 2:00 Receipt + close | 5 |

Every beat maps to a screen on this list. No beat needs a screen that isn't here. No screen here is unused.
