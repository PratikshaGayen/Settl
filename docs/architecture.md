# Settl — Architecture (T8.3)

One Mermaid diagram covering the full path: Circle Wallets → SettlEscrow on Arc → Gateway → StableFX → USYC float → PHP off-ramp, plus the milestone state machine. Renders on GitHub. Matches the running app (`src/lib/escrow.ts`, `fx.ts`, `convert.ts`, `usyc.ts`).

## System flow

```mermaid
flowchart TB
  subgraph Parties
    M["Maya · Manila freelancer<br/>(email-only, no crypto vocab)"]
    N["Northwind · UAE company<br/>(paying client)"]
  end

  subgraph Circle["Circle Developer Stack"]
    CW["Circle Wallets<br/>embedded wallets for both parties"]
    GW["Circle Gateway<br/>fund + release routing"]
    SFX["StableFX<br/>USD→PHP quote + convert"]
    USYC["USYC<br/>escrow float yield (conceptual)"]
  end

  subgraph Arc["Arc Testnet"]
    ESC["SettlEscrow.sol<br/>holds USDC, milestone-gated"]
    USDC["USDC (6-decimal)"]
  end

  PHP["Maya's PHP balance<br/>→ GCash cash-out (stub)"]

  M -->|sign in / provision| CW
  N -->|sign in / provision| CW

  N -->|"1 fund (approve + fund)"| GW
  GW -->|"writeContract fund()"| ESC
  ESC -->|holds| USDC
  ESC -.->|"while LOCKED: mint"| USYC

  N -->|"2 approve milestone"| GW
  GW -->|"writeContract approve()"| ESC
  USYC -.->|"on release: redeem"| ESC
  ESC -->|"MilestoneReleased: USDC → payee"| GW
  GW -->|payout| SFX
  SFX -->|"convert at locked quote"| PHP
  PHP --> M

  SFX -.->|"quote at invoice creation (cached 60s)"| N

  classDef circle fill:#dbeafe,stroke:#3b82f6;
  classDef chain fill:#dcfce7,stroke:#16a34a;
  class CW,GW,SFX,USYC circle;
  class ESC,USDC chain;
```

## Milestone state machine

```mermaid
stateDiagram-v2
  [*] --> DRAFT: createInvoice()
  DRAFT --> FUNDED: fund() (all milestones LOCKED)
  DRAFT --> CANCELLED: cancel()

  state FUNDED {
    [*] --> LOCKED
    LOCKED --> RELEASED: approve(i) [payer only]
    LOCKED --> RELEASED: claimTimeout(i) [AUTO_RELEASE]
    LOCKED --> REFUNDED: claimTimeout(i) [AUTO_REFUND]
  }

  FUNDED --> COMPLETED: all milestones resolved
  FUNDED --> REFUNDED: timeout AUTO_REFUND
```

## Where each piece lives in code

| Step | Code | Circle product |
| ---- | ---- | -------------- |
| Wallet provisioning | (Wallets seam in `escrow.ts#walletClient`) | Circle Wallets |
| Quote at invoice creation | `lib/fx.ts#getUsdToPhpQuote` → `FXQuote(source=stablefx)` | StableFX |
| On-chain register | `lib/escrow.ts#createInvoiceOnChain` | — |
| Fund | `api/invoices/[id]/fund` → `escrow.ts#fundEscrow` (Gateway seam) | Wallets + Gateway + USDC |
| Float yield while LOCKED | `lib/usyc.ts#routeToUSYC` | USYC (conceptual) |
| Approve / release | `client/invoices/[id]` action → `escrow.ts#approveMilestone` (Gateway seam) | Gateway + USDC |
| Convert on release | `lib/convert.ts#convertUSDCtoPHP` (references locked quote id) | StableFX |
| Reconciliation | `lib/listener.ts#startEventListener` (viem watchContractEvent) | — |
| Receipt tx trail | `client/invoices/[id]/receipt` (explorer-linked hashes) | — |

> **Unit note:** the app's USD minor units are cents (2 decimals); the contract speaks 6-decimal USDC. `lib/money.ts#centsToUsdc` converts at every contract boundary.
