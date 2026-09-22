import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST() {
  const auth = await createClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  // Pairing storage/execution is intentionally not faked here.
  // This endpoint is the contract the MT5 Copier EA will use once the copy tables/API are connected.
  return NextResponse.json(
    { error: "COPY_BACKEND_NOT_CONFIGURED", message: "MT5 copy connection backend has not been enabled yet." },
    { status: 501 }
  );
}
