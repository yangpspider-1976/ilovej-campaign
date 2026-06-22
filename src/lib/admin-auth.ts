// Lightweight admin session auth.
//
// After the user submits the correct ADMIN_SECRET on the login page, we set an
// httpOnly cookie whose value is an HMAC-SHA256 of a fixed payload keyed by the
// secret. The secret itself is never stored in the cookie; verification just
// recomputes the HMAC and compares. Uses Web Crypto so it runs in both the Edge
// middleware and Node route handlers.

export const ADMIN_COOKIE = "ilovej_admin";
const SESSION_PAYLOAD = "ilovej-admin-session-v1";

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

/** HMAC-SHA256(payload, secret) as hex — the session token value. */
export async function makeSessionToken(secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(SESSION_PAYLOAD));
  return toHex(sig);
}

/** Constant-time-ish string compare to avoid early-exit timing leaks. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** True if the cookie token matches the expected session for this secret. */
export async function isValidSession(
  token: string | undefined,
  secret: string
): Promise<boolean> {
  if (!token) return false;
  const expected = await makeSessionToken(secret);
  return safeEqual(token, expected);
}

export function getAdminSecret(): string {
  return process.env.ADMIN_SECRET ?? "changeme";
}
