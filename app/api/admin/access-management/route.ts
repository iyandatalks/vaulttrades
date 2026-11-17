import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

async function requireAdmin() {
  const auth = await createClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return { response: NextResponse.json({ error: "Sign in required." }, { status: 401 }) };
  const db = createAdminClient();
  const { data: actor } = await db.from("users").select("id,role").eq("auth_user_id", user.id).maybeSingle();
  if (!actor || actor.role !== "admin") return { response: NextResponse.json({ error: "Administrator access required." }, { status: 403 }) };
  return { db, user, actor };
}

export async function GET(request: NextRequest) {
  const context = await requireAdmin();
  if ("response" in context) return context.response;
  const query = (request.nextUrl.searchParams.get("q") || "").trim().slice(0, 100);
  if (query.length < 2) return NextResponse.json({ members: [] });
  const safe = query.replace(/[,%()]/g, " ").trim();
  const { data: profiles, error } = await context.db.from("users")
    .select("id,auth_user_id,email,first_name,last_name,role")
    .not("auth_user_id", "is", null)
    .or(`email.ilike.%${safe}%,first_name.ilike.%${safe}%,last_name.ilike.%${safe}%`)
    .order("created_at", { ascending: false }).limit(30);
  if (error) return NextResponse.json({ error: "Member search is temporarily unavailable." }, { status: 500 });
  const ids = (profiles || []).map(row => row.auth_user_id).filter(Boolean);
  const [community, overrides] = ids.length ? await Promise.all([
    context.db.from("community_member_names").select("auth_user_id,display_name,is_approved").in("auth_user_id", ids),
    context.db.from("partner_portal_access_overrides").select("auth_user_id,decision,reason,updated_at").in("auth_user_id", ids),
  ]) : [{ data: [] as any[] }, { data: [] as any[] }];
  if (community.error || overrides.error) return NextResponse.json({ error: "Access status could not be loaded." }, { status: 500 });
  const communityById = new Map((community.data || []).map(row => [row.auth_user_id, row]));
  const overrideById = new Map((overrides.data || []).map(row => [row.auth_user_id, row]));
  return NextResponse.json({ members: (profiles || []).map(profile => ({
    ...profile,
    display_name: communityById.get(profile.auth_user_id)?.display_name || [profile.first_name, profile.last_name].filter(Boolean).join(" ") || profile.email,
    community_approved: communityById.get(profile.auth_user_id)?.is_approved === true,
    portal_override: overrideById.get(profile.auth_user_id)?.decision || "automatic",
    portal_override_reason: overrideById.get(profile.auth_user_id)?.reason || "",
  })) });
}

export async function POST(request: NextRequest) {
  const context = await requireAdmin();
  if ("response" in context) return context.response;
  const body = await request.json().catch(() => ({}));
  const action = typeof body.action === "string" ? body.action : "";
  const authUserId = typeof body.authUserId === "string" ? body.authUserId : "";
  const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 500) : "";
  const now = new Date().toISOString();

  if (action === "invite_partner") {
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
    const { data, error } = await context.db.auth.admin.inviteUserByEmail(email, {
      data: { vaulttrades_partner_invitation: true },
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || "https://vaulttradesve.com"}/auth/callback?next=/member-portal`,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    await context.db.from("admin_access_management_audit").insert({
      target_auth_user_id: data.user?.id || null, action: "invite_partner",
      details: { email }, performed_by: context.user.id,
    });
    return NextResponse.json({ ok: true, message: "Partner invitation sent. Once the person completes registration, search for their account here and select Register Partner." });
  }

  if (!authUserId) return NextResponse.json({ error: "Select a registered account first." }, { status: 400 });
  const { data: target, error: targetError } = await context.db.from("users")
    .select("id,auth_user_id,email,first_name,last_name,role")
    .eq("auth_user_id", authUserId).maybeSingle();
  if (targetError || !target) return NextResponse.json({ error: "The selected VaultTrades account could not be found." }, { status: 404 });
  if (target.role === "admin" && action === "register_partner") return NextResponse.json({ error: "An administrator account cannot be changed into a partner account." }, { status: 400 });

  if (action === "assign_membership_plan") {
    const planCode = typeof body.planCode === "string" ? body.planCode : "";
    const plans = {
      nexus: { name: "VaultTrades Nexus", productCode: "vaulttrades_nexus_once" },
      nexus_plus: { name: "VaultTrades Nexus Plus", productCode: "vaulttrades_nexus_plus_once" },
      vortex: { name: "VaultTrades Vortex", productCode: "vaulttrades_vortex_once" },
    } as const;
    if (!(planCode in plans)) return NextResponse.json({ error: "Choose Nexus, Nexus Plus or Vortex." }, { status: 400 });
    const plan = plans[planCode as keyof typeof plans];
    const { data: previous, error: previousError } = await context.db.from("product_licenses")
      .select("id").eq("user_id", target.id)
      .in("entitlement_code", ["nexus", "vaulttrades_nexus", "nexus_plus", "vaulttrades_nexus_plus", "vortex", "vaulttrades_vortex"])
      .eq("status", "active").contains("source_payment_snapshot", { source: "admin_manual_grant" });
    if (previousError) return NextResponse.json({ error: "Existing manual plan access could not be checked." }, { status: 500 });
    if (previous?.length) {
      const { error } = await context.db.from("product_licenses").update({
        status: "revoked", end_at: now, approved_by: context.user.id, updated_at: now,
      }).in("id", previous.map(row => row.id));
      if (error) return NextResponse.json({ error: "The previous manually assigned plan could not be replaced." }, { status: 500 });
    }
    const { error: insertError } = await context.db.from("product_licenses").insert({
      user_id: target.id, email: target.email,
      purchased_product_code: plan.productCode, entitlement_code: planCode, status: "active",
      payment_reference: `admin-plan:${context.user.id}:${crypto.randomUUID()}`,
      approved_at: now, approved_by: context.user.id, start_at: now, end_at: null, platform: "web",
      source_payment_snapshot: { source: "admin_manual_grant", granted_by: context.user.id, membership_plan: planCode, plan_name: plan.name, reason },
      updated_at: now,
    });
    if (insertError) return NextResponse.json({ error: "The membership plan could not be assigned.", details: insertError.message }, { status: 500 });
    await context.db.from("admin_access_management_audit").insert({
      target_auth_user_id: authUserId, action: "assign_membership_plan",
      details: { planCode, planName: plan.name, replacedManualAssignments: previous?.length ?? 0, reason }, performed_by: context.user.id,
    });
    return NextResponse.json({ ok: true, message: `${plan.name} assigned to ${target.email}. Separate monthly tool subscriptions and Partner Portal approval remain independent.` });
  }

  if (action === "community_access") {
    const displayName = (typeof body.displayName === "string" ? body.displayName.trim() : "").slice(0, 48)
      || [target.first_name, target.last_name].filter(Boolean).join(" ") || target.email;
    if (displayName.length < 2) return NextResponse.json({ error: "A Community display name is required." }, { status: 400 });
    const approved = body.approved === true;
    const { error } = await context.db.from("community_member_names").upsert({
      auth_user_id: authUserId, display_name: displayName, is_approved: approved,
      updated_at: now,
    }, { onConflict: "auth_user_id" });
    if (error) return NextResponse.json({ error: "Community access could not be updated." }, { status: 500 });
    await context.db.from("admin_access_management_audit").insert({
      target_auth_user_id: authUserId, action: approved ? "community_grant" : "community_revoke",
      details: { displayName, reason }, performed_by: context.user.id,
    });
    return NextResponse.json({ ok: true, message: approved ? "Community access granted." : "Community access revoked." });
  }

  if (action === "portal_override") {
    const decision = body.decision;
    if (!["grant", "revoke", "automatic"].includes(decision)) return NextResponse.json({ error: "Choose grant, revoke, or return to automatic access." }, { status: 400 });
    if (decision === "automatic") {
      const { error } = await context.db.from("partner_portal_access_overrides").delete().eq("auth_user_id", authUserId);
      if (error) return NextResponse.json({ error: "The automatic access setting could not be restored." }, { status: 500 });
    } else {
      const { error } = await context.db.from("partner_portal_access_overrides").upsert({
        auth_user_id: authUserId, decision, reason, updated_by: context.user.id,
        updated_at: now,
      }, { onConflict: "auth_user_id" });
      if (error) return NextResponse.json({ error: "The Portal access override could not be saved." }, { status: 500 });
    }
    await context.db.from("admin_access_management_audit").insert({
      target_auth_user_id: authUserId, action: `partner_portal_${decision}`,
      details: { reason }, performed_by: context.user.id,
    });
    return NextResponse.json({ ok: true, message: decision === "automatic" ? "Portal access returned to automatic eligibility." : decision === "grant" ? "Partner Portal access manually granted." : "Partner Portal access manually revoked." });
  }

  if (action === "register_partner") {
    if (["admin"].includes(String(target.role || "").toLowerCase())) return NextResponse.json({ error: "Administrator accounts cannot be registered as partners." }, { status: 400 });
    const { error } = await context.db.from("users").update({ role: "partner" }).eq("auth_user_id", authUserId);
    if (error) return NextResponse.json({ error: "The partner role could not be assigned." }, { status: 500 });
    await context.db.from("admin_access_management_audit").insert({
      target_auth_user_id: authUserId, action: "register_partner",
      details: { previousRole: target.role || null, reason }, performed_by: context.user.id,
    });
    return NextResponse.json({ ok: true, message: "Partner role registered. This does not grant administrator rights or bypass payment/plan eligibility." });
  }

  return NextResponse.json({ error: "Unknown access-management action." }, { status: 400 });
}
