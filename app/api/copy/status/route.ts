import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await createClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  // Connection persistence is intentionally kept behind the copy API boundary.
  // The MT5 Copier EA will use the pairing/heartbeat records when the copy backend is enabled.
  return NextResponse.json({ connected: false, account: null });
}
