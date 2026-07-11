# Settl — Demo Script

**Status:** locked. This is the single transaction we walk through on demo day. Every screen, contract state, and partner stub in the MVP exists to serve this script. Anything not on this page is out of scope for the hackathon build.

**Runtime target:** 90 seconds of live click-through, plus ~30 seconds of framing before and ~30 seconds of close after. Total stage time: ~2:30.

---

## 1. The cast

| | |
|---|---|
| **Client** | Northwind Labs — Web3 studio, Berlin. Holds USDC. Crypto-native on the payer side. |
| **Freelancer** | Maya Reyes — UI designer, Manila. Non-technical. Wants pesos in GCash. Has never touched crypto and will not need to. |
| **Job** | UI design engagement, **$1,200 total**, split into **two $600 milestones**: M1 = first designs, M2 = final handoff. |
| **Corridor** | Berlin → Manila. USDC in, PHP out. |
| **Path** | Conditional (escrow + milestone approval). Fast path exists in the product but is not demoed. |

---

## 2. Stub / real boundary

Decide once, here. No ambiguity downstream.

| Component | Demo day status | Notes |
|---|---|---|
| Smart wallet for payer (Northwind) | **Real** | Connect via standard wallet flow on ARC testnet. |
| Email-only onboarding for freelancer (Maya) | **Real, minimal** | Email + display name + receive-currency picker. No smart wallet shown to her. Her receiving address is auto-provisioned in the background and never surfaced. |
| Invoice creation + share link | **Real** | Persisted in our DB, signed link. |
| Live FX quote on pay link | **Real** | Pulled from a single FX source (oracle or partner quote endpoint). Quote is timestamped; 60-second validity. |
| Escrow contract on ARC testnet | **Real** | Fund → lock → approve → release. Both milestones funded at once at deposit time. |
| USDC → PHP-stablecoin conversion on release | **Decide now: stablecoin-pair swap fallback** | StableFX access is not guaranteed by demo day. Building against the fallback removes a dependency we can't control. If StableFX access lands before demo, we swap the implementation behind the same interface. We do **not** hedge in the pitch — we say "settled to PHP on-chain" and show the result. |
| PHP-stablecoin balance for Maya | **Real** | Visible in her dashboard, updates on release. |
| Coins.ph cash-out to GCash | **Stub** | Confirmation screen + fake reference number (`CPH-XXXXXXXX`) + "Funds en route to GCash ending in •••42, est. arrival 3 minutes." No real API call. |
| Card on-ramp (Transak / Stripe) | **Cut from demo** | Northwind pays in USDC. Card path is roadmap. |
| Timeout / auto-release on no-approval | **Built, not demoed** | Set at invoice creation, stored on-chain, mentioned verbally in the script. Not triggered live. |
| Dispute resolution | **Not built. Not mentioned.** | |
| Block explorer link-out | **Real** | One click from the receipt opens the ARC testnet explorer to the actual release transaction. This is the proof moment. |
| Receipts + invoice history | **Real** | Both sides see the closed invoice with timestamps and tx hashes. |

---

## 3. Language rules for the UI (and the presenter)

These are non-negotiable for any copy in the demo screens.

**Maya's side — banned words:** wallet, gas, USDC, stablecoin, on-chain, blockchain, smart contract, signature, seed phrase, address. She sees: *invoice, milestone, approved, paid, balance, PHP, cash out, GCash, bank.*

**Northwind's side — allowed crypto vocabulary:** *Connect wallet, Approve in wallet, Network fee, USDC balance.* That's it. No "gas." No chain name in body copy (the chain logo is fine in a footer). No mention of "escrow contract" — say *"funds held until you approve."*

**Presenter:** says "settled in under a second" once. Says "non-custodial" zero times during the live walkthrough — it goes in the framing, not the click track. Says "Settl never holds the money" once, in the close.

---

## 4. Pre-demo state (set up before going on stage)

- Maya's account exists, email verified, receive currency = PHP, GCash account "linked" (stubbed).
- Northwind's wallet exists, funded with at least 1,250 testnet USDC (1,200 + buffer for fees).
- Browser has two tabs open and pre-signed in: **Tab A = Maya's dashboard**, **Tab B = Northwind's dashboard**. Presenter switches between tabs to show both sides.
- ARC testnet explorer pre-bookmarked.
- Pre-recorded 90-second fallback video on the desktop, ready to play if testnet stalls or wallet connect hangs. Decision: **yes, we record the fallback.** Non-negotiable insurance.

---

## 5. The click track (second-by-second)

Times are approximate targets, not hard cuts. The presenter narrates over the clicks; the script below is the on-screen action.

### 0:00 — 0:15 · Framing (presenter speaks, no clicks yet)

Presenter, over a title card:
> "Maya is a designer in Manila. Northwind is a studio in Berlin hiring her for the first time. $1,200 of work, two milestones. Today that payment costs Maya six percent and takes four days, and neither side trusts the other to move first. Watch what it looks like on Settl."

Cut to **Tab A — Maya's dashboard**, empty state.

### 0:15 — 0:30 · Maya creates the invoice

**Screen: Maya — New Invoice**

1. Click **+ New invoice**.
2. Fill: Client name = *Northwind Labs*, Client email = *finance@northwind.xyz*.
3. Amount = **1200**, currency dropdown = **USD**. Receive in = **PHP** (pre-selected, her default).
4. Toggle **Hold in escrow, release per milestone** → **ON**.
5. Add two milestones, $600 each: "First designs" and "Final handoff."
6. **Review window if no response: 7 days → auto-release to freelancer.** (One dropdown. Default value already set. Presenter says: *"If Northwind never responds, after seven days the money releases to Maya. No dispute engine, just a pre-agreed rule both sides see up front."*)
7. Click **Create & copy link**.

**On-screen result:** Invoice card appears in Maya's list, status = *Awaiting payment*. A pay link is in the clipboard. Toast: *"Link copied."*

### 0:30 — 0:50 · Northwind opens the pay link and funds escrow

Switch to **Tab B — Northwind**, paste the link into the address bar.

**Screen: Pay link (public)**

What Northwind sees, large and clean:
- *"Northwind Labs → Maya Reyes"*
- *"$1,200 · 2 milestones · funds held until you approve each one"*
- Milestone list with amounts and labels.
- A box: *"Maya receives **₱67,200** (rate locked for 60s · $1 = ₱56.00)."*
- A box: *"Network fee: ~$0.04, paid in USDC."*
- **Connect wallet** button.

1. Click **Connect wallet** → standard wallet popup → approve connection.
2. Button changes to **Fund escrow — 1,200 USDC**. Click it.
3. Wallet popup: signature request. Approve.
4. Spinner for ~1 second. **Sub-second finality is the whole point — don't fake a long loading state.**
5. Screen flips to confirmation: *"Funded. Both milestones locked. Maya can start work."* Below: two cards, each *"M1 — $600 · Locked"* and *"M2 — $600 · Locked"*, each with a small **View on explorer** link.

Presenter, while this resolves:
> "1,200 USDC just went into an escrow contract on ARC. Both milestones are funded and locked. Neither Maya nor Settl can touch this money until Northwind approves — and Settl never touches it at all."

### 0:50 — 1:05 · Maya sees funded escrow and "delivers" M1

Switch to **Tab A — Maya**.

**Screen: Maya — Invoice detail**

Invoice status has flipped to *Funded — in escrow*. Both milestones show *Locked · ₱33,600 each on release*.

1. Click into M1 — "First designs."
2. Click **Mark delivered**. (In production this is where she'd attach files; for the demo, one click, no upload UI.)
3. M1 status flips to *Awaiting approval*.

Presenter:
> "Maya delivered the first milestone. Nothing has moved yet. Northwind has seven days to approve — let's say he likes it."

### 1:05 — 1:25 · Northwind approves M1 — the money moment

Switch to **Tab B — Northwind**.

**Screen: Northwind — Invoice detail**

Banner at top: *"M1 ready for your review."*

1. Click **Approve M1**.
2. Wallet popup: signature. Approve.
3. **Watch closely.** Within ~1 second:
   - M1 card flips to *Released — $600 · ₱33,600 sent to Maya*.
   - A small inline line appears: *"Converted on-chain · rate $1 = ₱56.00 · tx 0x9f…c2a"* with a **View on explorer** link.

Presenter, on the beat:
> "That's it. $600 left the escrow, converted to PHP on-chain, and landed in Maya's balance. Under a second. Final. No reversal, no pending state, no correspondent bank."

Switch to **Tab A — Maya** (don't refresh — it should update live, but if it doesn't, refresh; this is rehearsed).

Maya's dashboard now shows: **Balance: ₱33,600**. Invoice M1 = *Paid*. M2 = *Locked*.

### 1:25 — 1:45 · The proof — block explorer

Back on **Tab B**, click **View on explorer** next to the M1 release.

**ARC testnet explorer opens in a new tab.**

Show, with cursor:
- The release transaction.
- The contract address.
- The amount and timestamp.
- Status: *Success · Finalized*.

Presenter:
> "This is the actual on-chain release. Not a screenshot, not a database row — the chain settled it. Anyone can audit this."

Close the explorer tab.

### 1:45 — 2:00 · Cash out (the stub, presented honestly as the partner exit)

Switch to **Tab A — Maya**.

1. Click **Cash out ₱33,600**.
2. Modal: *"Send to GCash •••42 via Coins.ph"* + **Confirm**.
3. Click **Confirm**.
4. Confirmation screen: *"On its way. Reference CPH-7K4M2QX1 · est. arrival 3 min."*

Presenter:
> "Maya cashes out through Coins.ph — a licensed Philippine exit — to her GCash. Settl orchestrates this, never holds the money. In production this hits her phone in minutes."

### 2:00 — 2:15 · The receipt + the close

Stay on **Tab A**. Open the invoice — show the receipt view: both parties named, M1 paid with tx hash, M2 still locked, timestamps, the timeout rule visible.

Presenter, closing:
> "One milestone done, one to go — same flow repeats. Six percent and four days became under one percent and under a second. Settl never custodied a cent. The trust layer is the product; the stablecoin is plumbing."

End on the receipt view, frozen.

---

## 6. The honest edge case (named, not demoed)

The only place this appears live is at **0:15–0:30**, in the invoice creation step, where the presenter says one sentence about the 7-day timeout default. We do not trigger the timeout on stage. If a judge asks, the answer is: *"Pre-agreed timeout with a default chosen at invoice creation — auto-release or auto-refund, whichever both sides picked up front. It is deliberately a timeout, not a dispute engine. Anything smarter is a later problem."*

---

## 7. Screens required to build this script

Derived directly from the click track. This is the screen inventory for the next planning step — no additional screens get built for the demo.

**Maya (freelancer) side:**
1. Dashboard (invoice list + balance + cash-out entry)
2. New Invoice form
3. Invoice detail (with milestone actions: mark delivered, cash out)
4. Cash-out modal + confirmation
5. Receipt view

**Northwind (client) side:**
6. Pay link (public, no auth required to view; wallet connect to act)
7. Invoice detail post-funding (approve milestone actions)

**Shared infrastructure (not screens but required):**
- Email onboarding (one screen, used once before demo)
- Wallet connect flow (library, not a custom screen)
- Toast / notification system
- Block explorer link-out (just an `<a target="_blank">`)

**Seven screens.** That's the build surface. Anything proposed beyond these requires cutting one of them.

---

## 8. Live demo failure plan

| Failure | Response |
|---|---|
| Testnet RPC slow (>5s on any step) | Presenter keeps talking, does not refresh. If still hung at 8s, cut to fallback video. |
| Wallet connect popup blocked / hangs | One retry. If second attempt fails, cut to fallback video. |
| FX quote endpoint errors | Quote is cached server-side at invoice creation; pay link uses cached quote with the "rate locked for 60s" badge. No live external call during demo. |
| Coins.ph stub somehow errors | It's a hardcoded screen. It cannot error. If it does, we have a bigger problem than the demo. |
| Live demo machine loses wifi | Fallback video, played from local disk. |

**Fallback video:** recorded the day before. Same script, same clicks, narrated live over the recording. We do not skip recording it.

---

## 9. What this script forbids us from building

For clarity, items that will surface as "wouldn't it be cool if…" and must be rejected:

- Card on-ramp UI.
- Multiple corridors / currency picker beyond PHP.
- Dispute resolution UI.
- File upload / delivery proof beyond a single "Mark delivered" button.
- Team / multi-seat for Northwind.
- Recurring invoices / streaming retainers.
- Accounting exports.
- A separate mobile app — responsive web only.
- Push notifications, email notifications beyond the pay link send.
- Any settings page beyond what's strictly needed for onboarding.

If a feature isn't named in sections 1–7, it does not exist for the demo.
