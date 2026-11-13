import { NextResponse } from "next/server";
import { createClient } from "../../../../lib/supabase/server";
import { createAdminClient } from "../../../../lib/supabase/admin";
import { paypalRequest } from "../../../../lib/paypal";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "You must be logged in." }, { status: 401 });
    const body = await request.json();
    const orderId = String(body.orderId || "");
    if (!orderId) return NextResponse.json({ error: "PayPal order ID is required." }, { status: 400 });

    const admin = createAdminClient();
    const { data: transaction } = await admin
      .from("payment_transactions")
      .select("id,provider_order_id,amount,currency,user_id,auth_user_id,status,membership_months,payment_method,raw_event")
      .eq("provider", "paypal")
      .eq("provider_order_id", orderId)
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (!transaction) return NextResponse.json({ error: "Payment transaction was not found." }, { status: 404 });
    if (transaction.status === "verified") return NextResponse.json({ success: true, membershipActive: true, alreadyVerified: true });

    const capture = await paypalRequest(`/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, { method: "POST", headers: { "PayPal-Request-Id": `capture-${orderId}` }, body: "{}" });
    const purchase = capture.purchase_units?.[0];
    const captureRecord = purchase?.payments?.captures?.[0];
    const capturedValue = Number(captureRecord?.amount?.value);
    const capturedCurrency = String(captureRecord?.amount?.currency_code || "");
    const status = String(captureRecord?.status || "");
    if (status !== "COMPLETED" || capturedCurrency !== transaction.currency || capturedValue !== Number(transaction.amount)) {
      return NextResponse.json({ error: "PayPal payment could not be verified." }, { status: 400 });
    }

    const expires = new Date();
    expires.setMonth(expires.getMonth() + Number(transaction.membership_months || 1));
    const verifiedAt = new Date().toISOString();
    await admin.from("payment_transactions").update({ status: "verified", provider_capture_id: captureRecord.id, raw_event: capture, verified_at: verifiedAt }).eq("id", transaction.id);

    if (transaction.payment_method === "paypal_reseller_setup" || transaction.raw_event?.order_type === "reseller_setup") {
      const declarationId = String(transaction.raw_event?.declaration_id || "");
      if (!declarationId) return NextResponse.json({ error: "The setup payment is missing its reseller declaration reference." }, { status: 500 });
      const { error: declarationError } = await admin.from("reseller_purchase_orders").update({
        vaulttrades_payment_status: "verified",
        vaulttrades_payment_transaction_id: transaction.id,
        updated_at: verifiedAt,
      }).eq("id", declarationId).eq("customer_auth_user_id", user.id);
      if (declarationError) {
        console.error("Unable to mark VaultTrades setup payment as verified", declarationError);
        return NextResponse.json({ error: "Payment was captured, but the reseller order could not be updated. Contact support." }, { status: 500 });
      }
      return NextResponse.json({
        success: true,
        membershipActive: false,
        awaitingResellerConfirmation: true,
        orderId,
        captureId: captureRecord.id,
        verifiedAt,
      });
    }

    await admin.from("users").update({ license_status: "active", is_active: true, payment_method: "paypal", last_payment_ref: String(captureRecord.id), license_expires_at: expires.toISOString() }).eq("auth_user_id", user.id);

    return NextResponse.json({ success: true, membershipActive: true, orderId, captureId: captureRecord.id, expiresAt: expires.toISOString() });
  } catch (error) {
    console.error("PayPal capture error", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to verify PayPal payment." }, { status: 500 });
  }
}
