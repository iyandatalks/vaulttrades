const METAKIT_BASE_URL = "https://api.metakit.cloud";

function key() {
  const value = process.env.METAKIT_KEY;
  if (!value) throw new Error("MetaKit backend API key is not configured.");
  return value;
}

export async function metakitRequest(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${key()}`);
  headers.set("Content-Type", "application/json");
  const response = await fetch(`${METAKIT_BASE_URL}${path}`, { ...init, headers, cache: "no-store" });
  const text = await response.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!response.ok) {
    const detail = typeof data === "string" ? data : JSON.stringify(data);
    throw new Error(`MetaKit API ${response.status}: ${detail}`);
  }
  return data;
}

export function metakitConfigured() {
  return Boolean(process.env.METAKIT_KEY);
}
