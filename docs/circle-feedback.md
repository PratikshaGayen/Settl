# Circle Product Feedback (T8.6)

Honest, per-product feedback from building Settl's UAE→PH escrow payout rail on the Circle stack. Written from real integration experience — what we chose, what worked, what slowed us down, and concrete DX/scalability recommendations. Where a product was conceptual (gated access), we say so rather than inventing experience.

---

## USDC (settlement asset) — *integrated live*

**Why chosen:** non-negotiable — it's the asset the whole corridor settles in, and on Arc the gas token and the settlement token being the same (USDC) removed an entire class of "user needs a separate gas asset" UX problems.

**What worked:** standard ERC-20 surface, faucetable testnet supply, predictable 6-decimal precision. Nothing surprising, which is the point.

**Friction:** the only real footgun was the decimal mismatch between our product's internal money model (cents, 2 decimals) and on-chain USDC (6 decimals). Easy to get wrong silently. We isolated it in one `centsToUsdc` boundary helper.

**Recommendation:** the docs could lead harder with a "decimals checklist" for app devs — most payment bugs in a hackathon timeframe are unit-scaling bugs, not contract bugs.

---

## Circle Wallets — *interface integrated; live calls gated on API key timing*

**Why chosen:** the product thesis is that the recipient (Maya) never touches crypto vocabulary. Email-in, wallet-provisioned-behind-the-scenes is exactly the embedded-wallet story. A generic "connect MetaMask" flow would have killed the UX premise.

**What worked (in design):** the developer/user-controlled wallet split maps cleanly onto our two personas — a company wallet for the payer, a frictionless email wallet for the payee.

**Friction:** the `entitySecret` / API-key provisioning step is the highest-setup-cost item in the stack and is hard to fully validate without a live key in hand early. For a time-boxed build we had to design behind a seam (`walletClient`) and keep a deployer-key fallback so the money path stayed demoable.

**Recommendation:** a zero-config "sandbox wallet" mode that issues a throwaway entity secret on signup would let teams wire and test the *shape* of Wallets on day one, then swap to a real entity later. The earlier a dev can call `POST /wallets` successfully, the more of the stack they'll actually adopt.

---

## Circle Gateway — *interface integrated as a routing seam*

**Why chosen:** we wanted release + payout movements to flow through a unified routing/balance layer rather than bare `eth_sendTransaction`, so the money trail is coherent and not just raw RPC sends.

**What worked:** conceptually it slots in cleanly as a `submit(tx)` wrapper around the prepared release call — our `submitViaGateway` seam is a one-line swap.

**Friction:** the mental model of "when am I sending a raw tx vs. routing through Gateway" wasn't immediately obvious for a contract-interaction (vs. a pure transfer) use case. We defaulted the fallback to a direct viem write so the release is always real and on-chain regardless.

**Recommendation:** more worked examples of Gateway wrapping a *contract call* (not just A→B transfers) would close the gap. The transfer examples are clear; the "I have a smart contract release and want it routed" path is where we had to infer.

---

## StableFX — *interface integrated with documented fallback rate*

**Why chosen:** a remittance product lives or dies on the FX leg. We needed a quotable, lockable USD→PHP rate, not a scraped public FX feed. StableFX is the right shape: quote → hold → execute.

**What worked:** the quote-then-execute model matched our requirement exactly — we lock a quote at invoice creation (cached 60s, stored with `source = stablefx`) and the conversion on release references that same quote id. The interface seam was trivial because the product's own model is already "quote object you carry."

**Friction:** access is gated, so for the build we drove the rate from a fallback while keeping the full mechanism (quote once, cache, timestamp, store, read from DB, reference on convert) real. The honest line is: the *mechanism* is production-shaped; only the *price source* is the fallback.

**Recommendation:** publish indicative testnet rates behind an unauthenticated sandbox endpoint. Teams could wire the real quote/execute flow against sandbox prices without waiting on access approval — that alone would move many "conceptual StableFX" submissions to "live."

---

## USYC — *conceptual; documented integration point only*

**Why chosen:** escrowed float is idle money. USYC turns "your funds are locked for trust" into "your funds are locked *and* earning" — a genuine product differentiator, not a checkbox. The hook points are clean: mint on `fund()` (all milestones LOCKED), redeem on `approve()`/`claimTimeout()`.

**What we did NOT do:** we did not have testnet access, so this is conceptual. The stub (`src/lib/usyc.ts`) returns principal unchanged and we surface **zero invented APY** anywhere — we refuse to present fabricated yield as real.

**Recommendation:** the single highest-leverage thing for adoption would be a sandbox USYC with a fixed, clearly-fake demo rate (e.g. "sandbox 4.00% APR, not real") that teams are *encouraged* to label as sandbox. It lets the yield UX be built and demoed honestly without anyone misrepresenting returns.

---

## CCTP / Bridge Kit — *not integrated (out of scope)*

Cross-chain funding was scoped out as a stretch. We will only tick the CCTP box if it's actually wired. No feedback to give beyond: keeping it off the critical path was the right call for a single-corridor MVP.

---

## Overall

The stack's strongest property is that each product has a clean interface seam, so a team can build the *shape* of the whole flow and swap fallbacks for live calls product-by-product as access lands. That's what let us ship a coherent end-to-end path despite gated tooling.

The biggest single improvement across the board would be **earlier, zero-approval sandbox access** (Wallets entity secret, StableFX indicative rates, USYC fake-but-labelled yield). Access latency — not API complexity — was our main constraint, and it's the difference between a "live" and a "conceptual" checkbox on the submission.
