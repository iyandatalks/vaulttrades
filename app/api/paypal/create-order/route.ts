import { NextResponse } from "next/server";
import { createClient } from "../../../../lib/supabase/server";
import { createAdminClient } from "../../../../lib/supabase/admin";
import { paypalRequest, paypalIsSandbox } from "../../../../lib/paypal";

export async function POST() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "You must be logged in before starting payment." }, { status: 401 });

    const admin = createAdminClient();
    const { data: profile, error: profileError } = await admin.from("users").select("id,email,role").eq("auth_user_id", user.id).maybeSingle();
    if (profileError || !profile) return NextResponse.json({ error: "VaultTrades profile was not found." }, { status: 400 });

    if (paypalIsSandbox() && profile.role !== "admin") {
      return NextResponse.json({ error: "The $1 PayPal sandbox test is restricted to the VaultTrades admin account." }, { status: 403 });
    }

    const amount = paypalIsSandbox() ? Number(process.env.PAYPAL_TEST_AMOUNT || "1.00") : 73.99;
    const currency = "USD";
    if (!Number.isFinite(amount) || amount <= 0) return NextResponse.json({ error: "Invalid PayPal test amount configuration." }, { status: 500 });

    const order = await paypalRequest("/v2/checkout/orders", {
      method: "POST",
      headers: { "PayPal-Request-Id": `vaulttrades-${user.id}-${Date.now()}` },
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [{ reference_id: `vaulttrades-${profile.id}`, custom_id: user.id, description: `VaultTrades membership test${paypalIsSandbox() ? " ($1 sandbox)" : ""}`, amount: { currency_code: currency, value: amount.toFixed(2) } }],
        application_context: {
          brand_name: "VaultTrades",
          user_action: "PAY_NOW",
          return_url: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/subscription/paypal/success`,
          cancel_url: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/subscription?paypal=cancelled`
        }
      })
    });

    await admin.from("payment_transactions").insert({ auth_user_id: user.id, user_id: profile.id, provider: "paypal", provider_order_id: order.id, amount, currency, status: "created", payment_method: "paypal", membership_months: 1 });
    const approve = order.links?.find((link: any) => link.rel === "approve")?.href;
    if (!approve) return NextResponse.json({ error: "PayPal did not return an approval URL." }, { status: 502 });
    return NextResponse.json({ orderId: order.id, approveUrl: approve, amount, currency, sandbox: paypalIsSandbox() });
  } catch (error) {
    console.error("PayPal create-order error", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to create PayPal order." }, { status: 500 });
  }
}
