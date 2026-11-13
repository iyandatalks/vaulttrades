import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const ENTITLEMENTS = { nexus: "vaulttrades_nexus", nexus_plus: "vaulttrades_nexus_plus", vortex: "vaulttrades_vortex" } as const;

async function getReseller() {
  const auth = await createClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return { response: NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 }) };
  const db = createAdminClient();
  const { data: profile } = await db.from("users").select("id,email,role").eq("auth_user_id", user.id).maybeSingle();
  if (!profile) return { response: NextResponse.json({ error: "PROFILE_NOT_FOUND" }, { status: 404 }) };
  return { db, user, profile };
}

export async function GET() {
  const access = await getReseller();
  if ("response" in access) return access.response;
  const { data, error } = await access.db.from("reseller_purchase_orders")
    .select("id,customer_email,reseller_website,plan_code,expected_mrr_amount,declared_mrr_amount,reseller_transaction_reference,reseller_payment_date,reseller_payment_time,reseller_payment_status,vaulttrades_payment_status,created_at")
    .eq("reseller_auth_user_id", access.user.id)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: "Unable to load reseller payment declarations." }, { status: 500 });
  return NextResponse.json({ orders: data ?? [] });
}

export async function POST(request: Request) {
  const access = await getReseller();
  if ("response" in access) return access.response;
  const body = await request.json().catch(() => ({}));
  const orderId = String(body.orderId ?? "").trim();
  const action = String(body.action ?? "");
  const reason = String(body.reason ?? "").trim().slice(0, 500);
  if (!orderId || !["confirm", "reject"].includes(action)) {
    return NextResponse.json({ error: "Choose a valid order and confirmation action." }, { status: 400 });
  }

  const { data: order, error: loadError } = await access.db.from("reseller_purchase_orders")
    .select("*").eq("id", orderId).eq("reseller_auth_user_id", access.user.id).maybeSingle();
  if (loadError || !order) return NextResponse.json({ error: "This order was not found under your reseller account." }, { status: 404 });
  if (order.reseller_payment_status !== "awaiting_reseller_confirmation") {
    return NextResponse.json({ error: "This declaration has already been reviewed." }, { status: 409 });
  }

  if (action === "confirm") {
    if (order.vaulttrades_payment_status !== "verified" || !order.vaulttrades_payment_transaction_id) {
      return NextResponse.json({ error: "VaultTrades has not yet verified the customer's website and EA setup payment. You cannot confirm this order yet." }, { status: 409 });
    }
    const now = new Date().toISOString();
    const entitlement = ENTITLEMENTS[order.plan_code as keyof typeof ENTITLEMENTS];
    if (!entitlement) return NextResponse.json({ error: "The order's membership product is invalid." }, { status: 400 });

    const { error: licenseError } = await access.db.from("product_licenses").upsert({
      user_id: order.customer_user_id,
      email: order.customer_email,
      purchased_product_code: order.plan_code,
      entitlement_code: entitlement,
      status: "active",
      payment_reference: `reseller-order:${order.id}`,
      approved_at: now,
      approved_by: access.user.id,
      start_at: now,
      end_at: null,
      platform: "web",
      source_payment_snapshot: {
        source: "reseller_verified_mrr",
        reseller_order_id: order.id,
        reseller_code: order.reseller_code,
        reseller_transaction_reference: order.reseller_transaction_reference,
        reseller_declared_amount: order.declared_mrr_amount,
        vaulttrades_payment_transaction_id: order.vaulttrades_payment_transaction_id,
      },
      updated_at: now,
    }, { onConflict: "payment_reference,entitlement_code" });
    if (licenseError) {
      console.error("Reseller membership entitlement grant failed", licenseError);
      return NextResponse.json({ error: "Payment was confirmed, but membership activation failed. Contact VaultTrades support." }, { status: 500 });
    }

    const { error: updateError } = await access.db.from("reseller_purchase_orders").update({
      reseller_payment_status: "confirmed_by_reseller",
      reseller_confirmed_by: access.user.id,
      reseller_confirmed_at: now,
      updated_at: now,
    }).eq("id", order.id).eq("reseller_auth_user_id", access.user.id).eq("reseller_payment_status", "awaiting_reseller_confirmation");
    if (updateError) return NextResponse.json({ error: "Unable to record reseller confirmation." }, { status: 500 });

    await access.db.from("copy_profile_notifications").insert({
      auth_user_id: order.customer_auth_user_id,
      title: "Your VaultTrades membership is active",
      body: `Your reseller confirmed receipt of the ${order.plan_code.replace("_", " ")} payment. Your membership access is now active.`,
      action_href: "/member-portal",
      notification_type: "reseller_membership_activated",
      metadata: { reseller_order_id: order.id, plan_code: order.plan_code },
    });
    return NextResponse.json({ ok: true, status: "confirmed_by_reseller" });
  }

  if (reason.length < 3) return NextResponse.json({ error: "Provide a short reason when rejecting a payment declaration." }, { status: 400 });
  const { error: updateError } = await access.db.from("reseller_purchase_orders").update({
    reseller_payment_status: "rejected_by_reseller",
    reseller_confirmed_by: access.user.id,
    reseller_confirmed_at: new Date().toISOString(),
    reseller_rejection_reason: reason,
    updated_at: new Date().toISOString(),
  }).eq("id", order.id).eq("reseller_auth_user_id", access.user.id).eq("reseller_payment_status", "awaiting_reseller_confirmation");
  if (updateError) return NextResponse.json({ error: "Unable to record the reseller decision." }, { status: 500 });
  await access.db.from("copy_profile_notifications").insert({
    auth_user_id: order.customer_auth_user_id,
    title: "Reseller payment needs attention",
    body: `Your reseller could not confirm the declared payment. Reason: ${reason}`,
    action_href: "/membership/checkout?plan=${order.plan_code}&ref=${order.reseller_code}",
    notification_type: "reseller_payment_rejected",
    metadata: { reseller_order_id: order.id },
  });
  return NextResponse.json({ ok: true, status: "rejected_by_reseller" });
}
