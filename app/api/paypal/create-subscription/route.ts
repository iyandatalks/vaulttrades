import { NextResponse } from "next/server";
import { createClient } from "../../../../lib/supabase/server";
import { createAdminClient } from "../../../../lib/supabase/admin";

const PAYPAL_LIVE = "https://api-m.paypal.com";
const PAYPAL_SANDBOX = "https://api-m.sandbox.paypal.com";

async function getAccessToken(baseUrl: string) {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("PayPal credentials are not configured");

  const response = await fetch(`${baseUrl}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
    cache: "no-store",
  });

  if (!response.ok) throw new Error(`PayPal OAuth failed: ${response.status}`);
  const data = await response.json();
  return data.access_token as string;
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

    const { data: profile } = await supabase
      .from("profiles")
      .select("first_name,last_name,email")
      .eq("id", user.id)
      .maybeSingle();

    if (!profile) return NextResponse.json({ error: "VaultTrades profile not found" }, { status: 400 });

    const planId = process.env.PAYPAL_PLAN_ID;
    if (!planId) return NextResponse.json({ error: "PayPal plan is not configured" }, { status: 503 });

    const baseUrl = process.env.PAYPAL_ENV === "sandbox" ? PAYPAL_SANDBOX : PAYPAL_LIVE;
    const token = await getAccessToken(baseUrl);
    const origin = new URL(request.url).origin;

    const paypalResponse = await fetch(`${baseUrl}/v1/billing/subscriptions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "PayPal-Request-Id": crypto.randomUUID(),
      },
      body: JSON.stringify({
        plan_id: planId,
        custom_id: user.id,
        subscriber: {
          name: { given_name: profile.first_name, surname: profile.last_name },
          email_address: profile.email,
        },
        application_context: {
          brand_name: "VaultTrades",
          locale: "en-US",
          user_action: "SUBSCRIBE_NOW",
          return_url: `${origin}/subscription?provider=paypal&result=success`,
          cancel_url: `${origin}/subscription?provider=paypal&result=cancelled`,
        },
      }),
      cache: "no-store",
    });

    const data = await paypalResponse.json();
    if (!paypalResponse.ok) {
      return NextResponse.json({ error: data?.message ?? "Unable to create PayPal subscription" }, { status: 502 });
    }

    const approvalUrl = data.links?.find((link: { rel: string }) => link.rel === "approve")?.href;
    if (!approvalUrl) return NextResponse.json({ error: "PayPal did not return an approval URL" }, { status: 502 });

    const admin = createAdminClient();
    const { error: insertError } = await admin.from("subscriptions").insert({
      user_id: user.id,
      provider: "paypal",
      provider_subscription_id: data.id,
      status: "pending",
      amount: 73.99,
      currency: "USD",
    });

    if (insertError) return NextResponse.json({ error: "Subscription record could not be created" }, { status: 500 });

    return NextResponse.json({ approvalUrl });
  } catch (error) {
    console.error("PayPal subscription creation failed", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "PayPal setup failed" }, { status: 500 });
  }
}
