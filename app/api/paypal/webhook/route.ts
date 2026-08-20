import { NextResponse } from "next/server";

export async function POST(request: Request) {
  // PayPal will POST subscription lifecycle events here.
  // Verification and subscription-state updates will be enabled once
  // the PayPal REST credentials and persistent account store are configured.
  const rawBody = await request.text();

  if (!rawBody) {
    return NextResponse.json({ error: "Empty webhook body" }, { status: 400 });
  }

  return NextResponse.json({ received: true }, { status: 200 });
}

export async function GET() {
  return NextResponse.json({ service: "VaultTrades PayPal webhook", status: "ready" });
}
