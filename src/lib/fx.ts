// FX quote service — captures and caches USD→PHP rates via StableFX.
//
// Circle product: StableFX (see docs/circle-integration.md §4).
// This is the StableFX-shaped seam: when CIRCLE_API_KEY / FX_SOURCE_URL is set
// the rate comes from StableFX and the quote is tagged source = "stablefx".
// When access is gated, it falls back to FX_FALLBACK_RATE tagged "fallback" —
// the *mechanism* (quote once, cache 60s, store, read from DB) is identical.
//
// Captured once at invoice creation; cached server-side for 60 seconds.
// Pay-link page reads the stored quote from DB — never calls this live.

const CACHE_TTL_MS = 60_000; // 60 seconds

export const FX_SOURCE_STABLEFX = "stablefx";
export const FX_SOURCE_FALLBACK = "fallback";

interface CachedQuote {
  rate: string;
  source: string;
  validUntil: Date;
}

let cached: CachedQuote | null = null;

function isCacheValid(): boolean {
  if (!cached) return false;
  return new Date() < cached.validUntil;
}

/**
 * Fetch a USD→PHP quote from StableFX.
 *
 * LIVE path: with a Circle account that has StableFX access, replace the body
 * with the StableFX quote call:
 *   const q = await stableFx.createQuote({ from: "USD", to: "PHP" });
 *   return { rate: q.rate };
 *
 * SHAPED path (current): if FX_SOURCE_URL is configured we fetch it as a
 * StableFX-shaped endpoint; otherwise we signal "no live source" by returning
 * null so the caller uses the documented fallback rate.
 */
async function fetchStableFxRate(): Promise<string | null> {
  const fxSourceUrl = process.env.FX_SOURCE_URL;
  if (!fxSourceUrl) return null;

  try {
    const res = await fetch(fxSourceUrl, { cache: "no-store" });
    if (!res.ok) throw new Error(`StableFX source returned ${res.status}`);
    const data = (await res.json()) as { rate?: number | string };
    if (data.rate == null) return null;
    return String(data.rate);
  } catch {
    return null;
  }
}

/**
 * Returns a USD→PHP quote. Cached server-side for 60 seconds.
 *
 * Sourced from StableFX (source = "stablefx") when a live source is configured,
 * otherwise the documented fallback rate (source = "fallback").
 *
 * Called once at invoice creation. Never called at pay-link view time.
 */
export async function getUsdToPhpQuote(): Promise<{
  rate: string;
  source: string;
  validUntil: Date;
}> {
  if (isCacheValid()) {
    return cached!;
  }

  const fallbackRate = process.env.FX_FALLBACK_RATE ?? "56.00";

  const stableFxRate = await fetchStableFxRate();

  const rate = stableFxRate ?? fallbackRate;
  const source = stableFxRate ? FX_SOURCE_STABLEFX : FX_SOURCE_FALLBACK;

  const validUntil = new Date(Date.now() + CACHE_TTL_MS);

  cached = { rate, source, validUntil };

  return cached;
}

/**
 * Call this after invoice creation to invalidate the cache so each
 * new invoice captures a fresh quote.
 */
export function invalidateQuoteCache(): void {
  cached = null;
}
