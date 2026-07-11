import { cookies } from "next/headers";

const COOKIE_NAME = "settl_party_id";

export async function setSession(partyId: string): Promise<void> {
  const c = await cookies();
  c.set(COOKIE_NAME, partyId, {
    httpOnly: true,
    secure: false,
    sameSite: "lax",
    maxAge: 60 * 60 * 24, // 1 day
    path: "/",
  });
}

export async function getSession(): Promise<string | null> {
  const c = await cookies();
  return c.get(COOKIE_NAME)?.value ?? null;
}

export async function clearSession(): Promise<void> {
  const c = await cookies();
  c.delete(COOKIE_NAME);
}
