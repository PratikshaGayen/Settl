# Settl — Presentation & Video Script

This doc is the source for **both** the slide deck (PPT) and the video narration. Each slide has: what's on screen, and the exact words to say. Target video length: **2:30–3:00**.

---

## Slide 1 — Title (0:00–0:15)

**On screen:**
- **Settl**
- "Cross-border freelancer payouts with built-in escrow, on Arc."
- Track 1 — Cross-Border Payments & Remittances (UAE → Global)
- Built on Circle: USDC · Wallets · (Gateway · StableFX · USYC seams)

**Say:**
> "This is Settl — a cross-border payout rail for freelancers. A UAE company pays a freelancer anywhere in the world in USDC on Arc, with on-chain escrow that protects both sides. Let me show you the problem and the flow."

---

## Slide 2 — The problem (0:15–0:40)

**On screen:** a UAE company ↔ a Manila freelancer, with the pain points:
- Bank wires: 3–5 days, opaque FX, high fees
- No trust layer: pay upfront (client risk) or deliver upfront (freelancer risk)
- The freelancer just wants pesos in GCash — she doesn't care about crypto

**Say:**
> "Paying a freelancer across borders today is slow, expensive, and has no built-in trust. Someone always goes first — the client pays upfront and hopes, or the freelancer delivers and hopes. And the freelancer doesn't want a wallet or a seed phrase; she wants pesos in her GCash. Settl fixes all three."

---

## Slide 3 — How it works (0:40–1:00)

**On screen:** the 5-step flow, left to right:
1. **Invoice** — freelancer creates an invoice with milestones; FX rate locked
2. **Fund** — client funds escrow in USDC (Circle Wallet); funds lock on Arc
3. **Deliver** — freelancer marks a milestone delivered
4. **Approve** — client approves; that milestone's USDC releases on-chain
5. **Settle** — USDC → PHP at the locked rate → freelancer's balance → GCash cash-out

**Say:**
> "The flow is five steps. The freelancer sends an invoice split into milestones, with the FX rate locked in. The client funds an on-chain escrow in USDC. As each milestone is delivered and approved, exactly that portion releases — converts to pesos at the locked rate — and lands in the freelancer's balance. Everything is signed by Circle Wallets, so neither party touches a raw key."

---

## Slide 4 — Architecture (1:00–1:25)

**On screen:** the diagram from `docs/architecture.md` — Next.js app → API routes / server actions → (Prisma DB) + (SettlEscrow on Arc) + (Circle Wallets) + (StableFX quote). Highlight where each **Circle product** sits.

**Say:**
> "Under the hood: a Next.js app talks to a SettlEscrow smart contract on Arc. USDC is the settlement and escrow asset. Both parties have Circle Wallets — the client's wallet signs the fund and approve transactions, and the released USDC lands in the freelancer's Circle wallet. The FX leg is a StableFX-shaped quote-lock-execute model. Every release produces a real, explorer-verifiable transaction hash."

---

## Slide 5 — Live demo (1:25–2:25)

**On screen:** screen-record the real app. Follow `docs/demo-script.md`:
- Freelancer creates a **$1,200 invoice, 2 × $600**, escrow on → share pay link
- Client **funds** in USDC → both milestones lock (show the tx)
- Freelancer **marks M1 delivered**
- Client **approves M1** → $600 releases on-chain, converts to **₱33,600** at the locked rate
- Show the **receipt** with the tx hash → **click through to the Arc explorer** (the proof moment)

**Say (over the recording):**
> "Here's the real app on Arc testnet. Maya creates a twelve-hundred-dollar invoice, two milestones. She shares a pay link. Northwind funds it in USDC — the funds are now locked in escrow on-chain. Maya delivers the first milestone. Northwind approves — and right here, six hundred dollars releases on-chain and converts to thirty-three thousand six hundred pesos at the rate we locked at invoice time. This receipt has the real transaction hash — one click opens the Arc explorer and there's the actual release transaction. Real USDC, real settlement, real proof."

---

## Slide 6 — Circle products & why Arc (2:25–2:45)

**On screen:**
- **USDC** — settlement + escrow asset (live)
- **Circle Wallets** — embedded, email-in wallets for both parties (live)
- **Gateway / StableFX / USYC** — integrated seams / conceptual, ready to flip
- **Why Arc:** gas token *is* USDC → no separate gas asset for users; deterministic finality → real-time payout UX

**Say:**
> "We used USDC and Circle Wallets live on Arc, with Gateway, StableFX, and USYC built as ready-to-flip seams. Arc mattered specifically: the gas token is USDC, so users never need a separate gas asset — that removed an entire class of onboarding friction for a non-crypto freelancer."

---

## Slide 7 — Close (2:45–3:00)

**On screen:**
- Settl — instant, trust-minimized cross-border payouts on Circle + Arc
- Demo URL · GitHub · (logos)

**Say:**
> "Settl turns a slow, trustless cross-border payment into an instant, escrow-protected one — where the freelancer just gets paid in her own currency, and never has to learn what a blockchain is. Thanks for watching."

---

## Recording checklist

- [ ] Reset the demo to a clean state first: `npx tsx scripts/reset-demo.ts`
- [ ] Confirm the deployer/payer wallet has enough testnet USDC (a $1,200 demo needs funding headroom — top up from the faucet if `/fund` errors)
- [ ] Record at 1080p; keep the browser zoom high enough that tx hashes are legible
- [ ] Capture the explorer click-through clearly — it's the single most convincing moment
- [ ] Keep total runtime under 3:00
