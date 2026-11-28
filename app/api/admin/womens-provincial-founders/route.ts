import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requireAdmin() {
  const auth = await createClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 }) };
  const db = createServiceClient();
  const { data: profile } = await db.from("users").select("id,role").eq("auth_user_id", user.id).maybeSingle();
  if (profile?.role !== "admin") return { error: NextResponse.json({ error: "FORBIDDEN" }, { status: 403 }) };
  return { db };
}

export async function GET() {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;
  const { data, error } = await auth.db.from("womens_provincial_founders_leads")
    .select("id,created_at,full_name,email,cellphone,province,purchase_type,contribution_amount,group_size,group_members,payment_status,payment_reference,payment_confirmed_at,source_host,referral_code,referrer_user_id")
    .order("created_at", { ascending: false }).limit(500);
  if (error) return NextResponse.json({ error: "LEADS_LOAD_FAILED" }, { status: 500 });
  return NextResponse.json({ leads: data || [] });
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;
  const body = await req.json().catch(() => ({}));
  if (typeof body.id !== "string" || !["paid", "pending", "failed", "refunded", "review"].includes(body.paymentStatus)) {
    return NextResponse.json({ error: "INVALID_UPDATE" }, { status: 400 });
  }

  const { data: existingLead, error: leadLookupError } = await auth.db.from("womens_provincial_founders_leads")
    .select("id,referrer_user_id,referral_code,contribution_amount,payment_status")
    .eq("id", body.id).maybeSingle();
  if (leadLookupError || !existingLead) return NextResponse.json({ error: "LEAD_NOT_FOUND" }, { status: 404 });

  const patch: Record<string, unknown> = { payment_status: body.paymentStatus };
  if (body.paymentStatus === "paid") {
    patch.payment_confirmed_at = new Date().toISOString();
    patch.payment_reference = String(body.paymentReference || "").trim() || null;
  } else {
    patch.payment_confirmed_at = null;
  }
  const { data, error } = await auth.db.from("womens_provincial_founders_leads")
    .update(patch).eq("id", body.id).select("id,payment_status").single();
  if (error) return NextResponse.json({ error: error.code === "23505" ? "A paid group already exists for this province." : "LEAD_UPDATE_FAILED" }, { status: error.code === "23505" ? 409 : 500 });

  let commissionCreated = false;
  if (body.paymentStatus === "paid" && existingLead.referrer_user_id) {
    const commissionReference = `womens-founders:${existingLead.id}`;
    const { data: priorCommission, error: commissionLookupError } = await auth.db.from("referral_commissions")
      .select("id").eq("subscription_id", commissionReference).maybeSingle();
    if (commissionLookupError) return NextResponse.json({ error: "Payment was confirmed, but the partner commission could not be checked. Retry the confirmation." }, { status: 500 });
    if (!priorCommission) {
      const amount = Number(existingLead.contribution_amount);
      const commissionAmount = Number((amount * 0.2).toFixed(2));
      const { error: commissionError } = await auth.db.from("referral_commissions").insert({
        referrer_id: existingLead.referrer_user_id,
        referral_id: null,
        subscription_id: commissionReference,
        subscription_amount_usd: amount,
        commission_rate: 20,
        commission_amount_usd: commissionAmount,
        status: "pending",
      });
      if (commissionError) {
        console.error("Women's founders referral commission insert failed", commissionError);
        return NextResponse.json({ error: "Payment was confirmed, but the partner commission needs reconciliation. Retry the confirmation after checking the ledger." }, { status: 500 });
      }
      commissionCreated = true;
    }
  }

  return NextResponse.json({ lead: data, commissionCreated, commissionRate: existingLead.referrer_user_id ? 20 : 0 });
}
