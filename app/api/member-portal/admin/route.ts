import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const MEMBERSHIP_CODES = ["nexus","vaulttrades_nexus","nexus_plus","vaulttrades_nexus_plus","vortex","vaulttrades_vortex"];
const isHttps = (value: string) => {
  try { const url = new URL(value); return url.protocol === "https:"; } catch { return false; }
};

async function getAccess() {
  const auth = await createClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 }) } as const;
  const db = process.env.SUPABASE_SERVICE_ROLE_KEY ? createAdminClient() : auth;
  const { data: profile } = await db.from("users").select("id,role,email").eq("auth_user_id", user.id).maybeSingle();
  if (!profile) return { error: NextResponse.json({ error: "PROFILE_NOT_FOUND" }, { status: 404 }) } as const;
  return { user, profile, db } as const;
}

export async function GET(request: Request) {
  const access = await getAccess();
  if ("error" in access) return access.error;
  const { profile, db } = access;
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  if (profile.role !== "admin") return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const { data: setting } = await db.from("member_portal_settings").select("setting_value").eq("setting_key", "admin_whatsapp_number").maybeSingle();
  if (q.length < 3) return NextResponse.json({ users: [], requests: [], adminWhatsappNumber: setting?.setting_value ?? "27746653633", message: "Enter at least three characters of the member email." });
  const { data: users, error: userError } = await db.from("users")
    .select("id,email,first_name,last_name")
    .ilike("email", `%${q}%`)
    .order("email")
    .limit(15);
  if (userError) return NextResponse.json({ error: "Unable to search member accounts." }, { status: 500 });
  const ids = (users ?? []).map(row => row.id);
  const { data: requests, error: requestError } = ids.length
    ? await db.from("member_ea_licensing_requests")
        .select("id,user_id,member_email,broker_name,broker_server,mt5_login,product_code,status,submitted_at,license_resource_name,license_resource_url,license_generated_at")
        .in("user_id", ids)
        .order("submitted_at", { ascending: false })
    : { data: [], error: null };
  if (requestError) return NextResponse.json({ error: "Unable to load member licensing requests." }, { status: 500 });
  return NextResponse.json({ users: users ?? [], requests: requests ?? [], adminWhatsappNumber: setting?.setting_value ?? "27746653633" });
}

export async function POST(request: Request) {
  const access = await getAccess();
  if ("error" in access) return access.error;
  const { user, profile, db } = access;
  if (profile.role !== "admin") return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  const action = String(body.action ?? "");

  if (action === "knowledge_sections_save") {
    const submitted = Array.isArray(body.sections) ? body.sections : [];
    if (!submitted.length || submitted.length > 150) return NextResponse.json({ error: "The Knowledge Base must contain between 1 and 150 topics." }, { status: 400 });
    const { data: currentSetting } = await db.from("member_portal_settings").select("setting_value").eq("setting_key", "knowledge_base_sections").maybeSingle();
    let currentSections: any[] = [];
    try { currentSections = currentSetting?.setting_value ? JSON.parse(currentSetting.setting_value) : []; } catch { currentSections = []; }
    if (!Array.isArray(currentSections)) currentSections = [];
    const submittedIds = new Set(submitted.map((item: any) => String(item?.id ?? "")));
    // Never remove an existing topic from the structure. Admins can hide it instead.
    const raw = [...submitted, ...currentSections.filter(item => !submittedIds.has(String(item?.id ?? "")))];
    if (raw.length > 150) return NextResponse.json({ error: "The Knowledge Base cannot contain more than 150 topics." }, { status: 400 });
    const seen = new Set<string>();
    const sections = [];
    for (const item of raw) {
      const id = String(item?.id ?? "").trim();
      const label = String(item?.label ?? "").trim();
      const group = String(item?.group ?? "ADDITIONAL LEARNING").trim();
      const sortOrder = Number(item?.sortOrder);
      if (!/^[a-z0-9-]{2,48}$/.test(id) || seen.has(id) || label.length < 2 || label.length > 140 || group.length < 2 || group.length > 80 || !Number.isInteger(sortOrder) || sortOrder < 0 || sortOrder > 9999) {
        return NextResponse.json({ error: "Check topic IDs, titles, groups and sequence numbers. Each topic needs a unique ID and a valid non-negative order number." }, { status: 400 });
      }
      seen.add(id);
      sections.push({ id, label, group, sortOrder, isPublished: item?.isPublished !== false, ...(typeof item?.content === "string" ? { content: item.content.slice(0, 20000) } : {}), ...(item?.isCustom === true ? { isCustom: true } : {}) });
    }
    const { error } = await db.from("member_portal_settings").upsert({
      setting_key: "knowledge_base_sections", setting_value: JSON.stringify(sections), updated_by: user.id, updated_at: new Date().toISOString(),
    }, { onConflict: "setting_key" });
    if (error) return NextResponse.json({ error: "Unable to save the Knowledge Base structure." }, { status: 500 });
    return NextResponse.json({ ok: true, sections });
  }

  if (action === "resource_upsert") {
    const id = String(body.id ?? "").trim();
    const sectionId = String(body.sectionId ?? "").trim();
    const title = String(body.title ?? "").trim();
    const description = String(body.description ?? "").trim();
    const resourceKind = String(body.resourceKind ?? "External link").trim();
    const resourceUrl = String(body.resourceUrl ?? "").trim();
    const planCodes = Array.isArray(body.planCodes) ? body.planCodes.filter((v: unknown) => ["nexus","nexus_plus","vortex"].includes(String(v))) : [];
    if (!/^[a-z0-9-]{2,48}$/.test(sectionId) || title.length < 2 || title.length > 140 || !isHttps(resourceUrl)) {
      return NextResponse.json({ error: "Choose a valid topic, enter a resource name and provide a secure HTTPS link." }, { status: 400 });
    }
    const payload = { section_id: sectionId, title, description: description.slice(0,600), resource_kind: resourceKind.slice(0,80), resource_url: resourceUrl, plan_codes: planCodes, updated_at: new Date().toISOString() };
    const result = id
      ? await db.from("member_knowledge_resources").update(payload).eq("id", id).select("*").single()
      : await db.from("member_knowledge_resources").insert({ ...payload, created_by: user.id }).select("*").single();
    if (result.error) return NextResponse.json({ error: "Unable to save this resource link." }, { status: 500 });
    return NextResponse.json({ ok: true, resource: result.data });
  }

  if (action === "resource_delete") {
    const id = String(body.id ?? "").trim();
    if (!id) return NextResponse.json({ error: "Resource ID is required." }, { status: 400 });
    const { error } = await db.from("member_knowledge_resources").delete().eq("id", id);
    if (error) return NextResponse.json({ error: "Unable to remove this resource." }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === "event_upsert") {
    const id = String(body.id ?? "").trim();
    const title = String(body.title ?? "").trim();
    const description = String(body.description ?? "").trim();
    const meetingUrl = String(body.meetingUrl ?? "").trim();
    const startsAt = new Date(String(body.startsAt ?? ""));
    const endsAt = new Date(String(body.endsAt ?? ""));
    if (title.length < 3 || title.length > 140 || !isHttps(meetingUrl) || !Number.isFinite(startsAt.getTime()) || !Number.isFinite(endsAt.getTime()) || endsAt <= startsAt) {
      return NextResponse.json({ error: "Enter a meeting name, valid start/end times and a secure Google Meet or meeting URL." }, { status: 400 });
    }
    const payload = { title, description: description.slice(0,1000), meeting_url: meetingUrl, starts_at: startsAt.toISOString(), ends_at: endsAt.toISOString(), is_published: true, updated_at: new Date().toISOString() };
    const result = id
      ? await db.from("member_community_events").update(payload).eq("id", id).select("*").single()
      : await db.from("member_community_events").insert({ ...payload, created_by: user.id }).select("*").single();
    if (result.error) return NextResponse.json({ error: "Unable to save the community meeting." }, { status: 500 });
    return NextResponse.json({ ok: true, event: result.data });
  }

  if (action === "event_delete") {
    const id = String(body.id ?? "").trim();
    const { error } = await db.from("member_community_events").delete().eq("id", id);
    if (error) return NextResponse.json({ error: "Unable to remove this meeting." }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === "settings_update") {
    const raw = String(body.adminWhatsappNumber ?? "");
    const phone = raw.replace(/[^0-9]/g, "");
    if (phone.length < 10 || phone.length > 15) return NextResponse.json({ error: "Enter the WhatsApp number with country code, using 10–15 digits." }, { status: 400 });
    const { error } = await db.from("member_portal_settings").upsert({
      setting_key: "admin_whatsapp_number", setting_value: phone, updated_by: user.id, updated_at: new Date().toISOString(),
    }, { onConflict: "setting_key" });
    if (error) return NextResponse.json({ error: "Unable to save the admin WhatsApp number." }, { status: 500 });
    return NextResponse.json({ ok: true, adminWhatsappNumber: phone });
  }

  if (action === "license_assign") {
    const requestId = String(body.requestId ?? "").trim();
    const resourceName = String(body.resourceName ?? "").trim();
    const resourceUrl = String(body.resourceUrl ?? "").trim();
    if (!requestId || resourceName.length < 2 || resourceName.length > 140 || !isHttps(resourceUrl)) {
      return NextResponse.json({ error: "Enter a licence file name and a secure HTTPS link." }, { status: 400 });
    }
    const { data: assigned, error } = await db.from("member_ea_licensing_requests")
      .update({
        license_resource_name: resourceName,
        license_resource_url: resourceUrl,
        license_assigned_at: new Date().toISOString(),
        license_assigned_by: user.id,
        license_generated_at: new Date().toISOString(),
        status: "ready",
        reviewed_by: user.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", requestId)
      .select("id,user_id,auth_user_id,member_email,product_code,mt5_login,status,license_resource_name,license_resource_url")
      .single();
    if (error || !assigned) return NextResponse.json({ error: "Unable to assign this licence link." }, { status: 500 });
    await db.from("copy_profile_notifications").insert({
      auth_user_id: assigned.auth_user_id,
      title: "Your personalised EA is ready",
      body: `${assigned.license_resource_name} is now available in your Knowledge Base. Open the EA download section to access it.`,
      action_href: "/member-portal",
      notification_type: "ea_license_ready",
      created_by: user.id,
      metadata: { licensing_request_id: assigned.id, product_code: assigned.product_code },
    });
    await db.from("admin_inbox_notifications").insert({
      event_type: "member_ea_license_link_assigned",
      title: "EA licence link assigned",
      body: `A personalised EA link was assigned to ${assigned.member_email} (MT5 ${assigned.mt5_login}).`,
      severity: "normal",
      auth_user_id: assigned.auth_user_id,
      customer_email: assigned.member_email,
      related_id: assigned.id,
      action_href: "/admin/ea-licensing",
      metadata: { product_code: assigned.product_code, license_resource_name: resourceName },
    });
    return NextResponse.json({ ok: true, request: assigned });
  }

  return NextResponse.json({ error: "Unknown admin action." }, { status: 400 });
}
