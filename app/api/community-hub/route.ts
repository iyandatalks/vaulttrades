import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const MEMBERSHIPS = ["nexus","vaulttrades_nexus","nexus_plus","vaulttrades_nexus_plus","vortex","vaulttrades_vortex"];
const POINTS: Record<string, number> = {
  introduced: 1, conversation_started: 2, needs_identified: 3,
  proposal_shared: 4, follow_up: 5, won: 8, not_proceeding: 0,
};

async function identity() {
  const auth = await createClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return { auth, user: null, profile: null, isAdmin: false, canPost: false };
  const db = createAdminClient();
  const { data: profile } = await db.from("users").select("id,role").eq("auth_user_id", user.id).maybeSingle();
  const isAdmin = profile?.role === "admin";
  let canPost = isAdmin;
  if (profile && !isAdmin) {
    const { data: licences } = await db.from("product_licenses").select("entitlement_code,start_at,end_at,status")
      .eq("user_id", profile.id).eq("status", "active").in("entitlement_code", MEMBERSHIPS);
    const now = Date.now();
    canPost = (licences ?? []).some(x => {
      const start = x.start_at ? new Date(x.start_at).getTime() : 0;
      const end = x.end_at ? new Date(x.end_at).getTime() : Number.POSITIVE_INFINITY;
      return start <= now && end > now;
    });
  }
  return { auth, user, profile, isAdmin, canPost };
}

export async function GET() {
  const db = createAdminClient();
  const who = await identity();
  const [{ data: announcements }, { data: posts }, { data: memberName }, { data: pendingPosts }, { data: pendingNames }] = await Promise.all([
    db.from("community_announcements").select("id,title,body,category,published_at,created_at")
      .eq("is_published", true).order("published_at", { ascending: false }).limit(20),
    db.from("community_discussion_posts").select("id,display_name,category,title,body,deal_stage,participation_points,is_featured,created_at")
      .eq("moderation_status", "approved").order("is_featured", { ascending: false }).order("created_at", { ascending: false }).limit(60),
    who.user ? db.from("community_member_names").select("display_name,is_approved").eq("auth_user_id", who.user.id).maybeSingle() : Promise.resolve({ data: null }),
    who.isAdmin ? db.from("community_discussion_posts").select("id,display_name,category,title,body,deal_stage,created_at").eq("moderation_status", "pending").order("created_at").limit(60) : Promise.resolve({ data: [] }),
    who.isAdmin ? db.from("community_member_names").select("auth_user_id,display_name,created_at").eq("is_approved", false).order("created_at").limit(60) : Promise.resolve({ data: [] }),
  ]);
  const scores = new Map<string, number>();
  for (const post of posts ?? []) {
    if (post.category === "new_business_deal") scores.set(post.display_name, (scores.get(post.display_name) ?? 0) + Number(post.participation_points || 0));
  }
  const leaderboard = [...scores.entries()].map(([display_name, points]) => ({ display_name, points }))
    .sort((a,b) => b.points - a.points || a.display_name.localeCompare(b.display_name)).slice(0,10);
  return NextResponse.json({
    announcements: announcements ?? [], posts: posts ?? [], leaderboard,
    memberName, canPost: who.canPost, signedIn: Boolean(who.user), isAdmin: who.isAdmin,
    pendingPosts: pendingPosts ?? [], pendingNames: pendingNames ?? [],
  });
}

export async function POST(request: Request) {
  const who = await identity();
  if (!who.user || !who.profile) return NextResponse.json({ error: "SIGN_IN_REQUIRED" }, { status: 401 });
  if (!who.canPost && !who.isAdmin) return NextResponse.json({ error: "ACTIVE_MEMBERSHIP_REQUIRED" }, { status: 403 });
  const db = createAdminClient();
  const body = await request.json().catch(() => ({}));
  const action = String(body.action ?? "");

  if (action === "set_name") {
    const displayName = String(body.displayName ?? "").trim().replace(/\s+/g, " ");
    if (!/^[A-Za-z0-9][A-Za-z0-9 ._-]{2,23}$/.test(displayName)) {
      return NextResponse.json({ error: "Choose a unique community name of 3–24 letters, numbers, spaces, dots, underscores or hyphens." }, { status: 400 });
    }
    const { data: conflict } = await db.from("community_member_names").select("auth_user_id")
      .ilike("display_name", displayName).neq("auth_user_id", who.user.id).maybeSingle();
    if (conflict) return NextResponse.json({ error: "That community name is already in use. Choose another." }, { status: 409 });
    const { data, error } = await db.from("community_member_names").upsert({
      auth_user_id: who.user.id, display_name: displayName, is_approved: false, updated_at: new Date().toISOString(),
    }, { onConflict: "auth_user_id" }).select("display_name,is_approved").single();
    if (error) return NextResponse.json({ error: "Unable to submit your community name for approval." }, { status: 500 });
    return NextResponse.json({ ok: true, memberName: data, message: "Community name submitted for admin approval. Your real name remains private." });
  }

  if (action === "create_post") {
    const title = String(body.title ?? "").trim().slice(0, 120);
    const content = String(body.body ?? "").trim().slice(0, 2500);
    const category = String(body.category ?? "general_discussion");
    const stage = String(body.dealStage ?? "");
    if (title.length < 4 || content.length < 20 || !["general_discussion","new_business_deal","trading_experience"].includes(category)) {
      return NextResponse.json({ error: "Enter a title, at least 20 characters of detail and a valid discussion category." }, { status: 400 });
    }
    if (category === "new_business_deal" && !Object.prototype.hasOwnProperty.call(POINTS, stage)) {
      return NextResponse.json({ error: "Choose the current stage of the business deal." }, { status: 400 });
    }
    const { data: name } = await db.from("community_member_names").select("display_name,is_approved")
      .eq("auth_user_id", who.user.id).maybeSingle();
    if (!name?.is_approved) return NextResponse.json({ error: "APPROVED_COMMUNITY_NAME_REQUIRED" }, { status: 403 });
    const { error } = await db.from("community_discussion_posts").insert({
      auth_user_id: who.user.id, display_name: name.display_name, category, title, body: content,
      deal_stage: category === "new_business_deal" ? stage : null,
      moderation_status: "pending", participation_points: 0,
    });
    if (error) return NextResponse.json({ error: "Unable to submit your post for review." }, { status: 500 });
    return NextResponse.json({ ok: true, message: "Your post has been submitted for community review." }, { status: 201 });
  }

  if (!who.isAdmin) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  if (action === "publish_announcement") {
    const title = String(body.title ?? "").trim().slice(0, 140);
    const content = String(body.body ?? "").trim().slice(0, 3000);
    const category = String(body.category ?? "announcement").slice(0, 40);
    if (title.length < 3 || content.length < 5) return NextResponse.json({ error: "Enter an announcement title and message." }, { status: 400 });
    const now = new Date().toISOString();
    const { data, error } = await db.from("community_announcements").insert({
      title, body: content, category, is_published: true, published_at: now, created_by: who.user.id,
    }).select("id,title,body,category,published_at,created_at").single();
    if (error) return NextResponse.json({ error: "Unable to publish this announcement." }, { status: 500 });
    return NextResponse.json({ ok: true, announcement: data }, { status: 201 });
  }

  if (action === "moderate_post") {
    const id = String(body.id ?? "");
    const status = String(body.status ?? "");
    if (!id || !["approved","rejected"].includes(status)) return NextResponse.json({ error: "Choose a post and moderation decision." }, { status: 400 });
    const { data: post } = await db.from("community_discussion_posts").select("category,deal_stage").eq("id", id).maybeSingle();
    if (!post) return NextResponse.json({ error: "Post not found." }, { status: 404 });
    const points = status === "approved" && post.category === "new_business_deal" ? (POINTS[post.deal_stage ?? ""] ?? 0) : 0;
    const { error } = await db.from("community_discussion_posts").update({
      moderation_status: status, approved_at: status === "approved" ? new Date().toISOString() : null,
      participation_points: points, updated_at: new Date().toISOString(),
    }).eq("id", id);
    if (error) return NextResponse.json({ error: "Unable to update post moderation." }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === "approve_name") {
    const authUserId = String(body.authUserId ?? "");
    if (!authUserId) return NextResponse.json({ error: "Member is required." }, { status: 400 });
    const { error } = await db.from("community_member_names").update({ is_approved: true, updated_at: new Date().toISOString() }).eq("auth_user_id", authUserId);
    if (error) return NextResponse.json({ error: "Unable to approve this community name." }, { status: 500 });
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "Unknown community action." }, { status: 400 });
}
