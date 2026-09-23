import { NextResponse } from "next/server";
import { createAdminClient } from "../../../../lib/supabase/admin";
import { paypalRequest } from "../../../../lib/paypal";
import { getPayPalProductByPlanId } from "../../../../lib/paypal-products";

const SUBSCRIPTION_EVENTS: Record<string, string> = {
  "BILLING.SUBSCRIPTION.ACTIVATED": "active",
  "BILLING.SUBSCRIPTION.UPDATED": "active",
  "BILLING.SUBSCRIPTION.SUSPENDED": "suspended",
  "BILLING.SUBSCRIPTION.CANCELLED": "cancelled",
  "BILLING.SUBSCRIPTION.EXPIRED": "expired",
  "PAYMENT.SALE.COMPLETED": "active",
  "PAYMENT.SALE.DENIED": "past_due",
  "BILLING.SUBSCRIPTION.PAYMENT.FAILED": "past_due",
};

async function grantFeature(admin: any, userId: string, feature: string, start: string, end: string | null, status: string) {
  const { data: existing } = await admin.from("user_feature_access").select("id").eq("user_id", userId).eq("feature_code", feature).eq("status", "active").order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (status === "active") {
    if (existing) await admin.from("user_feature_access").update({ start_at: start, end_at: end, updated_at: new Date().toISOString(), grant_reason: "PayPal subscription active" }).eq("id", existing.id);
    else await admin.from("user_feature_access").insert({ user_id: userId, feature_code: feature, status: "active", start_at: start, end_at: end, granted_by: "paypal_webhook", grant_reason: "PayPal subscription active" });
  } else if (existing) {
    await admin.from("user_feature_access").update({ end_at: end || new Date().toISOString(), updated_at: new Date().toISOString(), grant_reason: `PayPal subscription ${status}` }).eq("id", existing.id);
  }
}

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
      body: JSON.stringify({ auth_algo: h.get("paypal-auth-algo"), cert_url: h.get("paypal-cert-url"), transmission_id: h.get("paypal-transmission-id"), transmission_sig: h.get("paypal-transmission-sig"), transmission_time: h.get("paypal-transmission-time"), webhook_id: webhookId, webhook_event: event }),
    });
    if (verification.verification_status !== "SUCCESS") return NextResponse.json({ error: "Invalid PayPal webhook signature." }, { status: 401 });

    const eventType = String(event.event_type || "");
    if (!SUBSCRIPTION_EVENTS[eventType]) return NextResponse.json({ received: true, ignored: true }, { status: 200 });

    const admin = createAdminClient();
    const resource = event.resource || {};
    const subscriptionId = String(resource.supplementary_data?.related_ids?.subscription_id || resource.billing_agreement_id || resource.id || "");
    if (!subscriptionId) return NextResponse.json({ received: true, ignored: true, reason: "No subscription reference" }, { status: 200 });

    if (event.id) {
      const { data: duplicate } = await admin.from("automated_trader_events").select("id").eq("provider", "paypal").eq("provider_event_id", String(event.id)).maybeSingle();
      if (duplicate) return NextResponse.json({ received: true, duplicate: true }, { status: 200 });
    }

    let providerSubscription: any;
    try { providerSubscription = await paypalRequest(`/v1/billing/subscriptions/${encodeURIComponent(subscriptionId)}`); }
    catch (error) { console.error("Unable to refresh PayPal subscription", error); return NextResponse.json({ error: "Unable to verify PayPal subscription." }, { status: 502 }); }

    const planId = String(resource.plan_id || providerSubscription?.plan_id || "");
    const product = getPayPalProductByPlanId(planId);
    if (!product) return NextResponse.json({ received: true, ignored: true, reason: "Unknown VaultTrades PayPal plan" }, { status: 200 });

    let authUserId = String(resource.custom_id || providerSubscription?.custom_id || "");
    let profile: any = null;
    if (authUserId) {
      const { data } = await admin.from("users").select("id,auth_user_id,email").eq("auth_user_id", authUserId).maybeSingle();
      profile = data;
    }
    const subscriberEmail = String(resource.subscriber?.email_address || providerSubscription?.subscriber?.email_address || "").trim().toLowerCase();
    if (!profile && subscriberEmail) {
      const { data } = await admin.from("users").select("id,auth_user_id,email").ilike("email", subscriberEmail).maybeSingle();
      profile = data;
      authUserId = String(profile?.auth_user_id || "");
    }
    if (!profile || !authUserId) return NextResponse.json({ received: true, ignored: true, reason: "VaultTrades customer could not be matched" }, { status: 200 });

    const status = SUBSCRIPTION_EVENTS[eventType];
    const isLifetimeMentorship = product.code === "founders_mentorship_once";
    const start = providerSubscription?.start_time ? new Date(providerSubscription.start_time).toISOString() : new Date().toISOString();
    const nextBilling = providerSubscription?.billing_info?.next_billing_time
      ? new Date(providerSubscription.billing_info.next_billing_time).toISOString()
      : null;

    // Founders Mentorship is a once-off purchase. Once paid, its entitlement is lifetime
    // and later subscription-state notifications must not revoke that lifetime access.
    if (isLifetimeMentorship && status !== "active") {
      const { data: existingLifetime } = await admin
        .from("product_licenses")
        .select("id")
        .eq("user_id", profile.id)
        .eq("entitlement_code", "founders_mentorship")
        .eq("status", "active")
        .maybeSingle();

      if (existingLifetime) {
        return NextResponse.json({
          received: true,
          product: product.code,
          entitlement: product.entitlement,
          status: "active",
          lifetime: true,
          subscriptionId,
        }, { status: 200 });
      }
    }

    const fallbackEnd = new Date(new Date(start).getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const accessEnd = isLifetimeMentorship && status === "active"
      ? null
      : status === "active"
        ? (nextBilling || fallbackEnd)
        : new Date().toISOString();

    await admin.from("product_licenses").upsert({ user_id: profile.id, email: profile.email, purchased_product_code: product.code, entitlement_code: product.entitlement, status: status === "active" ? "active" : status, payment_reference: subscriptionId, approved_at: status === "active" ? new Date().toISOString() : null, start_at: start, end_at: accessEnd, platform: product.entitlement === "automation" ? "mt5" : "web", source_payment_snapshot: { provider: "paypal", plan_id: planId, subscription_id: subscriptionId, product_code: product.code, amount: product.price, currency: "USD", event_type: eventType }, updated_at: new Date().toISOString() }, { onConflict: "payment_reference,entitlement_code" });
    await grantFeature(admin, profile.id, product.entitlement, start, accessEnd, status);

    if (product.entitlement === "automation") {
      const { data: existingAuto } = await admin.from("automated_trader_subscriptions").select("id").eq("provider", "paypal").eq("provider_subscription_id", subscriptionId).maybeSingle();
      const autoRow = { auth_user_id: authUserId, product_code: product.code, status, provider: "paypal", provider_subscription_id: subscriptionId, current_period_start: start, current_period_end: nextBilling, cancel_at_period_end: eventType === "BILLING.SUBSCRIPTION.CANCELLED", last_provider_event: eventType, updated_at: new Date().toISOString() };
      if (existingAuto) await admin.from("automated_trader_subscriptions").update(autoRow).eq("id", existingAuto.id);
      else await admin.from("automated_trader_subscriptions").insert(autoRow);
      await admin.from("automated_trader_events").insert({ auth_user_id: authUserId, event_type: eventType, provider: "paypal", provider_event_id: event.id ? String(event.id) : null, payload: event });
    }

    return NextResponse.json({ received: true, product: product.code, entitlement: product.entitlement, status, subscriptionId }, { status: 200 });
  } catch (error) {
    console.error("PayPal webhook error", error);
    return NextResponse.json({ error: "PayPal webhook processing failed." }, { status: 500 });
  }
}

export async function GET() { return NextResponse.json({ service: "VaultTrades PayPal webhook", status: "configured" }); }
