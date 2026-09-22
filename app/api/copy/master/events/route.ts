import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { createHash } from "crypto";

export const runtime = "nodejs";

function authorized(req: Request) {
  const key = process.env.VAULTTRADES_MASTER_API_KEY;
  return !!key && req.headers.get("x-vaulttrades-master-key") === key;
}

function finiteNumber(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return value;
}

export async function POST(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const {
    masterId,
    masterTradeId,
    eventId,
    eventType,
    symbol,
    direction,
    volume,
    price,
    stopLoss,
    takeProfit,
    eventTimeMs,
    payload,
  } = body;

  if (
    !masterId ||
    !masterTradeId ||
    !["OPEN", "MODIFY", "CLOSE"].includes(eventType) ||
    !symbol
  ) {
    return NextResponse.json({ error: "INVALID_EVENT" }, { status: 400 });
  }

  const db = createServiceClient();

  const { data: master } = await db
    .from("copy_masters")
    .select("id")
    .eq("id", masterId)
    .maybeSingle();

  if (!master) {
    return NextResponse.json({ error: "MASTER_NOT_FOUND" }, { status: 404 });
  }

  const stableEventId =
    typeof eventId === "string" && eventId.trim()
      ? eventId.trim()
      : createHash("sha256")
          .update(
            JSON.stringify({
              masterId,
              masterTradeId: String(masterTradeId),
              eventType,
              symbol,
              direction: direction ?? null,
              volume: volume ?? null,
              price: price ?? null,
              stopLoss: stopLoss ?? null,
              takeProfit: takeProfit ?? null,
              eventTimeMs: eventTimeMs ?? null,
            }),
          )
          .digest("hex");

  const eventTime =
    typeof eventTimeMs === "number" && Number.isFinite(eventTimeMs)
      ? new Date(eventTimeMs).toISOString()
      : new Date().toISOString();

  const { data: event, error } = await db
    .from("copy_trade_events")
    .upsert(
      {
        external_event_id: stableEventId,
        master_id: masterId,
        master_trade_id: String(masterTradeId),
        event_type: eventType,
        symbol,
        direction: direction || null,
        volume: finiteNumber(volume),
        price: finiteNumber(price),
        stop_loss: finiteNumber(stopLoss),
        take_profit: finiteNumber(takeProfit),
        event_time: eventTime,
        payload: payload || {},
      },
      { onConflict: "external_event_id", ignoreDuplicates: true },
    )
    .select("id,external_event_id")
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { error: "EVENT_STORE_FAILED", detail: error.message },
      { status: 500 },
    );
  }

  if (!event) {
    const { data: existing } = await db
      .from("copy_trade_events")
      .select("id,external_event_id")
      .eq("external_event_id", stableEventId)
      .maybeSingle();

    return NextResponse.json({
      ok: true,
      duplicate: true,
      eventId: existing?.id ?? null,
      externalEventId: stableEventId,
      fanoutCount: 0,
    });
  }

  await db
    .from("copy_masters")
    .update({
      status: "online",
      last_heartbeat_at: new Date().toISOString(),
    })
    .eq("id", masterId);

  const { data: links } = await db
    .from("copy_links")
    .select("follower_id,lot_mode,lot_value")
    .eq("master_id", masterId)
    .eq("status", "active");

  for (const link of links || []) {
    let requestedVolume = finiteNumber(volume);

    if (requestedVolume != null && link.lot_mode === "fixed") {
      requestedVolume = Number(link.lot_value);
    }

    if (requestedVolume != null && link.lot_mode === "multiplier") {
      requestedVolume = Number(requestedVolume) * Number(link.lot_value);
    }

    await db.from("copy_trade_executions").upsert(
      {
        event_id: event.id,
        follower_id: link.follower_id,
        requested_volume: requestedVolume,
        status: "pending",
      },
      { onConflict: "event_id,follower_id" },
    );
  }

  return NextResponse.json({
    ok: true,
    duplicate: false,
    eventId: event.id,
    externalEventId: stableEventId,
    fanoutCount: (links || []).length,
  });
}
