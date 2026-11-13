import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const PLAN_AMOUNTS = { nexus: 120, nexus_plus: 200, vortex: 440 } as const;
type PlanCode = keyof typeof PLAN_AMOUNTS;

export async function POST(request: Request) {
  const auth = await createClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in or create your VaultTrades profile to continue." }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const planCode = String(body.planCode ?? "") as PlanCode;
  const resellerCode = String(body.resellerCode ?? "").trim().toUpperCase();
  const resellerWebsite = String(body.resellerWebsite ?? "").trim().toLowerCase();
  const amount = Number(body.amount);
  const transactionReference = String(body.transactionReference ?? "").trim();
  const paymentDate = String(body.paymentDate ?? "").trim();
  const paymentTime = String(body.paymentTime ?? "").trim();
  const termsAccepted = body.termsAccepted === true;

  if (!(planCode in PLAN_AMOUNTS) || !resellerCode || !/^[A-Z0-9-]{4,32}$/.test(resellerCode)) {
    return NextResponse.json({ error: "The reseller reference or selected membership plan is invalid." }, { status: 400 });
  }
  if (!resellerWebsite || resellerWebsite.length > 255 || !/^(?:[a-z0-9-]+\.)+[a-z]{2,}(?::\d+)?(?:\/.*)?$/i.test(resellerWebsite)) {
    return NextResponse.json({ error: "Enter the reseller website you purchased from." }, { status: 400 });
  }
  if (!Number.isFinite(amount) || Math.abs(amount - PLAN_AMOUNTS[planCode]) > 0.001) {
    return NextResponse.json({ error: `The expected reseller payment for this plan is $${PLAN_AMOUNTS[planCode].toFixed(2)} USD. Please enter the amount actually paid.` }, { status: 400 });
  }
  if (transactionReference.length < 5 || transactionReference.length > 120) {
    return NextResponse.json({ error: "Enter the PayPal invoice or transaction reference from your reseller payment." }, { status: 400 });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(paymentDate) || Number.isNaN(Date.parse(paymentDate))) {
    return NextResponse.json({ error: "Enter the date you paid the reseller." }, { status: 400 });
  }
  if (paymentTime && !/^([01]\d|2[0-3]):[0-5]\d$/.test(paymentTime)) {
    return NextResponse.json({ error: "Enter the payment time in 24-hour format or leave it blank." }, { status: 400 });
  }
  if (!termsAccepted) return NextResponse.json({ error: "You must accept the terms and conditions to continue." }, { status: 400 });

  const db = createAdminClient();
  const [{ data: customer, error: customerError }, { data: reseller, error: resellerError }] = await Promise.all([
    db.from("users").select("id,email").eq("auth_user_id", user.id).maybeSingle(),
    db.from("users").select("id,auth_user_id,referral_code").eq("referral_code", resellerCode).maybeSingle(),
  ]);
  if (customerError || !customer) return NextResponse.json({ error: "Your VaultTrades profile could not be found. Please complete registration first." }, { status: 400 });
  if (resellerError || !reseller || !reseller.auth_user_id || reseller.id === customer.id) {
    return NextResponse.json({ error: "The reseller reference could not be verified." }, { status: 400 });
  }

  const { data: order, error } = await db.from("reseller_purchase_orders").insert({
    customer_user_id: customer.id,
    customer_auth_user_id: user.id,
    customer_email: String(user.email || customer.email || "").toLowerCase(),
    reseller_user_id: reseller.id,
    reseller_auth_user_id: reseller.auth_user_id,
    reseller_code: resellerCode,
    reseller_website: resellerWebsite,
    plan_code: planCode,
    expected_mrr_amount: PLAN_AMOUNTS[planCode],
    declared_mrr_amount: amount,
    reseller_transaction_reference: transactionReference,
    reseller_payment_date: paymentDate,
    reseller_payment_time: paymentTime || null,
    terms_accepted_at: new Date().toISOString(),
  }).select("id,plan_code,expected_mrr_amount,reseller_payment_status,vaulttrades_payment_status").single();

  if (error || !order) {
    const duplicate = /duplicate key|unique constraint/i.test(error?.message ?? "");
    return NextResponse.json({ error: duplicate ? "That PayPal transaction reference has already been submitted. Check the reference or contact VaultTrades support." : "Unable to save your reseller payment declaration. Please try again." }, { status: 409 });
  }

  await db.from("admin_inbox_notifications").insert({
    event_type: "reseller_purchase_declared",
    title: "New reseller purchase declaration",
    body: `${order.plan_code} purchase declared by ${customer.email || user.email}; awaiting reseller verification.`,
    severity: "normal",
    auth_user_id: user.id,
    customer_email: customer.email || user.email || null,
    related_id: order.id,
    action_href: "/member-portal/reseller-payments",
    metadata: { reseller_code: resellerCode, plan_code: planCode, declared_mrr_amount: amount },
  });

  return NextResponse.json({ ok: true, declaration: order });
}
