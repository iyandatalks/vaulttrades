import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

async function authorize() {
  const session = await createClient();
  const { data: { user } } = await session.auth.getUser();
  if (!user) return { response: NextResponse.json({ error: "Sign in required." }, { status: 401 }) };
  const db = createAdminClient();
  const { data: profile, error } = await db.from("users").select("role").eq("auth_user_id", user.id).maybeSingle();
  if (error || profile?.role !== "admin") return { response: NextResponse.json({ error: "Administrator access required." }, { status: 403 }) };
  return { db, user };
}

export async function GET() {
  const auth = await authorize();
  if ("response" in auth) return auth.response;
  const [{ data: requests, error: requestError }, { data: users, error: usersError }] = await Promise.all([
    auth.db.from("member_website_requests").select("id,user_id,auth_user_id,member_email,domain_preference,preferred_name_1,preferred_name_2,preferred_name_3,custom_domain,status,admin_notes,assigned_domain,partner_paypal_nexus_url,partner_paypal_nexus_plus_url,partner_paypal_vortex_url,general_contact_whatsapp,submitted_at,updated_at").order("submitted_at", { ascending: false }),
    auth.db.from("users").select("id,auth_user_id,email,first_name,last_name,referral_code,is_active,role").not("auth_user_id", "is", null).not("referral_code", "is", null).order("created_at", { ascending: false }),
  ]);
  if (requestError || usersError) return NextResponse.json({ error: "Could not load partner website records." }, { status: 500 });
  return NextResponse.json({ requests: requests ?? [], users: (users ?? []).filter(u => u.is_active === true) }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const auth = await authorize();
  if ("response" in auth) return auth.response;
  let body: any;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request body." }, { status: 400 }); }
  const profileId = typeof body.profileId === "string" ? body.profileId : "";
  const rawDomain = typeof body.domain === "string" ? body.domain.trim().toLowerCase() : "";
  const domain = rawDomain.includes("://") ? rawDomain.split("://").pop()!.split("/")[0] : rawDomain.split("/")[0];
  const requestId = typeof body.requestId === "string" ? body.requestId : "";
  const notes = typeof body.adminNotes === "string" ? body.adminNotes.trim().slice(0, 2000) : null;
  const generalContactWhatsApp = typeof body.generalContactWhatsApp === "string" ? body.generalContactWhatsApp.trim() : "";
  const validDomain = domain.endsWith(".vaulttradesve.com") && domain.split(".").length === 3 && /^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/.test(domain.split(".")[0]);
  if (!profileId || !validDomain || domain === "www.vaulttradesve.com") {
    return NextResponse.json({ error: "Choose a partner and enter a valid partner subdomain, such as partner.vaulttradesve.com." }, { status: 400 });
  }
  const contactDigits = generalContactWhatsApp.replace(/\D/g, "");
  if (contactDigits.length < 7 || contactDigits.length > 18) return NextResponse.json({ error: "Enter the website owner’s public WhatsApp Business number (7–18 digits)." }, { status: 400 });
  const { data: partner, error: partnerError } = await auth.db.from("users").select("id,auth_user_id,email,referral_code,is_active,role").eq("id", profileId).maybeSingle();
  if (partnerError || !partner?.auth_user_id || !partner.referral_code || partner.is_active === false) {
    return NextResponse.json({ error: "The selected account is not an eligible active partner profile with a referral code." }, { status: 400 });
  }
  const { data: conflict } = await auth.db.from("member_website_requests").select("id,member_email").ilike("assigned_domain", domain).maybeSingle();
  if (conflict && conflict.id !== requestId) return NextResponse.json({ error: "That domain is already assigned. Unassign it from the existing record before reusing it." }, { status: 409 });

  const now = new Date().toISOString();
  const values = {
    user_id: partner.id, auth_user_id: partner.auth_user_id, member_email: partner.email,
    domain_preference: "vaulttrades_subdomain", custom_domain: null, assigned_domain: domain, general_contact_whatsapp: generalContactWhatsApp,
    preferred_name_1: domain.split(".")[0].slice(0, 30), preferred_name_2: domain.split(".")[0].slice(0, 24) + "-alt", preferred_name_3: domain.split(".")[0].slice(0, 23) + "-site",
    status: "ready", admin_notes: notes, reviewed_by: auth.user.id, updated_at: now,
  };
  let saved;
  let saveError;
  if (requestId) {
    const result = await auth.db.from("member_website_requests").update(values).eq("id", requestId).select("id,assigned_domain,status,member_email,auth_user_id,user_id").maybeSingle();
    saved = result.data; saveError = result.error;
  } else {
    const { data: existing } = await auth.db.from("member_website_requests").select("id").eq("user_id", partner.id).maybeSingle();
    if (existing?.id) {
      const result = await auth.db.from("member_website_requests").update(values).eq("id", existing.id).select("id,assigned_domain,status,member_email,auth_user_id,user_id").maybeSingle();
      saved = result.data; saveError = result.error;
    } else {
      const result = await auth.db.from("member_website_requests").insert({ ...values, submitted_at: now }).select("id,assigned_domain,status,member_email,auth_user_id,user_id").single();
      saved = result.data; saveError = result.error;
    }
  }
  if (saveError || !saved) {
    console.error("Partner website assignment failed", saveError?.message);
    return NextResponse.json({ error: "The website assignment could not be saved. Check the website request table constraints." }, { status: 500 });
  }
  return NextResponse.json({ ok: true, assignment: saved });
}

export async function PATCH(request: Request) {
  const auth = await authorize();
  if ("response" in auth) return auth.response;
  let body: any;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request body." }, { status: 400 }); }
  if (typeof body.id !== "string" || (body.action !== "payment_links" && !["submitted", "in_progress", "ready", "rejected", "cancelled"].includes(body.status))) {
    return NextResponse.json({ error: "A valid request ID and status are required." }, { status: 400 });
  }
  if (body.action === "payment_links") {
    const links = body.paymentLinks && typeof body.paymentLinks === "object" ? body.paymentLinks : {};
    const fields = {
      partner_paypal_nexus_url: links.nexus,
      partner_paypal_nexus_plus_url: links.nexus_plus,
      partner_paypal_vortex_url: links.vortex,
    } as const;
    const updates: Record<string, string | null> = {};
    for (const [key, value] of Object.entries(fields)) {
      if (value === undefined) continue;
      const raw = typeof value === "string" ? value.trim() : "";
      if (!raw) { updates[key] = null; continue; }
      try {
        const url = new URL(raw);
        const host = url.hostname.toLowerCase();
        if (url.protocol !== "https:" || !(host === "paypal.com" || host.endsWith(".paypal.com") || host === "paypal.me")) {
          return NextResponse.json({ error: "Enter a valid HTTPS PayPal payment link for each plan." }, { status: 400 });
        }
        updates[key] = url.toString();
      } catch {
        return NextResponse.json({ error: "One of the PayPal payment links is not a valid URL." }, { status: 400 });
      }
    }
    if (!Object.keys(updates).length) return NextResponse.json({ error: "No payment links were supplied." }, { status: 400 });
    updates.updated_at = new Date().toISOString();
    const { data, error } = await auth.db.from("member_website_requests").update(updates).eq("id", body.id).select("id,assigned_domain,partner_paypal_nexus_url,partner_paypal_nexus_plus_url,partner_paypal_vortex_url").maybeSingle();
    if (error || !data) return NextResponse.json({ error: "Could not save partner payment links." }, { status: 500 });
    return NextResponse.json({ ok: true, paymentLinks: data });
  }
  const changes: Record<string, unknown> = { status: body.status, updated_at: new Date().toISOString(), reviewed_by: auth.user.id };
  if (body.status === "cancelled") changes.assigned_domain = null;
  const { data, error } = await auth.db.from("member_website_requests").update(changes).eq("id", body.id).select("id,status,assigned_domain").maybeSingle();
  if (error || !data) return NextResponse.json({ error: "Could not update the website assignment." }, { status: 500 });
  return NextResponse.json({ assignment: data });
}
