import { NextResponse } from "next/server";
import { createClient } from "../../../../lib/supabase/server";
import { validateReferralDiscount } from "../../../../lib/referral-discount";
import { getPayPalProduct } from "../../../../lib/paypal-products";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "You must be logged in." }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const result = await validateReferralDiscount({
      userId: user.id,
      productCode: String(body?.productCode || ""),
      code: String(body?.code || "")
    });

    return NextResponse.json({ valid: true, discount: result });
  } catch (error) {
    return NextResponse.json({
      valid: false,
      error: error instanceof Error ? error.message : "Unable to validate the referral code."
    }, { status: 400 });
  }
}
