import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";

function authorized(req: Request) {
  const key = process.env.VAULTTRADES_MASTER_API_KEY;
  return !!key && req.headers.get("x-vaulttrades-master-key") === key;
}

export async function POST(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const { masterId, mtLogin, brokerServer, eaVersion } = body;

  if (!masterId) {
    return NextResponse.json({ error: "MASTER_ID_REQUIRED" }, { status: 400 });
  }

  const db = createServiceClient();
  const { data: master } = await db
    .from("copy_masters")
    .select("id")
    .eq("id", masterId)
    .maybeSingle();

  if (!master) {
    return NextResponse.json({ error: "MASTER_NOT_FOUND" }, { status: 404 });
  }

  const now = new Date().toISOString();
  const { error } = await db
    .from("copy_masters")
    .update({
      status: "online",
      mt_login: mtLogin ? String(mtLogin) : null,
      broker_server: brokerServer ? String(brokerServer) : null,
      ea_version: eaVersion ? String(eaVersion) : null,
      last_heartbeat_at: now,
    })
    .eq("id", masterId);

  if (error) {
    return NextResponse.json({ error: "HEARTBEAT_FAILED", detail: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, status: "online", heartbeatAt: now });
}
