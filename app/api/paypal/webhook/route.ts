import { NextResponse } from "next/server";
import { createAdminClient } from "../../../../lib/supabase/admin";

const PAYPAL_LIVE = "https://api-m.paypal.com";
const PAYPAL_SANDBOX = "https://api-m.sandbox.paypal.com";

async function getAccessToken(baseUrl: string) {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("PayPal credentials are not configured");
  const response = await fetch(`${baseUrl}/v1/oauth2/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`PayPal OAuth failed: ${response.status}`);
  const data = await response.json();
  return data.access_token as string;
}

async function verifyWithPayPal(request: Request, event: unknown, baseUrl: string) {
  const headers = request.headers;
  const transmissionId = headers.get("paypal-transmission-id");
  const transmissionTime = headers.get("paypal-transmission-time");
  const transmissionSig = headers.get("paypal-transmission-sig");
  const certUrl = headers.get("paypal-cert-url");
  const authAlgo = headers.get("paypal-auth-algo");
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;
  if (!transmissionId || !transmissionTime || !transmissionSig || !certUrl || !authAlgo || !webhookId) return false;

  const token = await getAccessToken(baseUrl);
  const response = await fetch(`${baseUrl}/v1/notifications/verify-webhook-signature`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ auth_algo: authAlgo, cert_url: certUrl, transmission_id: transmissionId, transmission_sig: transmissionSig, transmission_time: transmissionTime, webhook_id: webhookId, webhook_event: event }),
    cache: "no-store",
  });
  if (!response.ok) return false;
  const data = await response.json();
  return data.verification_status === "SUCCESS";
}

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    if (!rawBody) return NextResponse.json({ error: "Empty webhook body" }, { status: 400 });
    const event = JSON.parse(rawBody) as { id?: string; event_type?: string; resource?: Record<string, unknown> };
    const baseUrl = process.env.PAYPAL_ENV === "sandbox" ? PAYPAL_SANDBOX : PAYPAL_LIVE;
    if (!(await verifyWithPayPal(request, event, baseUrl))) return NextResponse.json({ error: "Invalid PayPal webhook signature" }, { status: 400 });
    if (!event.id || !event.event_type) return NextResponse.json({ error: "Invalid PayPal event" }, { status: 400 });

    const admin = createAdminClient();
    const { data: existing } = await admin.from("webhook_events").select("id").eq("provider", "paypal").eq("event_id", event.id).maybeSingle();
    if (existing) return NextResponse.json({ received: true, duplicate: true });

    const resource = event.resource ?? {};
    const subscriptionId = String(resource.id ?? resource.billing_agreement_id ?? "");
    let userId = typeof resource.custom_id === "string" ? resource.custom_id : null;

    if (!userId && subscriptionId) {
      const { data: subscription } = await admin.from("subscriptions").select("user_id").eq("provider", "paypal").eq("provider_subscription_id", subscriptionId).maybeSingle();
      userId = subscription?.user_id ?? null;
    }

    if (userId) {
      const activeEvents = new Set(["BILLING.SUBSCRIPTION.ACTIVATED", "PAYMENT.SALE.COMPLETED"]);
      const failedEvents = new Set(["BILLING.SUBSCRIPTION.PAYMENT.FAILED"]);
      const inactiveEvents = new Set(["BILLING.SUBSCRIPTION.CANCELLED", "BILLING.SUBSCRIPTION.EXPIRED", "BILLING.SUBSCRIPTION.SUSPENDED", "PAYMENT.SALE.REVERSED", "PAYMENT.SALE.REFUNDED"]);
      let status: string | null = null;
      if (activeEvents.has(event.event_type)) status = "active";
      if (failedEvents.has(event.event_type)) status = "failed";
      if (inactiveEvents.has(event.event_type)) status = event.event_type.includes("SUSPENDED") ? "suspended" : event.event_type.includes("EXPIRED") ? "expired" : "cancelled";
      if (status) {
        const update = { status, updated_at: new Date().toISOString() };
        const query = admin.from("subscriptions").update(update).eq("user_id", userId).eq("provider", "paypal");
        if (subscriptionId) query.eq("provider_subscription_id", subscriptionId);
        await query;
      }
    }

    await admin.from("webhook_events").insert({ provider: "paypal", event_id: event.id, event_type: event.event_type });
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("PayPal webhook processing failed", error);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ service: "VaultTrades PayPal webhook", status: "ready" });
}
