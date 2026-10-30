import "server-only";
import webpush from "web-push";
import { createServiceClient } from "@/lib/supabase/service";

type PushPayload = { title: string; body: string; url?: string; tag?: string };

function configureWebPush() {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!publicKey || !privateKey || !subject) throw new Error("WEB_PUSH_NOT_CONFIGURED");
  webpush.setVapidDetails(subject, publicKey, privateKey);
}

export async function sendAdminAnalyzerPush(authUserId: string, payload: PushPayload) {
  configureWebPush();
  const db = createServiceClient();
  const { data: subscriptions, error } = await db.from("admin_analyzer_push_subscriptions")
    .select("id,endpoint,p256dh,auth_secret").eq("auth_user_id", authUserId).eq("enabled", true);
  if (error) throw new Error("PUSH_SUBSCRIPTIONS_LOAD_FAILED");
  let sent = 0;
  let failed = 0;
  for (const item of subscriptions ?? []) {
    try {
      await webpush.sendNotification({
        endpoint: item.endpoint,
        keys: { p256dh: item.p256dh, auth: item.auth_secret },
      }, JSON.stringify(payload), { TTL: 60, urgency: "high" });
      sent++;
      await db.from("admin_analyzer_push_subscriptions").update({ last_success_at: new Date().toISOString() }).eq("id", item.id);
    } catch (error: any) {
      failed++;
      const gone = error?.statusCode === 404 || error?.statusCode === 410;
      await db.from("admin_analyzer_push_subscriptions")
        .update(gone ? { enabled: false, last_error_at: new Date().toISOString() } : { last_error_at: new Date().toISOString() })
        .eq("id", item.id);
    }
  }
  return { sent, failed, total: subscriptions?.length ?? 0 };
}

export async function notifyAdminAnalyzerSignal(input: {
  authUserId: string; eventKey: string; strategyId: string; symbol: string; timeframe: string;
  direction: "BUY" | "SELL"; entry?: number | null; stopLoss?: number | null; takeProfit?: number | null;
}) {
  const db = createServiceClient();
  const title = `VaultTrades Analyzer · ${input.direction} ${input.symbol}`;
  const body = `${input.strategyId} · ${input.timeframe} · Entry ${input.entry ?? "—"} · SL ${input.stopLoss ?? "—"} · TP ${input.takeProfit ?? "—"}`;
  const { data: event, error } = await db.from("admin_analyzer_push_events").insert({
    auth_user_id: input.authUserId, event_key: input.eventKey, strategy_id: input.strategyId,
    symbol: input.symbol, timeframe: input.timeframe, direction: input.direction,
    entry: input.entry ?? null, stop_loss: input.stopLoss ?? null, take_profit: input.takeProfit ?? null,
    title, body, delivery_status: "queued",
  }).select("id").single();
  if (error) {
    if (error.code === "23505") return { duplicate: true, sent: 0, failed: 0 };
    throw new Error("PUSH_EVENT_CREATE_FAILED");
  }
  try {
    const result = await sendAdminAnalyzerPush(input.authUserId, { title, body, url: "/admin/analyzer-alerts", tag: input.eventKey });
    await db.from("admin_analyzer_push_events").update({
      delivery_status: result.sent > 0 ? "sent" : "failed",
      delivery_count: result.sent,
      sent_at: result.sent > 0 ? new Date().toISOString() : null,
      last_error: result.failed ? `${result.failed} device delivery attempt(s) failed` : null,
    }).eq("id", event.id);
    return { duplicate: false, ...result };
  } catch {
    await db.from("admin_analyzer_push_events").update({ delivery_status: "failed", last_error: "Push delivery failed" }).eq("id", event.id);
    throw new Error("PUSH_DELIVERY_FAILED");
  }
}
