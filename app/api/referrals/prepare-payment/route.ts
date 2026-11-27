import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json({
    valid: false,
    error: "Referral discounts are no longer offered. Qualifying referrals receive a standard 20% commission instead."
  }, { status: 410 });
}
