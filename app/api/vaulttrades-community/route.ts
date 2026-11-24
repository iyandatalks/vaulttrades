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
  const isAdmin = profile.role === "admin";
  const { data: resellerLink } = await db.from("reseller_payment_links")
    .select("id").eq("auth_user_id", user.id).eq("is_active", true).limit(1).maybeSingle();
  const isPartner = ["partner", "reseller"].includes(String(profile.role || "").toLowerCase()) || Boolean(resellerLink);
  if (!isAdmin && !isPartner) {
    const { data: featureAccess } = await db.rpc("has_feature_access", {
      p_auth_user_id: user.id, p_feature_code: "community",
    });
    let allowed = featureAccess === true;
    if (!allowed) {
      const { data: licences } = await db.from("product_licenses")
        .select("entitlement_code,status,start_at,end_at")
        .eq("user_id", profile.id).eq("status", "active")
        .in("entitlement_code", ["community", "vaulttrades_community", "founders_mentorship"]);
      const now = Date.now();
      allowed = (licences ?? []).some(row => {
        const start = row.start_at ? new Date(row.start_at).getTime() : 0;
        const end = row.end_at ? new Date(row.end_at).getTime() : Number.POSITIVE_INFINITY;
        return Number.isFinite(start) && start <= now && end > now;
      });
    }
    if (!allowed) return { response: NextResponse.json({ error: "Community access is not included in your current entitlement." }, { status: 403 }) };
  }
  const { data: member } = await db.from("community_member_names")
    .select("auth_user_id,display_name,is_approved").eq("auth_user_id", user.id).maybeSingle();
  return { db, user, profile, member, isAdmin, isPartner };
}


async function getEligiblePartners(db: ReturnType<typeof createAdminClient>) {
  const [rolePartners, resellerLinks] = await Promise.all([
    db.from("users").select("auth_user_id,first_name,last_name,email,role").in("role", ["partner", "reseller"]).not("auth_user_id", "is", null),
    db.from("reseller_payment_links").select("auth_user_id").eq("is_active", true).not("auth_user_id", "is", null),
  ]);
  if (rolePartners.error || resellerLinks.error) throw new Error("Partner eligibility could not be checked.");
  const ids = [...new Set([
    ...(rolePartners.data ?? []).map(row => row.auth_user_id),
    ...(resellerLinks.data ?? []).map(row => row.auth_user_id),
  ].filter(Boolean))];
  if (!ids.length) return [];
  const [approved, profiles] = await Promise.all([
    db.from("community_member_names").select("auth_user_id,display_name").eq("is_approved", true).in("auth_user_id", ids),
    db.from("users").select("auth_user_id,first_name,last_name,email,role").in("auth_user_id", ids),
  ]);
  if (approved.error || profiles.error) throw new Error("Partner eligibility could not be checked.");
  const names = new Map((approved.data ?? []).map(row => [row.auth_user_id, row.display_name]));
  return (profiles.data ?? []).filter(row => names.has(row.auth_user_id)).map(row => ({
    auth_user_id: row.auth_user_id,
    display_name: names.get(row.auth_user_id) || [row.first_name, row.last_name].filter(Boolean).join(" ") || row.email,
    email: row.email,
    role: row.role,
  })).sort((a, b) => String(a.display_name).localeCompare(String(b.display_name)));
}

function fail(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET() {
  const context = await getContext();
  if ("response" in context) return context.response;
  const { db, user, member, isAdmin, isPartner } = context;

  if (!isAdmin && !member?.is_approved) {
    return NextResponse.json({ member: member ?? null, approved: false, announcements: [], posts: [], comments: [], leaderboard: [], members: [], moderationQueue: [] });
  }

  const [announcementsResult, postsResult, commentsResult, membersResult, dealsResult, testimonialsResult, classroomResult] = await Promise.all([
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
    db.from("community_testimonials").select("id,display_name,product_code,testimonial,created_at")
      .eq("status", "approved").order("created_at", { ascending: false }).limit(100),
    db.from("community_classroom_topics").select("id,title,content,youtube_url,sort_order,is_published,audience_type,allowed_auth_user_ids,created_at,updated_at")
      .order("sort_order", { ascending: true }).order("created_at", { ascending: true }),
  ]);

  for (const result of [announcementsResult, postsResult, commentsResult, membersResult, dealsResult, testimonialsResult, classroomResult]) {
    if (result.error) {
      console.error("Community workspace read failed:", result.error.message);
      return fail("The community workspace could not be loaded. Please try again.", 500);
    }
  }

  const visiblePosts = (postsResult.data ?? []).filter(post =>
    post.moderation_status === "approved" || post.auth_user_id === user.id || isAdmin
  );
  const leaderboardMap = new Map<string, { auth_user_id: string; display_name: string; verified_deals: number; new: number; contacted: number; qualified: number; converted: number; closed: number }>();
  for (const deal of dealsResult.data ?? []) {
    const existing = leaderboardMap.get(deal.auth_user_id) ?? {
      auth_user_id: deal.auth_user_id, display_name: deal.display_name,
      verified_deals: 0, new: 0, contacted: 0, qualified: 0, converted: 0, closed: 0,
    };
    existing.verified_deals += 1;
    if (deal.deal_stage && deal.deal_stage in existing) existing[deal.deal_stage as "new" | "contacted" | "qualified" | "converted" | "closed"] += 1;
    leaderboardMap.set(deal.auth_user_id, existing);
  }
  const leaderboard = [...leaderboardMap.values()]
    .sort((a, b) => b.converted - a.converted || b.qualified - a.qualified || b.contacted - a.contacted || b.new - a.new || a.display_name.localeCompare(b.display_name))
    .map((row, index) => ({ rank: index + 1, display_name: row.display_name, verified_deals: row.verified_deals, new: row.new, contacted: row.contacted, qualified: row.qualified, converted: row.converted, closed: row.closed }));

  let moderationQueue: unknown[] = [];
  let pendingMembers: unknown[] = [];
  let pendingComments: unknown[] = [];
  let reconciliation: Record<string, unknown> | null = null;
  if (isAdmin) {
    const [allCommunity, approvedCommunity, pendingCommunity, partnerUsers, resellerLinks, activeLicences] = await Promise.all([
      db.from("community_member_names").select("auth_user_id", { count: "exact", head: true }),
      db.from("community_member_names").select("auth_user_id", { count: "exact", head: true }).eq("is_approved", true),
      db.from("community_member_names").select("auth_user_id", { count: "exact", head: true }).eq("is_approved", false),
      db.from("users").select("auth_user_id", { count: "exact" }).in("role", ["partner", "reseller"]),
      db.from("reseller_payment_links").select("auth_user_id").eq("is_active", true).not("auth_user_id", "is", null),
      db.from("product_licenses").select("user_id,entitlement_code,purchased_product_code,status,start_at,end_at").eq("status", "active"),
    ]);
    if ([allCommunity, approvedCommunity, pendingCommunity, partnerUsers, resellerLinks, activeLicences].some(result => result.error)) return fail("Membership reconciliation could not be loaded.", 500);
    const partnerAuthIds = [...new Set([...(partnerUsers.data ?? []).map(row => row.auth_user_id), ...(resellerLinks.data ?? []).map(row => row.auth_user_id)].filter(Boolean))];
    const approvedPartnerResult = partnerAuthIds.length
      ? await db.from("community_member_names").select("auth_user_id", { count: "exact", head: true })
          .eq("is_approved", true).in("auth_user_id", partnerAuthIds)
      : { count: 0, error: null };
    if (approvedPartnerResult.error) return fail("Exclusive Community access counts could not be loaded.", 500);
    const licences = activeLicences.data ?? [];
    const now = Date.now();
    const validLicences = licences.filter(row => {
      const start = row.start_at ? new Date(row.start_at).getTime() : 0;
      const end = row.end_at ? new Date(row.end_at).getTime() : Number.POSITIVE_INFINITY;
      return Number.isFinite(start) && start <= now && end > now;
    });
    const planMembers = new Map<string, Set<string>>();
    for (const row of validLicences) {
      const key = row.purchased_product_code || row.entitlement_code || "unclassified";
      if (!planMembers.has(key)) planMembers.set(key, new Set<string>());
      if (row.user_id) planMembers.get(key)!.add(row.user_id);
    }
    const byPlan = Object.fromEntries([...planMembers.entries()].map(([plan, members]) => [plan, members.size]));
    const knowledgeBaseCodes = new Set(["nexus", "vaulttrades_nexus", "nexus_plus", "vaulttrades_nexus_plus", "vortex", "vaulttrades_vortex"]);
    const knowledgeBaseUsers = new Set(validLicences
      .filter(row => knowledgeBaseCodes.has(String(row.entitlement_code || "").toLowerCase()))
      .map(row => row.user_id));
    reconciliation = {
      totalCommunityMembers: allCommunity.count ?? 0,
      approvedParticipants: approvedCommunity.count ?? 0,
      exclusiveSectionAccess: approvedPartnerResult.count ?? 0,
      awaitingReview: pendingCommunity.count ?? 0,
      partnershipMembers: partnerAuthIds.length,
      knowledgeBaseAccess: knowledgeBaseUsers.size,
      activePlanEntitlements: validLicences.length,
      planAccessCounts: byPlan,
    };
    moderationQueue = (postsResult.data ?? []).filter(post => post.moderation_status === "pending");
    const { data: pending } = await db.from("community_member_names")
      .select("auth_user_id,display_name,is_approved,created_at")
      .eq("is_approved", false).order("created_at", { ascending: true }).limit(200);
    const pendingIds = (pending ?? []).map(row => row.auth_user_id);
    const { data: joinPayments, error: joinPaymentError } = pendingIds.length
      ? await db.from("community_join_intents").select("auth_user_id,email,status,paid_at,amount,referral_code")
          .in("auth_user_id", pendingIds).order("created_at", { ascending: false })
      : { data: [], error: null };
    if (joinPaymentError) return fail("Community payment reviews could not be loaded.", 500);
    const latestPaymentByUser = new Map<string, any>();
    for (const payment of joinPayments ?? []) if (!latestPaymentByUser.has(payment.auth_user_id)) latestPaymentByUser.set(payment.auth_user_id, payment);
    pendingMembers = (pending ?? []).map(row => ({
      ...row,
      email: latestPaymentByUser.get(row.auth_user_id)?.email ?? null,
      paymentStatus: latestPaymentByUser.get(row.auth_user_id)?.status ?? "no_record",
      paidAt: latestPaymentByUser.get(row.auth_user_id)?.paid_at ?? null,
      referralCode: latestPaymentByUser.get(row.auth_user_id)?.referral_code ?? null,
    }));
    const { data: commentsPending } = await db.from("community_comments")
      .select("id,post_id,auth_user_id,display_name,body,created_at")
      .eq("moderation_status", "pending").order("created_at", { ascending: true }).limit(200);
    pendingComments = commentsPending ?? [];
  }

  const eligiblePartners = isAdmin ? await getEligiblePartners(db).catch(error => {
    console.error("Classroom partner audience load failed:", error);
    return [];
  }) : [];
  const visibleClassroomTopics = (classroomResult.data ?? []).filter(topic => {
    if (isAdmin) return true;
    if (!topic.is_published) return false;
    if (topic.audience_type === "all_approved") return true;
    if (topic.audience_type === "all_partners") return isPartner;
    return (topic.allowed_auth_user_ids ?? []).includes(user.id);
  });

  return NextResponse.json({
    member: member ?? null, approved: true, isAdmin,
    announcements: announcementsResult.data ?? [],
    posts: visiblePosts,
    comments: commentsResult.data ?? [],
    leaderboard,
    members: isPartner || isAdmin ? (membersResult.data ?? []) : [],
    moderationQueue, pendingMembers, pendingComments,
    testimonials: isPartner || isAdmin ? (testimonialsResult.data ?? []) : [],
    classroomTopics: visibleClassroomTopics,
    ...(isAdmin ? { eligiblePartners } : {}),
    isPartner,
    ...(isAdmin ? { reconciliation } : {}),
  });
}

export async function POST(request: Request) {
  const context = await getContext();
  if ("response" in context) return context.response;
  const { db, user, member, isAdmin, isPartner } = context;
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

  if (action === "classroom_save") {
    if (!isAdmin) return fail("Only VaultTrades administrators can manage Classroom lessons.", 403);
    const id = typeof body.id === "string" ? body.id : "";
    const title = typeof body.title === "string" ? body.title.trim().slice(0, 140) : "";
    const content = typeof body.content === "string" ? body.content.trim().slice(0, 12000) : "";
    const youtubeUrl = typeof body.youtubeUrl === "string" ? body.youtubeUrl.trim().slice(0, 500) : "";
    const sortOrder = Number.isFinite(Number(body.sortOrder)) ? Math.max(0, Math.min(10000, Math.trunc(Number(body.sortOrder)))) : 0;
    const isPublished = body.isPublished !== false;
    const audienceType = ["all_approved", "all_partners", "selected_partners"].includes(body.audienceType) ? body.audienceType : "all_approved";
    const requestedPartnerIds: string[] = Array.isArray(body.allowedAuthUserIds) ? Array.from(new Set<string>(body.allowedAuthUserIds.filter((id: unknown): id is string => typeof id === "string" && /^[0-9a-f-]{36}$/i.test(id)))) : [];
    if (audienceType === "selected_partners" && requestedPartnerIds.length === 0) return fail("Select at least one eligible partner for this topic.");
    let allowedAuthUserIds: string[] = [];
    if (audienceType === "selected_partners") {
      const eligible = await getEligiblePartners(db).catch(() => null);
      if (!eligible) return fail("Partner eligibility could not be verified. Please try again.", 500);
      const eligibleIds = new Set(eligible.map(partner => partner.auth_user_id));
      if (requestedPartnerIds.some(id => !eligibleIds.has(id))) return fail("One or more selected accounts are not currently eligible Community partners.");
      allowedAuthUserIds = requestedPartnerIds;
    }
    if (title.length < 2) return fail("Add a topic title with at least two characters.");
    if (youtubeUrl) {
      let parsed: URL;
      try { parsed = new URL(youtubeUrl); } catch { return fail("Enter a valid YouTube video link."); }
      const host = parsed.hostname.toLowerCase().replace("www.", "");
      if (!["youtube.com", "m.youtube.com", "youtu.be", "youtube-nocookie.com"].includes(host)) return fail("Video links must be hosted on YouTube.");
      const segments = parsed.pathname.split("/").filter(Boolean);
      const videoId = host === "youtu.be" ? segments[0] : parsed.searchParams.get("v") || (["embed", "shorts"].includes(segments[0] || "") ? segments[1] : "");
      if (!videoId || !/^[A-Za-z0-9_-]{6,}$/.test(videoId)) return fail("Choose a valid YouTube video link.");
    }
    const values = { title, content, youtube_url: youtubeUrl || null, sort_order: sortOrder, is_published: isPublished, audience_type: audienceType, allowed_auth_user_ids: allowedAuthUserIds, updated_at: new Date().toISOString() };
    const result = id
      ? await db.from("community_classroom_topics").update(values).eq("id", id).select("id").maybeSingle()
      : await db.from("community_classroom_topics").insert({ ...values, created_by: user.id }).select("id").single();
    if (result.error || !result.data) return fail("The Classroom topic could not be saved.", 500);
    return NextResponse.json({ ok: true, message: "Classroom topic saved.", id: result.data.id });
  }

  if (action === "classroom_archive") {
    if (!isAdmin) return fail("Only VaultTrades administrators can manage Classroom lessons.", 403);
    const id = typeof body.id === "string" ? body.id : "";
    if (!id) return fail("Choose a Classroom topic to archive.");
    const { data, error } = await db.from("community_classroom_topics")
      .update({ is_published: false, updated_at: new Date().toISOString() })
      .eq("id", id).select("id").maybeSingle();
    if (error || !data) return fail("The Classroom topic could not be archived.", 500);
    return NextResponse.json({ ok: true, message: "Topic archived. Its learning material has been preserved and can be republished at any time." });
  }

  if (action === "classroom_delete") {
    if (!isAdmin) return fail("Only VaultTrades administrators can manage Classroom lessons.", 403);
    const id = typeof body.id === "string" ? body.id : "";
    if (!id) return fail("Choose a Classroom topic to remove.");
    const { error } = await db.from("community_classroom_topics").delete().eq("id", id);
    if (error) return fail("The Classroom topic could not be removed.", 500);
    return NextResponse.json({ ok: true, message: "Classroom topic removed." });
  }

  if (action === "create_post") {
    if (!isPartner && !isAdmin) return fail("Partner access is required to publish in Community discussions.", 403);
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
    if (!isPartner && !isAdmin) return fail("Community member discussions are read-only for this membership.", 403);
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

  if (action === "moderate_comment") {
    if (!isAdmin) return fail("Administrator access required.", 403);
    const id = typeof body.id === "string" ? body.id : "";
    const moderationStatus = body.approved === true ? "approved" : "rejected";
    const { error } = await db.from("community_comments").update({
      moderation_status: moderationStatus, updated_at: new Date().toISOString(),
    }).eq("id", id);
    if (error) return fail("The comment could not be moderated.", 500);
    return NextResponse.json({ ok: true, message: moderationStatus === "approved" ? "Comment approved." : "Comment rejected." });
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
