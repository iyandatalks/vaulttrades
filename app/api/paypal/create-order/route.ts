import { NextResponse } from "next/server";
import { createClient } from "../../../../lib/supabase/server";
import { createAdminClient } from "../../../../lib/supabase/admin";
import { paypalRequest } from "../../../../lib/paypal";
import { getPayPalProduct } from "../../../../lib/paypal-products";

const BASE_URL = "https://vaulttradesve.com";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "You must be logged in before starting payment." }, { status: 401 });

    const body = await request.json().catch(() => ({}));

    if (body?.orderType === "reseller_setup") {
      const declarationId = String(body.declarationId ?? "").trim();
      if (!declarationId) return NextResponse.json({ error: "A reseller purchase declaration is required." }, { status: 400 });
      const admin = createAdminClient();
      const { data: profile } = await admin.from("users").select("id,email").eq("auth_user_id", user.id).maybeSingle();
      if (!profile) return NextResponse.json({ error: "VaultTrades profile was not found." }, { status: 400 });

      const { data: declaration } = await admin.from("reseller_purchase_orders")
        .select("id,customer_user_id,customer_auth_user_id,plan_code,reseller_code,vaulttrades_payment_status")
        .eq("id", declarationId).eq("customer_auth_user_id", user.id).maybeSingle();
      if (!declaration || declaration.customer_user_id !== profile.id) {
        return NextResponse.json({ error: "The reseller purchase declaration could not be verified." }, { status: 404 });
      }
      if (declaration.vaulttrades_payment_status === "verified") {
        return NextResponse.json({ error: "VaultTrades has already verified the setup payment for this declaration." }, { status: 409 });
      }
      const eaFees: Record<string, number> = { nexus: 30, nexus_plus: 50, vortex: 110 };
      const eaSetupFee = eaFees[declaration.plan_code];
      if (!eaSetupFee) return NextResponse.json({ error: "Invalid membership product." }, { status: 400 });
      const websiteSetupFee = 39;
      const total = Number((eaSetupFee + websiteSetupFee).toFixed(2));
      const returnUrl = `${BASE_URL}/membership/checkout?plan=${encodeURIComponent(declaration.plan_code)}&ref=${encodeURIComponent(declaration.reseller_code)}&declaration=${encodeURIComponent(declaration.id)}`;
      const paypalOrder = await paypalRequest("/v2/checkout/orders", {
        method: "POST",
        headers: { "PayPal-Request-Id": `vt-reseller-setup-${declaration.id}` },
        body: JSON.stringify({
          intent: "CAPTURE",
          purchase_units: [{
            reference_id: declaration.id,
            custom_id: declaration.id,
            invoice_id: `VT-SETUP-${declaration.id}`,
            description: `VaultTrades website setup and EA setup - ${declaration.plan_code}`,
            amount: { currency_code: "USD", value: total.toFixed(2) },
          }],
          application_context: {
            brand_name: "VaultTrades",
            user_action: "PAY_NOW",
            shipping_preference: "NO_SHIPPING",
            return_url: returnUrl,
            cancel_url: `${returnUrl}&payment=cancelled`,
          },
        }),
      });
      const approveUrl = paypalOrder.links?.find((link: any) => link.rel === "approve")?.href;
      if (!approveUrl || !paypalOrder.id) return NextResponse.json({ error: "PayPal did not return a valid checkout approval URL." }, { status: 502 });

      const { data: existingTransaction } = await admin.from("payment_transactions")
        .select("id")
        .eq("provider", "paypal")
        .eq("provider_order_id", String(paypalOrder.id))
        .maybeSingle();
      let transaction = existingTransaction;
      if (!transaction) {
        const { data: insertedTransaction, error: transactionError } = await admin.from("payment_transactions").insert({
          auth_user_id: user.id,
          user_id: profile.id,
          provider: "paypal",
          provider_order_id: String(paypalOrder.id),
          amount: total,
          currency: "USD",
          status: "created",
          payment_method: "paypal_reseller_setup",
          membership_months: 1,
          raw_event: {
            order_type: "reseller_setup",
            declaration_id: declaration.id,
            plan_code: declaration.plan_code,
            website_setup_fee: websiteSetupFee,
            ea_setup_fee: eaSetupFee,
            reseller_mrr_amount: declaration.plan_code === "nexus" ? 120 : declaration.plan_code === "nexus_plus" ? 200 : 440,
          },
        }).select("id").single();
        if (transactionError || !insertedTransaction) {
          console.error("Unable to save reseller setup PayPal order", transactionError);
          return NextResponse.json({ error: "Unable to record the VaultTrades checkout. Please contact support before paying again." }, { status: 500 });
        }
        transaction = insertedTransaction;
      }
      await admin.from("reseller_purchase_orders").update({
        vaulttrades_payment_transaction_id: transaction.id,
        updated_at: new Date().toISOString(),
      }).eq("id", declaration.id).eq("customer_auth_user_id", user.id);

      return NextResponse.json({
        orderId: paypalOrder.id,
        approveUrl,
        amount: total,
        breakdown: { websiteSetupFee, eaSetupFee },
        declarationId: declaration.id,
      });
    }

    const productCode = String(body?.productCode || "analyzer_monthly");
    const product = getPayPalProduct(productCode);
    if (!product) return NextResponse.json({ error: "Invalid VaultTrades product." }, { status: 400 });
    if (product.billingMode === "once_off") {
      return NextResponse.json({ error: "This product uses its PayPal one-off payment link." }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: profile, error: profileError } = await admin.from("users").select("id,email").eq("auth_user_id", user.id).maybeSingle();
    if (profileError || !profile) return NextResponse.json({ error: "VaultTrades profile was not found." }, { status: 400 });

    const result = await paypalRequest("/v1/billing/subscriptions", {
      method: "POST",
      headers: { "PayPal-Request-Id": `vaulttrades-${product.code}-${user.id}-${Date.now()}` },
      body: JSON.stringify({
        plan_id: product.planId,
        custom_id: user.id,
        application_context: {
          brand_name: "VaultTrades",
          user_action: "SUBSCRIBE_NOW",
          return_url: `${BASE_URL}${product.returnPath}`,
          cancel_url: `${BASE_URL}/subscription?product=${encodeURIComponent(product.code)}&payment=cancelled`,
        },
      }),
    });

    const approve = result.links?.find((link: any) => link.rel === "approve")?.href;
    if (!approve) return NextResponse.json({ error: "PayPal did not return an approval URL." }, { status: 502 });

    const now = new Date();
    const end = new Date(now);
    end.setMonth(end.getMonth() + 1);
    const { error: licenseError } = await admin.from("product_licenses").upsert({
      user_id: profile.id,
      email: profile.email,
      purchased_product_code: product.code,
      entitlement_code: product.entitlement,
      status: "pending",
      payment_reference: String(result.id),
      start_at: now.toISOString(),
      end_at: end.toISOString(),
      platform: product.entitlement === "copy_trading" ? "mt5" : "web",
      source_payment_snapshot: { provider: "paypal", plan_id: product.planId, subscription_id: String(result.id), product_code: product.code, amount: product.price, currency: "USD" },
      updated_at: now.toISOString(),
    }, { onConflict: "payment_reference,entitlement_code" });
    if (licenseError) {
      console.error("Unable to create pending VaultTrades product license", licenseError);
      return NextResponse.json({ error: "Unable to prepare your VaultTrades subscription." }, { status: 500 });
    }

    return NextResponse.json({ subscriptionId: result.id, approveUrl: approve, product: { code: product.code, name: product.name, price: product.price, entitlement: product.entitlement } });
  } catch (error) {
    console.error("PayPal create-subscription error", error);
    return NextResponse.json({ error: "Unable to start PayPal subscription." }, { status: 500 });
  }
}
