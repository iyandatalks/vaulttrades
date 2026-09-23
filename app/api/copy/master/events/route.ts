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

function json(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(req: Request) {
  const requestId = crypto.randomUUID();

  if (!authorized(req)) {
    console.warn("[copy/master/events] unauthorized", { requestId });
    return json({ error: "UNAUTHORIZED", requestId }, 401);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    console.warn("[copy/master/events] invalid json", { requestId });
    return json({ error: "INVALID_JSON", requestId }, 400);
  }

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

  console.info("[copy/master/events] received", {
    requestId,
    masterId,
    masterTradeId,
    eventId,
    eventType,
    symbol,
  });

  if (
    typeof masterId !== "string" ||
    !masterId ||
    (typeof masterTradeId !== "string" && typeof masterTradeId !== "number") ||
    !["OPEN", "MODIFY", "CLOSE"].includes(String(eventType)) ||
    typeof symbol !== "string" ||
    !symbol
  ) {
    console.warn("[copy/master/events] invalid event", { requestId });
    return json({ error: "INVALID_EVENT", requestId }, 400);
  }

  let db;
  try {
    db = createServiceClient();
  } catch (error) {
    console.error("[copy/master/events] database client unavailable", {
      requestId,
      error: error instanceof Error ? error.message : String(error),
    });
    return json({ error: "EVENT_STORE_UNAVAILABLE", requestId }, 500);
  }

  const { data: master, error: masterError } = await db
    .from("copy_masters")
    .select("id")
    .eq("id", masterId)
    .maybeSingle();

  if (masterError) {
    console.error("[copy/master/events] master lookup failed", {
      requestId,
      error: masterError.message,
    });
    return json({ error: "MASTER_LOOKUP_FAILED", requestId }, 500);
  }

  if (!master) {
    console.warn("[copy/master/events] master not found", {
      requestId,
      masterId,
    });
    return json({ error: "MASTER_NOT_FOUND", requestId }, 404);
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
        event_type: String(eventType),
        symbol,
        direction: typeof direction === "string" ? direction : null,
        volume: finiteNumber(volume),
        price: finiteNumber(price),
        stop_loss: finiteNumber(stopLoss),
        take_profit: finiteNumber(takeProfit),
        event_time: eventTime,
        payload: payload && typeof payload === "object" ? payload : {},
      },
      { onConflict: "external_event_id", ignoreDuplicates: true },
    )
    .select("id,external_event_id")
    .maybeSingle();

  if (error) {
    console.error("[copy/master/events] event store failed", {
      requestId,
      masterId,
      masterTradeId: String(masterTradeId),
      eventType,
      symbol,
      externalEventId: stableEventId,
      error: error.message,
    });
    return json(
      { error: "EVENT_STORE_FAILED", detail: error.message, requestId },
      500,
    );
  }

  if (!event) {
    const { data: existing, error: existingError } = await db
      .from("copy_trade_events")
      .select("id,external_event_id")
      .eq("external_event_id", stableEventId)
      .maybeSingle();

    if (existingError) {
      console.error("[copy/master/events] duplicate lookup failed", {
        requestId,
        externalEventId: stableEventId,
        error: existingError.message,
      });
      return json({ error: "DUPLICATE_LOOKUP_FAILED", requestId }, 500);
    }

    console.info("[copy/master/events] duplicate", {
      requestId,
      eventId: existing?.id ?? null,
      externalEventId: stableEventId,
    });

    return json({
      ok: true,
      duplicate: true,
      eventId: existing?.id ?? null,
      externalEventId: stableEventId,
      fanoutCount: 0,
      requestId,
    });
  }

  const { error: masterUpdateError } = await db
    .from("copy_masters")
    .update({
      status: "online",
      last_heartbeat_at: new Date().toISOString(),
    })
    .eq("id", masterId);

  if (masterUpdateError) {
    console.error("[copy/master/events] master status update failed", {
      requestId,
      masterId,
      error: masterUpdateError.message,
    });
  }

  const { data: links, error: linksError } = await db
    .from("copy_links")
    .select("follower_id,lot_mode,lot_value")
    .eq("master_id", masterId)
    .eq("status", "active");

  if (linksError) {
    console.error("[copy/master/events] follower link lookup failed", {
      requestId,
      eventId: event.id,
      error: linksError.message,
    });
    return json({
      error: "FANOUT_LOOKUP_FAILED",
      eventId: event.id,
      externalEventId: stableEventId,
      requestId,
    }, 500);
  }

  let fanoutCount = 0;

  for (const link of links || []) {
    let requestedVolume = finiteNumber(volume);

    if (requestedVolume != null && link.lot_mode === "fixed") {
      requestedVolume = Number(link.lot_value);
    }

    if (requestedVolume != null && link.lot_mode === "multiplier") {
      requestedVolume = Number(requestedVolume) * Number(link.lot_value);
    }

    const { error: executionError } = await db
      .from("copy_trade_executions")
      .upsert(
        {
          event_id: event.id,
          follower_id: link.follower_id,
          requested_volume: requestedVolume,
          status: "pending",
        },
        { onConflict: "event_id,follower_id" },
      );

    if (executionError) {
      console.error("[copy/master/events] fanout failed", {
        requestId,
        eventId: event.id,
        followerId: link.follower_id,
        error: executionError.message,
      });
      return json({
        error: "FANOUT_STORE_FAILED",
        eventId: event.id,
        externalEventId: stableEventId,
        requestId,
      }, 500);
    }

    fanoutCount += 1;
  }

  console.info("[copy/master/events] stored", {
    requestId,
    eventId: event.id,
    externalEventId: stableEventId,
    eventType,
    symbol,
    fanoutCount,
  });

  return json({
    ok: true,
    duplicate: false,
    eventId: event.id,
    externalEventId: stableEventId,
    fanoutCount,
    requestId,
  });
}
