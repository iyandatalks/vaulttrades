import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const MEMBER_POST_TYPES = ["member_discussion", "new_business_deal"] as const;
const ADMIN_POST_TYPES = ["general_discussion", "opportunity"] as const;

async function getContext() {
  const auth = await createClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return { response: NextResponse.json({ error: "Sign in to access the community." }, { status: 401 }) };
  const db = createAdminClient();
  const { data: profile } = await db.from("users").select("id,role").eq("auth_user_id", user.id).maybeSingle();
  if (!profile) return { response: NextResponse.json({ error: "Your VaultTrades profile could not be found." }, { status: 404 }) };
  const { data: member } = await db.from("community_member_names")
    .select("auth_user_id,display_name,is_approved").eq("auth_user_id", user.id).maybeSingle();
  return { db, user, profile, member, isAdmin: profile.role === "admin" };
}

function fail(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET() {
  const context = await getContext();
  if ("response" in context) return context.response;
  const { db, user, member, isAdmin } = context;

  if (!isAdmin && !member?.is_approved) {
    return NextResponse.json({ member: member ?? null, approved: false, announcements: [], posts: [], comments: [], leaderboard: [], members: [], moderationQueue: [] });
  }

  const [announcementsResult, postsResult, commentsResult, membersResult, dealsResult] = await Promise.all([
    db.from("community_announcements").select("id,title,body,category,published_at,created_at")
      .eq("is_published", true).order("published_at", { ascending: false }).limit(40),
    db.from("community_discussion_posts")
      .select("id,auth_user_id,display_name,category,title,body,deal_stage,moderation_status,participation_points,is_featured,created_at,approved_at")
      .order("created_at", { ascending: false }).limit(120),
    db.from("community_comments")
      .select("id,post_id,auth_user_id,display_name,body,moderation_status,created_at")
      .eq("moderation_status", "approved").order("created_at", { ascending: true }).limit(400),
    db.from("community_member_names").select("auth_user_id,display_name,is_approved,created_at")
      .eq("is_approved", true).order("display_name", { ascending: true }).limit(250),
    db.from("community_discussion_posts").select("auth_user_id,display_name,deal_stage")
      .eq("category", "new_business_deal").eq("moderation_status", "approved"),
  ]);

  for (const result of [announcementsResult, postsResult, commentsResult, membersResult, dealsResult]) {
    if (result.error) {
      console.error("Community workspace read failed:", result.error.message);
      return fail("The community workspace could not be loaded. Please try again.", 500);
    }
  }

  const visiblePosts = (postsResult.data ?? []).filter(post =>
    post.moderation_status === "approved" || post.auth_user_id === user.id || isAdmin
  );
  const leaderboardMap = new Map<string, { auth_user_id: string; display_name: string; verified_deals: number }>();
  for (const deal of dealsResult.data ?? []) {
    if (deal.deal_stage !== "converted") continue;
    const existing = leaderboardMap.get(deal.auth_user_id) ?? {
      auth_user_id: deal.auth_user_id, display_name: deal.display_name, verified_deals: 0,
    };
    existing.verified_deals += 1;
    leaderboardMap.set(deal.auth_user_id, existing);
  }
  const leaderboard = [...leaderboardMap.values()]
    .sort((a, b) => b.verified_deals - a.verified_deals || a.display_name.localeCompare(b.display_name))
    .map((row, index) => ({ rank: index + 1, display_name: row.display_name, verified_deals: row.verified_deals }));

  let moderationQueue: unknown[] = [];
  if (isAdmin) {
    moderationQueue = (postsResult.data ?? []).filter(post => post.moderation_status === "pending");
  }

  return NextResponse.json({
    member: member ?? null, approved: true, isAdmin,
    announcements: announcementsResult.data ?? [],
    posts: visiblePosts,
    comments: commentsResult.data ?? [],
    leaderboard,
    members: membersResult.data ?? [],
    moderationQueue,
  });
}

export async function POST(request: Request) {
  const context = await getContext();
  if ("response" in context) return context.response;
  const { db, user, profile, member, isAdmin } = context;
  const body = await request.json().catch(() => ({}));
  const action = typeof body.action === "string" ? body.action : "";

  if (action === "request_access") {
    const displayName = typeof body.displayName === "string" ? body.displayName.trim().slice(0, 48) : "";
    if (displayName.length < 2) return fail("Choose a display name with at least two characters.");
    const { error } = await db.from("community_member_names").upsert({
      auth_user_id: user.id, display_name: displayName,
      is_approved: isAdmin ? true : Boolean(member?.is_approved),
      updated_at: new Date().toISOString(),
    }, { onConflict: "auth_user_id" });
    if (error) return fail("Your community access request could not be saved.", 500);
    return NextResponse.json({ ok: true, message: isAdmin || member?.is_approved ? "Your display name has been updated." : "Your request has been sent for administrator approval." });
  }

  const approved = isAdmin || Boolean(member?.is_approved);
  if (!approved) return fail("Community access is awaiting administrator approval.", 403);

  if (action === "create_post") {
    const category = typeof body.category === "string" ? body.category : "";
    const title = typeof body.title === "string" ? body.title.trim().slice(0, 140) : "";
    const postBody = typeof body.body === "string" ? body.body.trim().slice(0, 5000) : "";
    if (!(MEMBER_POST_TYPES as readonly string[]).includes(category) && !(isAdmin && (ADMIN_POST_TYPES as readonly string[]).includes(category))) return fail("Choose a valid community post type.");
    if (!title || postBody.length < 5) return fail("Add a title and a little more detail before submitting.");
    const { error } = await db.from("community_discussion_posts").insert({
      auth_user_id: user.id, display_name: member?.display_name || "VaultTrades Admin",
      category, title, body: postBody, deal_stage: category === "new_business_deal" ? "new" : null,
      moderation_status: isAdmin ? "approved" : "pending",
      participation_points: 0, approved_at: isAdmin ? new Date().toISOString() : null,
    });
    if (error) return fail("Your post could not be submitted.", 500);
    return NextResponse.json({ ok: true, message: isAdmin ? "Community post published." : "Your post has been submitted for moderation." });
  }

  if (action === "create_comment") {
    const postId = typeof body.postId === "string" ? body.postId : "";
    const commentBody = typeof body.body === "string" ? body.body.trim().slice(0, 3000) : "";
    if (!postId || commentBody.length < 1) return fail("Write a comment before submitting.");
    const { data: post } = await db.from("community_discussion_posts").select("id,category,moderation_status").eq("id", postId).maybeSingle();
    if (!post || post.moderation_status !== "approved" || !["member_discussion", "new_business_deal"].includes(post.category)) return fail("This discussion is read-only or unavailable.", 403);
    const { error } = await db.from("community_comments").insert({
      post_id: postId, auth_user_id: user.id, display_name: member?.display_name || "VaultTrades Admin",
      body: commentBody, moderation_status: isAdmin ? "approved" : "pending",
    });
    if (error) return fail("Your comment could not be submitted.", 500);
    return NextResponse.json({ ok: true, message: isAdmin ? "Comment published." : "Your comment has been submitted for moderation." });
  }

  if (action === "admin_announcement") {
    if (!isAdmin) return fail("Administrator access required.", 403);
    const title = typeof body.title === "string" ? body.title.trim().slice(0, 140) : "";
    const announcementBody = typeof body.body === "string" ? body.body.trim().slice(0, 5000) : "";
    const category = typeof body.category === "string" ? body.category.slice(0, 50) : "announcement";
    if (!title || announcementBody.length < 5) return fail("Add an announcement title and message.");
    const { error } = await db.from("community_announcements").insert({
      title, body: announcementBody, category, is_published: true,
      published_at: new Date().toISOString(), created_by: user.id,
    });
    if (error) return fail("The announcement could not be published.", 500);
    return NextResponse.json({ ok: true, message: "Announcement published to the Community." });
  }

  if (action === "approve_member") {
    if (!isAdmin) return fail("Administrator access required.", 403);
    const authUserId = typeof body.authUserId === "string" ? body.authUserId : "";
    const displayName = typeof body.displayName === "string" ? body.displayName.trim().slice(0, 48) : "";
    const isApproved = body.approved === true;
    if (!authUserId || displayName.length < 2) return fail("Member record is incomplete.");
    const { error } = await db.from("community_member_names").update({
      display_name: displayName, is_approved: isApproved, updated_at: new Date().toISOString(),
    }).eq("auth_user_id", authUserId);
    if (error) return fail("Member access could not be updated.", 500);
    return NextResponse.json({ ok: true, message: isApproved ? "Member approved." : "Member access revoked." });
  }

  if (action === "moderate_post") {
    if (!isAdmin) return fail("Administrator access required.", 403);
    const id = typeof body.id === "string" ? body.id : "";
    const moderationStatus = body.approved === true ? "approved" : "rejected";
    const dealStage = typeof body.dealStage === "string" ? body.dealStage : "";
    const update: Record<string, unknown> = {
      moderation_status: moderationStatus,
      approved_at: moderationStatus === "approved" ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    };
    if (dealStage && ["new", "contacted", "qualified", "converted", "closed"].includes(dealStage)) update.deal_stage = dealStage;
    const { error } = await db.from("community_discussion_posts").update(update).eq("id", id);
    if (error) return fail("The post could not be moderated.", 500);
    return NextResponse.json({ ok: true, message: moderationStatus === "approved" ? "Post approved." : "Post rejected." });
  }

  return fail("Unknown community action.");
}
