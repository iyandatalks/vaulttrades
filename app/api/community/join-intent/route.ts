import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  try {
    const auth = await createClient();
    const { data: { user } } = await auth.auth.getUser();
    if (!user) return NextResponse.json({ error: "Sign in before continuing to Community payment." }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const referralCode = String(body?.referralCode || "").trim().toUpperCase().slice(0, 64);
    const admin = createAdminClient();
    const { data: profile, error: profileError } = await admin
      .from("users").select("id,email").eq("auth_user_id", user.id).maybeSingle();
    if (profileError || !profile?.id || !profile.email) {
      return NextResponse.json({ error: "A verified VaultTrades profile and email are required before payment." }, { status: 400 });
    }

    let referrerUserId: string | null = null;
    if (referralCode) {
      const { data: referrer } = await admin.from("referral_profiles")
        .select("user_id").eq("referral_code", referralCode).not("activated_at", "is", null).maybeSingle();
      if (referrer?.user_id && referrer.user_id !== profile.id) referrerUserId = referrer.user_id;
    }

    const { data: existing } = await admin.from("community_join_intents")
      .select("id").eq("user_id", profile.id).eq("status", "pending")
      .order("created_at", { ascending: false }).limit(1).maybeSingle();

    const payload = {
      user_id: profile.id,
      auth_user_id: user.id,
      email: String(profile.email).trim().toLowerCase(),
      referral_code: referrerUserId ? referralCode : null,
      referrer_user_id: referrerUserId,
      amount: 10,
      currency: "USD",
      status: "pending",
      updated_at: new Date().toISOString(),
    };
    const result = existing?.id
      ? await admin.from("community_join_intents").update(payload).eq("id", existing.id).select("id").single()
      : await admin.from("community_join_intents").insert(payload).select("id").single();
    if (result.error || !result.data) {
      console.error("Unable to prepare Community join payment", result.error);
      return NextResponse.json({ error: "Unable to prepare your Community payment. Please try again." }, { status: 500 });
    }
    return NextResponse.json({ ok: true, intentId: result.data.id, paymentUrl: "https://www.paypal.com/ncp/payment/GJAYGVK5THBKN" });
  } catch (error) {
    console.error("Community join intent error", error);
    return NextResponse.json({ error: "Unable to prepare Community payment." }, { status: 500 });
  }
}
