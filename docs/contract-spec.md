# Settl — Escrow Contract Spec

**One escrow contract, conditional path.** A Solidity dev should be able to write this without inventing states. The contract holds USDC, locks it per milestone, releases on the payer's approval, and self-resolves via a pre-agreed timeout if the payer goes silent. It does **not** convert currency, does **not** know about delivery, does **not** arbitrate disputes. Conversion (USDC→PHP) happens off-chain after release, triggered by the release event.

**Non-custodial posture:** Settl's backend never holds keys that can move user funds arbitrarily. The payer funds and approves with their own wallet. The contract enforces the rules; Settl only reads events and broadcasts the payer's signed calls.

---

## Architecture choice: one contract per invoice (factory pattern)

For the MVP, deploy a fresh escrow instance per invoice via a factory, OR use a single contract keyed by invoice id. **Recommendation: single contract, keyed by `invoiceId`** — simpler to deploy once, cheaper, and the demo only needs one invoice anyway. Each invoice's funds are tracked independently inside it.

> If the agent finds per-invoice deployment cleaner with the chosen tooling, that's acceptable — but default to the single keyed contract. Record whichever is chosen in `contract_invoice_id` / contract address in the DB.

---

## Token

- Funds are **USDC** (testnet USDC on ARC). The contract holds USDC; amounts are in USDC minor units (6 decimals for USDC).
- Gas / fees paid in USDC (ARC native) — not a contract concern, just noted so the dev doesn't wire a separate gas token.

---

## State machine

### Invoice-level states

```
DRAFT ──fund()──▶ FUNDED ──(all milestones resolved)──▶ COMPLETED
  │                  │
  │                  ├──(timeout, AUTO_REFUND)──▶ REFUNDED
  └──cancel()──▶ CANCELLED   (only before funding)
```

### Milestone-level states (each milestone independent)

```
LOCKED ──approve(i)──▶ RELEASED
   │
   └──claimTimeout(i)──▶ RELEASED   (if AUTO_RELEASE) 
   └──claimTimeout(i)──▶ REFUNDED   (if AUTO_REFUND)
```

An invoice is `COMPLETED` when every milestone is RELEASED or REFUNDED.

---

## Functions

### `createInvoice(invoiceId, payee, milestoneAmounts[], timeoutSeconds, timeoutDefault)`
- Caller: Settl backend (or payer) — sets up the invoice record on-chain in DRAFT.
- `milestoneAmounts[]` defines count and per-milestone USDC amounts; sum = total.
- `timeoutDefault`: enum `AUTO_RELEASE (0)` | `AUTO_REFUND (1)`.
- Stores: payee address, payer (unset until fund), amounts, timeout config.
- Reverts if invoiceId already exists.

### `fund(invoiceId)`
- Caller: **payer** (msg.sender becomes recorded payer).
- Requires: state DRAFT, payer has approved the contract to pull `sum(milestoneAmounts)` USDC (ERC-20 approve beforehand) OR sends via transferFrom.
- Effect: pulls total USDC into contract, all milestones → LOCKED, invoice → FUNDED, records `fundedAt = block.timestamp`.
- Emits: `Funded`.
- **Both milestones funded in this single call** (per demo-script decision — no per-milestone funding).

### `approve(invoiceId, milestoneIndex)`
- Caller: **only the recorded payer**.
- Requires: invoice FUNDED, milestone LOCKED.
- Effect: transfers that milestone's USDC to the payee address, milestone → RELEASED. If all milestones now resolved → invoice COMPLETED.
- Emits: `MilestoneReleased`.
- **Irreversible.** No undo, no pending. (Deterministic finality is the product point.)

### `claimTimeout(invoiceId, milestoneIndex)`
- Caller: **anyone** (permissionless — typically the party who benefits).
- Requires: invoice FUNDED, milestone LOCKED, `block.timestamp >= fundedAt + timeoutSeconds`.

  > Design note: the demo's timeout starts at **delivery**, not funding, conceptually. But delivery is off-chain. For MVP simplicity the on-chain timeout is measured from `fundedAt`. This is a documented simplification — acceptable because the timeout is never triggered in the demo. If you want delivery-anchored timeouts later, add an on-chain `markDelivered` that stamps a per-milestone timestamp. **Do not add it for the MVP.**
- Effect:
  - if `timeoutDefault == AUTO_RELEASE`: transfer to payee, milestone → RELEASED.
  - if `timeoutDefault == AUTO_REFUND`: transfer back to payer, milestone → REFUNDED.
- Emits: `MilestoneReleased` (with `viaTimeout=true`) or `MilestoneRefunded`.

### `cancel(invoiceId)`
- Caller: payer or payee.
- Requires: state DRAFT (not yet funded).
- Effect: invoice → CANCELLED. No funds involved (nothing deposited yet).
- Emits: `Cancelled`.

---

## Access control summary

| Function | Who can call | State required |
|---|---|---|
| `createInvoice` | backend/payer | none |
| `fund` | payer | DRAFT |
| `approve` | recorded payer only | FUNDED + milestone LOCKED |
| `claimTimeout` | anyone | FUNDED + LOCKED + window elapsed |
| `cancel` | payer or payee | DRAFT |

**The critical guard:** `approve` is the only path to release funds before timeout, and only the payer can call it. The freelancer can never self-release before the timeout window. The backend can never move funds. This is what makes it non-custodial and trust-worthy.

---

## Events (must all be emitted and parseable by the listener)

```solidity
event Funded(bytes32 invoiceId, address payer, address payee, uint256 total, uint256 milestoneCount);
event MilestoneReleased(bytes32 invoiceId, uint8 milestoneIndex, uint256 amount, address payee, bool viaTimeout);
event MilestoneRefunded(bytes32 invoiceId, uint8 milestoneIndex, uint256 amount, address payer);
event Cancelled(bytes32 invoiceId);
```

Each event carries enough to update the DB without an extra read: invoice id, milestone index, amount, recipient. The backend listener maps these to `invoices.status` / `milestones.status` / `transactions` rows.

---

## What the contract does NOT do (enforced scope)

- **No currency conversion.** It moves USDC only. USDC→PHP is off-chain, post-release.
- **No delivery tracking.** "Mark delivered" is off-chain. The contract sees only LOCKED→RELEASED.
- **No dispute logic.** The only non-approval resolution is the timeout default. No arbiter, no voting, no partial release within a milestone.
- **No fee logic in v1.** Settl's spread is taken at the off-chain FX/settlement leg, not skimmed in the contract. (Keeps the contract simple and the demo honest. Add an optional fee recipient later if needed — not for MVP.)
- **No upgradeability proxy.** It's a hackathon demo contract. Deploy, use, done. No proxy pattern.

---

## Test matrix (for M3 acceptance)

| Test | Expected |
|---|---|
| createInvoice with 2 milestones summing to total | succeeds, state DRAFT |
| fund by payer | pulls USDC, FUNDED, both LOCKED, Funded emitted |
| fund by non-payer before any payer set | first funder becomes payer (or restrict — pick one, document it) |
| approve M0 by payer | M0 USDC → payee, RELEASED, event emitted |
| approve M0 by payee (not payer) | reverts |
| approve already-released milestone | reverts |
| approve before fund | reverts |
| approve both → invoice COMPLETED | succeeds |
| claimTimeout before window | reverts |
| claimTimeout after window, AUTO_RELEASE | releases to payee |
| claimTimeout after window, AUTO_REFUND | refunds to payer |
| cancel before fund | CANCELLED |
| cancel after fund | reverts |

All rows must pass before M3 is done.

---

## The demo's exact contract path

1. `createInvoice(id, mayaAddr, [600e6, 600e6], 7*86400, AUTO_RELEASE)` — backend, at invoice creation.
2. Northwind: ERC-20 `approve(escrow, 1200e6)` then `fund(id)` — funds locked, `Funded` emitted.
3. Northwind: `approve(id, 0)` — M0 releases 600 USDC to Maya's address, `MilestoneReleased` emitted → listener triggers off-chain USDC→PHP conversion → Maya's `balance_minor` credited.
4. (M1 repeats — not shown in the 90s but identical.)
5. `View on explorer` resolves the `MilestoneReleased` tx hash.

That's the whole contract surface the demo exercises. Build exactly this.
