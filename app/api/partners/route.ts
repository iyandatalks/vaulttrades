import { NextResponse } from "next/server";
import { createAdminClient } from "../../../lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.from("partners")
      .select("id,name,category,referral_code,referral_url,cta_text,description,sort_order")
      .eq("is_published", true).order("sort_order").order("name");
    if (error) throw error;
    return NextResponse.json({ partners: data ?? [] }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json({ partners: [], error: "Partner directory is temporarily unavailable." }, { status: 503 });
  }
}
