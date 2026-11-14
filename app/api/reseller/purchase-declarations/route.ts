import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const PLAN_AMOUNTS = { nexus: 120, nexus_plus: 200, vortex: 440 } as const;
type PlanCode = keyof typeof PLAN_AMOUNTS;

function getRequestWebsite(request: Request) {
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const directHost = request.headers.get("host")?.trim();
  const host = (forwardedHost || directHost || "").toLowerCase().replace(/:\d+$/, "");
  if (!/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/.test(host)) return null;
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const protocol = forwardedProto === "http" && /^(localhost|127\.0\.0\.1)$/.test(host) ? "http" : "https";
  return `${protocol}://${host}`;
}

export async function GET(request: Request) {
  const auth = await createClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  const declarationId = new URL(request.url).searchParams.get("declarationId")?.trim();
  if (!declarationId) return NextResponse.json({ error: "A purchase declaration is required." }, { status: 400 });

  const db = createAdminClient();
  const { data: order, error } = await db.from("reseller_purchase_orders")
    .select("id,plan_code,reseller_payment_status,vaulttrades_payment_status,customer_email,created_at,declared_mrr_amount")
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
  const amount = Number(body.amount);
  const transactionReference = String(body.transactionReference ?? "").trim();
  const invoiceNumber = String(body.invoiceNumber ?? "").trim();
  const resellerWebsite = getRequestWebsite(request);
  const paymentDate = new Date().toISOString().slice(0, 10);

  if (!Object.prototype.hasOwnProperty.call(PLAN_AMOUNTS, planCode) || !resellerCode || !/^[A-Z0-9-]{4,32}$/.test(resellerCode)) {
    return NextResponse.json({ error: "The partner reference or selected membership plan is invalid." }, { status: 400 });
  }
  if (!resellerWebsite) {
    return NextResponse.json({ error: "We could not identify the website this purchase came from. Please reopen the original partner checkout link." }, { status: 400 });
  }
  if (!Number.isFinite(amount) || amount <= 0 || amount > 100000) {
    return NextResponse.json({ error: "Enter the actual amount paid in USD." }, { status: 400 });
  }
  if (transactionReference.length > 120 || invoiceNumber.length > 120) {
    return NextResponse.json({ error: "The transaction reference and invoice number must each be 120 characters or fewer." }, { status: 400 });
  }

  const db = createAdminClient();
  const [{ data: customer, error: customerError }, { data: reseller, error: resellerError }] = await Promise.all([
    db.from("users").select("id,email").eq("auth_user_id", user.id).maybeSingle(),
    db.from("users").select("id,auth_user_id,referral_code").eq("referral_code", resellerCode).maybeSingle(),
  ]);
  if (customerError || !customer) return NextResponse.json({ error: "Your VaultTrades profile could not be found. Please complete registration first." }, { status: 400 });
  if (resellerError || !reseller || !reseller.auth_user_id || reseller.id === customer.id) {
    return NextResponse.json({ error: "The partner reference could not be verified." }, { status: 400 });
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
  if (!resellerIsActive) return NextResponse.json({ error: "This partner account is not currently eligible to process membership purchases." }, { status: 400 });

  // The column is non-null and may be covered by a unique index. A generated marker
  // preserves optional customer input without making multiple blank references collide.
  const storedTransactionReference = transactionReference || `Not supplied · ${randomUUID()}`;
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
    reseller_transaction_reference: storedTransactionReference,
    reseller_invoice_number: invoiceNumber || null,
    reseller_payment_date: paymentDate,
    reseller_payment_time: null,
    terms_accepted_at: new Date().toISOString(),
  }).select("id,plan_code,expected_mrr_amount,declared_mrr_amount,reseller_payment_status,vaulttrades_payment_status").single();

  if (error || !order) {
    const duplicate = /duplicate key|unique constraint/i.test(error?.message ?? "");
    if (duplicate && transactionReference) {
      const { data: previous } = await db.from("reseller_purchase_orders")
        .select("id,plan_code,expected_mrr_amount,reseller_payment_status,vaulttrades_payment_status,reseller_transaction_reference")
        .eq("customer_auth_user_id", user.id)
        .eq("reseller_code", resellerCode)
        .eq("plan_code", planCode)
        .order("created_at", { ascending: false })
        .limit(10);
      const matching = (previous ?? []).find(row => String(row.reseller_transaction_reference).trim().toLowerCase() === transactionReference.toLowerCase());
      if (matching) return NextResponse.json({ ok: true, declaration: matching, existing: true });
      return NextResponse.json({ error: "That transaction reference has already been submitted. Check your details or contact VaultTrades support." }, { status: 409 });
    }
    return NextResponse.json({ error: "Unable to save your payment details. Please try again." }, { status: 500 });
  }

  await db.from("copy_profile_notifications").insert({
    auth_user_id: reseller.auth_user_id,
    title: "Customer payment declaration received",
    body: `A customer has declared a ${planCode.replace("_", " ")} purchase. Check your PayPal account and verify the partner payment before confirming access.`,
    action_href: "/member-portal/reseller-payments",
    notification_type: "reseller_payment_declaration",
    metadata: { reseller_order_id: order.id, plan_code: planCode, declared_amount: amount },
  });

  await db.from("admin_inbox_notifications").insert({
    event_type: "reseller_purchase_declared",
    title: "New partner purchase declaration",
    body: `${order.plan_code} purchase declared by ${customer.email || user.email}; awaiting partner verification.`,
    severity: "normal",
    auth_user_id: user.id,
    customer_email: customer.email || user.email || null,
    related_id: order.id,
    action_href: "/member-portal/reseller-payments",
    metadata: { reseller_code: resellerCode, plan_code: planCode, declared_mrr_amount: amount, invoice_number: invoiceNumber || null, reseller_website: resellerWebsite },
  });

  return NextResponse.json({ ok: true, declaration: order });
}
