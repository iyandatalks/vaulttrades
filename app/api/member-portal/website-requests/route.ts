import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const MEMBERSHIP_CODES = ["nexus", "vaulttrades_nexus", "nexus_plus", "vaulttrades_nexus_plus", "vortex", "vaulttrades_vortex"];

function isActive(row: any) {
  const now = Date.now();
  const start = row.start_at ? new Date(row.start_at).getTime() : 0;
  const end = row.end_at ? new Date(row.end_at).getTime() : Number.POSITIVE_INFINITY;
  return row.status === "active" && Number.isFinite(start) && start <= now && end > now;
}

export async function GET() {
  const auth = await createClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  const db = createAdminClient();
  const { data: profile } = await db.from("users").select("id").eq("auth_user_id", user.id).maybeSingle();
  if (!profile) return NextResponse.json({ error: "PROFILE_NOT_FOUND" }, { status: 404 });
  const { data, error } = await db.from("member_website_requests")
    .select("id,domain_preference,preferred_name_1,preferred_name_2,preferred_name_3,custom_domain,status,admin_notes,assigned_domain,submitted_at")
    .eq("user_id", profile.id)
    .order("submitted_at", { ascending: false });
  if (error) return NextResponse.json({ error: "REQUESTS_UNAVAILABLE" }, { status: 500 });
  return NextResponse.json({ requests: data ?? [] });
}

export async function POST(request: Request) {
  const auth = await createClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const domainPreference = String(body.domainPreference ?? "");
  const clean = (value: unknown) => String(value ?? "").trim().toLowerCase();
  const names = [clean(body.preferredName1), clean(body.preferredName2), clean(body.preferredName3)];
  const customDomain = clean(body.customDomain);
  const validName = (value: string) => /^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/.test(value);
  if (domainPreference === "vaulttrades_subdomain" && !names.every(validName)) {
    return NextResponse.json({ error: "Enter three subdomain choices using letters, numbers and hyphens only. Each name must be 3–30 characters." }, { status: 400 });
  }
  if (domainPreference === "custom_domain" && !/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(customDomain)) {
    return NextResponse.json({ error: "Enter a valid custom domain, such as yourname.com." }, { status: 400 });
  }
  if (!["vaulttrades_subdomain", "custom_domain"].includes(domainPreference)) {
    return NextResponse.json({ error: "Choose a website domain option." }, { status: 400 });
  }

  const db = createAdminClient();
  const { data: profile } = await db.from("users").select("id,email,role").eq("auth_user_id", user.id).maybeSingle();
  if (!profile) return NextResponse.json({ error: "PROFILE_NOT_FOUND" }, { status: 404 });
  if (profile.role !== "admin") {
    const { data: licenses } = await db.from("product_licenses").select("entitlement_code,status,start_at,end_at")
      .eq("user_id", profile.id).in("entitlement_code", MEMBERSHIP_CODES).eq("status", "active");
    if (!(licenses ?? []).some(isActive)) return NextResponse.json({ error: "An active VaultTrades membership is required." }, { status: 403 });
  }

  const payload = {
    user_id: profile.id,
    auth_user_id: user.id,
    member_email: profile.email ?? user.email ?? "",
    domain_preference: domainPreference,
    preferred_name_1: domainPreference === "vaulttrades_subdomain" ? names[0] : null,
    preferred_name_2: domainPreference === "vaulttrades_subdomain" ? names[1] : null,
    preferred_name_3: domainPreference === "vaulttrades_subdomain" ? names[2] : null,
    custom_domain: domainPreference === "custom_domain" ? customDomain : null,
  };

  const { data: created, error } = await db.from("member_website_requests").insert(payload)
    .select("id,domain_preference,preferred_name_1,preferred_name_2,preferred_name_3,custom_domain,status,submitted_at").single();
  if (error) {
    if (error.code === "23505") return NextResponse.json({ error: "You already have an open website setup request. Contact VaultTrades if you need to change it." }, { status: 409 });
    console.error("Website request insert failed:", error.message);
    return NextResponse.json({ error: "Unable to submit your website request." }, { status: 500 });
  }

  await db.from("admin_inbox_notifications").insert({
    event_type: "member_website_request_submitted",
    title: "New personal website request",
    body: `${profile.email ?? user.email ?? "A member"} submitted a personal website setup request.`,
    severity: "normal",
    auth_user_id: user.id,
    customer_email: profile.email ?? user.email ?? null,
    related_id: created.id,
    action_href: "/admin/website-requests",
    metadata: { domain_preference: domainPreference, preferred_names: names, custom_domain: customDomain || null },
  });

  return NextResponse.json({ ok: true, request: created, message: "Your website preferences have been submitted. VaultTrades will review availability and confirm the next steps before setup." }, { status: 201 });
}
