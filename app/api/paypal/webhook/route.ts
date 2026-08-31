import { NextResponse } from "next/server";
import { createAdminClient } from "../../../../lib/supabase/admin";
import { paypalRequest } from "../../../../lib/paypal";

const AUTOMATED_EVENTS: Record<string, string> = {
  "BILLING.SUBSCRIPTION.ACTIVATED": "active",
  "BILLING.SUBSCRIPTION.UPDATED": "active",
  "BILLING.SUBSCRIPTION.SUSPENDED": "suspended",
  "BILLING.SUBSCRIPTION.CANCELLED": "cancelled",
  "BILLING.SUBSCRIPTION.EXPIRED": "expired",
  "PAYMENT.SALE.COMPLETED": "active",
  "PAYMENT.SALE.DENIED": "past_due",
  "BILLING.SUBSCRIPTION.PAYMENT.FAILED": "past_due"
};

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    if (!rawBody) return NextResponse.json({ error: "Empty webhook body" }, { status: 400 });
    const webhookId = process.env.PAYPAL_WEBHOOK_ID;
    if (!webhookId) return NextResponse.json({ error: "PayPal webhook is not configured." }, { status: 500 });
    const event = JSON.parse(rawBody);
    const h = request.headers;
    const verification = await paypalRequest("/v1/notifications/verify-webhook-signature", {
      method: "POST",
      body: JSON.stringify({ auth_algo: h.get("paypal-auth-algo"), cert_url: h.get("paypal-cert-url"), transmission_id: h.get("paypal-transmission-id"), transmission_sig: h.get("paypal-transmission-sig"), transmission_time: h.get("paypal-transmission-time"), webhook_id: webhookId, webhook_event: event })
    });
    if (verification.verification_status !== "SUCCESS") return NextResponse.json({ error: "Invalid PayPal webhook signature." }, { status: 401 });

    const eventType = String(event.event_type || "");
    const admin = createAdminClient();

    if (AUTOMATED_EVENTS[eventType]) {
      const resource = event.resource || {};
      const subscriptionId = String(resource.id || resource.billing_agreement_id || resource.supplementary_data?.related_ids?.subscription_id || "");
      if (!subscriptionId) return NextResponse.json({ received: true, ignored: true, reason: "No subscription reference" }, { status: 200 });
      const { data: existing } = await admin.from("automated_trader_subscriptions").select("id,auth_user_id").eq("provider", "paypal").eq("provider_subscription_id", subscriptionId).maybeSingle();
      if (!existing) return NextResponse.json({ received: true, ignored: true, reason: "Unknown Automated Trader subscription" }, { status: 200 });
      if (event.id) {
        const { data: duplicate } = await admin.from("automated_trader_events").select("id").eq("provider", "paypal").eq("provider_event_id", String(event.id)).maybeSingle();
        if (duplicate) return NextResponse.json({ received: true, duplicate: true }, { status: 200 });
      }
      let providerSubscription: any = null;
      try { providerSubscription = await paypalRequest(`/v1/billing/subscriptions/${encodeURIComponent(subscriptionId)}`); } catch (error) { console.error("Unable to refresh PayPal subscription", error); }
      const nextBilling = providerSubscription?.billing_info?.next_billing_time ? new Date(providerSubscription.billing_info.next_billing_time).toISOString() : null;
      const start = providerSubscription?.start_time ? new Date(providerSubscription.start_time).toISOString() : null;
      const status = AUTOMATED_EVENTS[eventType];
      await admin.from("automated_trader_events").insert({ auth_user_id: existing.auth_user_id, event_type: eventType, provider: "paypal", provider_event_id: event.id ? String(event.id) : null, payload: event });
      await admin.from("automated_trader_subscriptions").update({ status, current_period_start: start, current_period_end: nextBilling, last_provider_event: eventType, updated_at: new Date().toISOString() }).eq("id", existing.id);
      return NextResponse.json({ received: true, automatedTraderStatus: status }, { status: 200 });
    }

    if (!["PAYMENT.CAPTURE.COMPLETED", "CHECKOUT.ORDER.COMPLETED"].includes(eventType)) return NextResponse.json({ received: true, ignored: true }, { status: 200 });
    const orderId = String(event.resource?.supplementary_data?.related_ids?.order_id || event.resource?.id || "");
    if (!orderId) return NextResponse.json({ error: "PayPal webhook did not contain an order reference." }, { status: 400 });
    const order = await paypalRequest(`/v2/checkout/orders/${encodeURIComponent(orderId)}`);
    const purchase = order.purchase_units?.[0];
    const amount = Number(purchase?.amount?.value);
    const currency = String(purchase?.amount?.currency_code || "");
    const userId = String(purchase?.custom_id || "");
    if (!userId || !Number.isFinite(amount) || !currency) return NextResponse.json({ error: "PayPal order could not be verified." }, { status: 400 });
    const { data: transaction } = await admin.from("payment_transactions").select("id,auth_user_id,user_id,amount,currency,membership_months,status").eq("provider", "paypal").eq("provider_order_id", orderId).maybeSingle();
    if (!transaction) return NextResponse.json({ received: true, ignored: true, reason: "Unknown order" }, { status: 200 });
    if (transaction.auth_user_id !== userId || Number(transaction.amount) !== amount || transaction.currency !== currency) return NextResponse.json({ error: "PayPal order does not match VaultTrades transaction." }, { status: 400 });
    if (transaction.status === "verified") return NextResponse.json({ received: true, alreadyVerified: true }, { status: 200 });
    const capture = eventType === "PAYMENT.CAPTURE.COMPLETED" ? event.resource : order.purchase_units?.[0]?.payments?.captures?.find((x: any) => x.status === "COMPLETED");
    if (!capture || String(capture.status) !== "COMPLETED") return NextResponse.json({ received: true, pending: true }, { status: 200 });
    const expires = new Date(); expires.setMonth(expires.getMonth() + Number(transaction.membership_months || 1));
    await admin.from("payment_transactions").update({ status: "verified", provider_capture_id: String(capture.id || ""), raw_event: event, verified_at: new Date().toISOString() }).eq("id", transaction.id);
    await admin.from("users").update({ license_status: "active", is_active: true, payment_method: "paypal", last_payment_ref: String(capture.id || orderId), license_expires_at: expires.toISOString() }).eq("auth_user_id", transaction.auth_user_id);
    return NextResponse.json({ received: true, verified: true, membershipActive: true }, { status: 200 });
  } catch (error) {
    console.error("PayPal webhook error", error);
    return NextResponse.json({ error: "PayPal webhook processing failed." }, { status: 500 });
  }
}

export async function GET() { return NextResponse.json({ service: "VaultTrades PayPal webhook", status: "configured" }); }
