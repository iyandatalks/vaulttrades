export const PARTNER_ACCESS_COOKIE = "vt_partner_access";
export const PARTNER_ACCESS_MAX_AGE = 60 * 60 * 24 * 30;

function getSigningSecret() {
  return process.env.SUPABASE_SERVICE_ROLE_KEY || "";
}

function toHex(bytes: Uint8Array) {
  return Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
}

function fromHex(value: string) {
  if (!/^(?:[0-9a-f]{2})+$/i.test(value)) return null;
  const bytes = new Uint8Array(value.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(value.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}

async function signingKey() {
  const secret = getSigningSecret();
  if (!secret || !globalThis.crypto?.subtle) return null;
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

export async function createPartnerAccessToken(referralCode: string) {
  const code = String(referralCode || "").trim().toUpperCase();
  if (!/^[A-Z0-9_-]{3,80}$/.test(code)) return null;
  const key = await signingKey();
  if (!key) return null;
  const expiresAt = Math.floor(Date.now() / 1000) + PARTNER_ACCESS_MAX_AGE;
  const payload = `${code}.${expiresAt}`;
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return `${payload}.${toHex(new Uint8Array(signature))}`;
}

export async function verifyPartnerAccessToken(token?: string) {
  if (!token || token.length > 300) return false;
  const [code, expiryText, signatureText, extra] = token.split(".");
  if (extra !== undefined || !/^[A-Z0-9_-]{3,80}$/.test(code || "")) return false;
  const expiresAt = Number(expiryText);
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= Math.floor(Date.now() / 1000)) return false;
  const signature = fromHex(signatureText || "");
  if (!signature) return false;
  const key = await signingKey();
  if (!key) return false;
  return crypto.subtle.verify("HMAC", key, signature, new TextEncoder().encode(`${code}.${expiresAt}`));
}
