const isSandbox = () => (process.env.PAYPAL_ENV || "sandbox").toLowerCase() !== "live";
const baseUrl = () => isSandbox() ? "https://api-m.sandbox.paypal.com" : "https://api-m.paypal.com";

export const paypalIsSandbox = isSandbox;
export const paypalBaseUrl = baseUrl;

export async function paypalAccessToken() {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("PayPal credentials are not configured.");
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const response = await fetch(`${baseUrl()}/v1/oauth2/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
    cache: "no-store"
  });
  if (!response.ok) throw new Error(`PayPal OAuth failed: ${response.status}`);
  const data = await response.json();
  return String(data.access_token);
}

export async function paypalRequest(path: string, init: RequestInit = {}) {
  const token = await paypalAccessToken();
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  headers.set("Content-Type", "application/json");
  const response = await fetch(`${baseUrl()}${path}`, { ...init, headers, cache: "no-store" });
  const text = await response.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!response.ok) throw new Error(`PayPal API ${response.status}: ${typeof data === "string" ? data : JSON.stringify(data)}`);
  return data;
}
