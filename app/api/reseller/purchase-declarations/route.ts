import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const PLAN_AMOUNTS = { nexus: 120, nexus_plus: 200, vortex: 440 } as const;
type PlanCode = keyof typeof PLAN_AMOUNTS;

export async function GET(request: Request) {
  const auth = await createClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  const declarationId = new URL(request.url).searchParams.get("declarationId")?.trim();
  if (!declarationId) return NextResponse.json({ error: "A purchase declaration is required." }, { status: 400 });

  const db = createAdminClient();
  const { data: order, error } = await db.from("reseller_purchase_orders")
    .select("id,plan_code,reseller_payment_status,vaulttrades_payment_status,customer_email,created_at")
    .eq("id", declarationId)
    .eq("customer_auth_user_id", user.id)
    .maybeSingle();
  if (error || !order) return NextResponse.json({ error: "Purchase declaration not found." }, { status: 404 });

  const { data: componentPayments, error: paymentError } = await db.from("payment_transactions")
    .select("id,payment_method,status,raw_event")
    .eq("provider", "paypal")
    .eq("status", "verified")
    .contains("raw_event", { declaration_id: declarationId, order_type: "reseller_setup_component" });
  if (paymentError) return NextResponse.json({ error: "Unable to load PayPal payment status." }, { status: 500 });

  const legacyVerified = order.vaulttrades_payment_status === "verified" && !(componentPayments || []).length;
  const eaSetupPaid = legacyVerified || (componentPayments || []).some((row: any) => row.payment_method === "paypal_reseller_ea_setup");
  const websiteSetupPaid = legacyVerified || (componentPayments || []).some((row: any) => row.payment_method === "paypal_reseller_website_setup");
  return NextResponse.json({
    declaration: order,
    payments: { eaSetupPaid, websiteSetupPaid, vaultTradesSetupComplete: eaSetupPaid && websiteSetupPaid },
  });
}

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

  if (!Object.prototype.hasOwnProperty.call(PLAN_AMOUNTS, planCode) || !resellerCode || !/^[A-Z0-9-]{4,32}$/.test(resellerCode)) {
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
  const { data: resellerLicenses } = await db.from("product_licenses")
    .select("entitlement_code,status,start_at,end_at")
    .eq("user_id", reseller.id)
    .in("entitlement_code", ["nexus","vaulttrades_nexus","nexus_plus","vaulttrades_nexus_plus","vortex","vaulttrades_vortex"])
    .eq("status", "active");
  const now = Date.now();
  const resellerIsActive = (resellerLicenses ?? []).some(license => {
    const start = license.start_at ? new Date(license.start_at).getTime() : 0;
    const end = license.end_at ? new Date(license.end_at).getTime() : Number.POSITIVE_INFINITY;
    return Number.isFinite(start) && start <= now && end > now;
  });
  if (!resellerIsActive) return NextResponse.json({ error: "This reseller account is not currently eligible to process membership purchases." }, { status: 400 });

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
    if (duplicate) {
      const { data: previous } = await db.from("reseller_purchase_orders")
        .select("id,plan_code,expected_mrr_amount,reseller_payment_status,vaulttrades_payment_status,reseller_transaction_reference")
        .eq("customer_auth_user_id", user.id)
        .eq("reseller_code", resellerCode)
        .eq("plan_code", planCode)
        .order("created_at", { ascending: false })
        .limit(10);
      const matching = (previous ?? []).find(row => String(row.reseller_transaction_reference).trim().toLowerCase() === transactionReference.toLowerCase());
      if (matching) return NextResponse.json({ ok: true, declaration: matching, existing: true });
      return NextResponse.json({ error: "That PayPal transaction reference has already been submitted for another customer or reseller. Contact VaultTrades support if you believe this is an error." }, { status: 409 });
    }
    return NextResponse.json({ error: "Unable to save your reseller payment declaration. Please try again." }, { status: 500 });
  }

  await db.from("copy_profile_notifications").insert({
    auth_user_id: reseller.auth_user_id,
    title: "Customer payment declaration received",
    body: `A customer has declared a ${planCode.replace("_", " ")} purchase. Check your PayPal account and verify the MRR payment before confirming access.`,
    action_href: "/member-portal/reseller-payments",
    notification_type: "reseller_payment_declaration",
    metadata: { reseller_order_id: order.id, plan_code: planCode, declared_amount: amount },
  });

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
