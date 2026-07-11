# Settl — Tech Stack & Scaffold Spec

**The agent scaffolds the repo from this in one pass.** Decisions are made; the agent does not get to re-litigate them. Anything chain-specific (RPC URL, chain ID, USDC address) is an env var you fill in — not guessed here.

---

## Stack decisions

| Layer | Choice | Why |
|---|---|---|
| App framework | **Next.js (App Router, TypeScript)** | Full-stack in one repo: pages + API routes + server actions. No separate backend to deploy under hackathon time. |
| Styling | **Tailwind CSS** | Fast, consistent, no design system overhead. |
| UI components | **shadcn/ui** | Clean defaults, accessible, copy-in (no heavy dep). Good enough to look polished without a designer. |
| Database | **PostgreSQL** | Money data, relational, integer money math. |
| ORM | **Prisma** | Schema-first, migrations, type-safe — matches `data-model.md` directly. |
| Wallet connect | **wagmi + viem** (+ RainbowKit for the connect modal) | Standard EVM wallet stack; viem for contract calls and event reads. |
| Smart contract | **Solidity + Hardhat** | Per your call. Standard, well-documented, good testnet deploy tooling. |
| Contract testing | **Hardhat + chai** | Covers the M3 test matrix. |
| Chain | **ARC testnet** | EVM-compatible; configured via env. |
| Event listener | **viem `watchContractEvent`** in a Next.js server process / route | Reads Funded + MilestoneReleased, updates DB. Single source of money truth. |
| FX source | **One source, server-side, cached** | Captured at invoice creation into `fx_quotes`. No live call at pay-link view time. Start with a single rate provider or a hardcoded-with-jitter stub if no provider is wired by demo — document which. |
| USDC→PHP conversion | **`ConvertService` interface** | Implementation = stablecoin-pair swap fallback for MVP. StableFX swappable behind the same interface if access lands. Never block on StableFX. |
| Cash-out | **Stub** | Hardcoded success, fake `CPH-` ref. No external API. |

> **Do not add:** Redis, a message queue, Docker compose for the demo, a separate auth provider, GraphQL, a state-management library beyond React state + wagmi hooks, or a monorepo tool. None are needed for one demo path.

---

## Repo structure

```
settl/
├── docs/                          # the planning docs (already here)
│   ├── demo-script.md
│   ├── build-plan.md
│   ├── screens.md
│   ├── data-model.md
│   ├── contract-spec.md
│   └── stack.md
├── contracts/                     # Hardhat project
│   ├── contracts/
│   │   └── SettlEscrow.sol
│   ├── test/
│   │   └── SettlEscrow.test.ts    # the M3 test matrix
│   ├── scripts/
│   │   └── deploy.ts
│   ├── hardhat.config.ts
│   └── package.json
├── app/                           # Next.js App Router
│   ├── (freelancer)/
│   │   ├── page.tsx               # Screen 1: dashboard
│   │   ├── invoices/new/page.tsx  # Screen 2
│   │   └── invoices/[id]/page.tsx # Screen 3 (payee view)
│   ├── invoices/[id]/receipt/page.tsx  # Screen 5
│   ├── pay/[token]/page.tsx       # Screen 6: public pay link
│   ├── client/invoices/[id]/page.tsx   # Screen 7 (payer view)
│   ├── api/
│   │   ├── invoices/route.ts      # create invoice + FX quote
│   │   ├── invoices/[id]/route.ts
│   │   ├── milestones/[id]/deliver/route.ts
│   │   ├── cashout/route.ts       # stub
│   │   └── events/route.ts        # event-listener trigger / webhook
│   └── layout.tsx
├── lib/
│   ├── db.ts                      # Prisma client
│   ├── fx.ts                      # FX quote service
│   ├── convert.ts                 # ConvertService interface + fallback impl
│   ├── chain.ts                   # viem clients, contract ABI + address
│   ├── escrow.ts                  # contract call wrappers (fund/approve)
│   ├── listener.ts                # event watcher → DB updates
│   └── money.ts                   # integer minor-unit helpers, FX math
├── components/                    # shadcn/ui + screen components
├── prisma/
│   ├── schema.prisma              # from data-model.md
│   └── seed.ts                    # Maya + Northwind demo accounts
├── .env.example
├── .env                           # gitignored
└── package.json
```

> `contracts/` is its own Hardhat package (own `package.json`). Keep it isolated from the Next app so deploy tooling doesn't pollute the frontend deps. Not a formal monorepo — just two `package.json`s side by side.

---

## Environment variables (`.env.example`)

```bash
# Database
DATABASE_URL="postgresql://user:pass@localhost:5432/settl"

# ARC testnet — YOU fill these from your RPC/faucet setup
ARC_RPC_URL=""                 # ARC testnet RPC endpoint
ARC_CHAIN_ID=""                # ARC testnet chain id
NEXT_PUBLIC_ARC_CHAIN_ID=""    # same, exposed to client for wagmi
ARC_EXPLORER_URL=""            # base URL for tx links, e.g. https://explorer.testnet.arc.../tx/

# Tokens / contracts
USDC_ADDRESS=""                # testnet USDC contract on ARC
ESCROW_ADDRESS=""              # set after deploy (M3)
NEXT_PUBLIC_ESCROW_ADDRESS=""

# Deploy
DEPLOYER_PRIVATE_KEY=""        # funded testnet key for deploying + createInvoice

# FX
FX_SOURCE_URL=""               # optional; if empty, fx.ts uses a documented stub rate
FX_FALLBACK_RATE="56.00"       # USD->PHP fallback used if no source

# Wallet connect
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=""
```

> The agent generates `.env.example` with all keys and placeholder values. **You** populate `.env` with your real ARC RPC, chain id, explorer URL, and USDC address. The agent must never hardcode these in source — always read from env via `lib/chain.ts`.

---

## Money math contract (non-negotiable, lives in `lib/money.ts`)

- All money is `bigint` minor units. No `number` for money, ever.
- USD: cents (2dp). PHP: centavos (2dp). USDC on-chain: 6 decimals — convert at the chain boundary in `escrow.ts`.
- FX applied as: `phpMinor = usdMinor * rate` with `rate` as a fixed-point integer or `decimal.js`, rounded once, explicitly, at the convert step.
- One helper for formatting to display strings (`₱33,600.00`, `$600.00`). Screens never do math.

---

## Build order tie-in (matches build-plan.md)

1. **M1.1** — `npx create-next-app`, add Tailwind + shadcn, init Prisma, commit `.env.example`. App boots to empty dashboard.
2. **M1.2** — `schema.prisma` from `data-model.md`, migrate, `seed.ts`.
3. **M3** — `contracts/` Hardhat project built and tested in parallel; deploy fills `ESCROW_ADDRESS`.
4. **M2/M4/M5/M6** — app routes + lib services per screens.

---

## First instruction to hand the coding agent

Paste this verbatim:

> Read these docs in order: `docs/demo-script.md`, `docs/build-plan.md`, `docs/screens.md`, `docs/data-model.md`, `docs/contract-spec.md`, `docs/stack.md`.
>
> Then execute **only M1.1 from build-plan.md**: scaffold the Next.js (App Router, TypeScript) project with Tailwind + shadcn/ui, initialize Prisma, and create `.env.example` with every key listed in stack.md. Create the folder structure from stack.md. The app must boot with `npm run dev` to an empty freelancer dashboard and produce no errors.
>
> Do not implement any other milestone. Do not add libraries not listed in stack.md. Do not write the Prisma schema yet (that's M1.2). Do not touch contracts yet (that's M3). When M1.1's acceptance criteria pass, stop and report back.

One milestone at a time. Make the agent stop and report after each, so you review for scope creep before it compounds.
