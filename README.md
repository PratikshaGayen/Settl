# Settl

**A freelancer payout rail with built-in escrow protection on the UAE → Philippines corridor.** A UAE company (Northwind) pays a Manila-based freelancer (Maya) in USDC on Arc, with milestone-gated escrow release and a PHP off-ramp. Built for the Stablecoin Commerce Stack Challenge (Track 1 — Cross-Border Payments & Remittances), built on the Circle Developer stack.

The differentiator vs. a dumb transfer: an on-chain **escrow + milestone trust layer**. Funds lock on funding, release only on the payer's per-milestone approval (or a pre-agreed timeout), and convert to PHP at a rate locked when the invoice was created.

## How each Circle tool is integrated

Full detail in [docs/circle-integration.md](docs/circle-integration.md); architecture in [docs/architecture.md](docs/architecture.md). Summary:

| Product | Role in Settl | Status | Code |
| ------- | ------------- | ------ | ---- |
| **USDC** | Settlement + escrow asset (6-decimal, on Arc) | Live | `contracts/contracts/SettlEscrow.sol`, `src/lib/escrow.ts` |
| **Circle Wallets** | Embedded wallets for both parties — Maya signs in email-only, no crypto vocabulary | Shaped → Live | Wallets seam in `src/lib/escrow.ts` |
| **Circle Gateway** | Routes the fund + release/payout movements | Shaped | `submitViaGateway` seam in `src/lib/escrow.ts` |
| **StableFX** | USD→PHP quote (locked 60s at invoice creation) + conversion on release | Shaped | `src/lib/fx.ts`, `src/lib/convert.ts` |
| **USYC** | Yield on escrowed float while milestones are LOCKED | Conceptual | `src/lib/usyc.ts` |
| **CCTP / Bridge Kit** | Cross-chain funding | Conceptual (stretch) | — |

**Status meanings:** *Live* = real SDK/endpoint. *Shaped* = real interface + working fallback; flip one env var / drop in the SDK call to go live. *Conceptual* = documented design + labelled stub, no fabricated numbers. (Per hackathon rules, conceptual integrations aren't penalized when access is gated.)

The seams are env-gated — see the env var → product map in [docs/circle-integration.md](docs/circle-integration.md#env-var--product-map). With `ESCROW_ADDRESS` set, fund/release run as real on-chain txs on Arc and the receipt's tx hashes resolve on the explorer; without it, the app runs a labelled simulated path so the UI is demoable pre-deploy.

## Setup

Requires Node 20+.

```bash
# 1. Install
npm install

# 2. Configure env (copy and fill)
cp .env.example .env
#   - DATABASE_URL stays SQLite for local dev
#   - For the real money path, fill: ARC_RPC_URL, ARC_CHAIN_ID, USDC_ADDRESS,
#     DEPLOYER_PRIVATE_KEY, then ESCROW_ADDRESS after deploying the contract.
#   - For live Circle calls: CIRCLE_API_KEY (Wallets/Gateway), FX_SOURCE_URL (StableFX).

# 3. DB + seed (Maya + Northwind demo parties)
npx prisma migrate deploy
npx prisma db seed

# 4. Run
npm run dev      # http://localhost:3000
```

### Deploy the escrow contract (enables the real on-chain path)

```bash
cd contracts
npm install
npm test                 # 13-case matrix must pass
npm run deploy:testnet   # copy the printed address into ESCROW_ADDRESS /
                         # NEXT_PUBLIC_ESCROW_ADDRESS in the root .env
```

Once `ESCROW_ADDRESS` is set, funding and milestone approval execute real Arc-testnet transactions; the receipt links every tx hash to the Arc explorer.

### Reset the demo

```bash
npx tsx scripts/reset-demo.ts
```

## Demo path

Maya creates a $1,200 invoice (2 × $600, escrow on, 7-day auto-release) → shares the pay link → Northwind funds in USDC (both milestones lock) → Maya marks M1 delivered → Northwind approves M1 → $600 releases on-chain, converts to ₱33,600 at the locked StableFX rate, credits Maya's PHP balance → Maya cashes out to GCash (stub) → both sides get a receipt with real tx hashes and the Circle products used per step.

## Docs

- [docs/build-plan.md](docs/build-plan.md) — milestones + task status
- [docs/circle-integration.md](docs/circle-integration.md) — per-product integration spec
- [docs/architecture.md](docs/architecture.md) — system + state-machine diagrams
- [docs/circle-feedback.md](docs/circle-feedback.md) — Circle Product Feedback (scored)
- [docs/contract-spec.md](docs/contract-spec.md) · [docs/data-model.md](docs/data-model.md) · [docs/screens.md](docs/screens.md) · [docs/demo-script.md](docs/demo-script.md)
