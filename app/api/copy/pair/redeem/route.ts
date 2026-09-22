import { NextResponse } from "next/server";
import { randomBytes, createHash } from "crypto";
import { createServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";

const sha = (v:string) => createHash("sha256").update(v).digest("hex");

export async function POST(req:Request) {
  const body = await req.json().catch(() => ({}));
  const code = String(body.pairingCode || "").trim().toUpperCase();
  const mtLogin = body.mtLogin ? String(body.mtLogin) : null;
  const brokerServer = body.brokerServer ? String(body.brokerServer) : null;
  const eaVersion = body.eaVersion ? String(body.eaVersion) : null;
  if (!code) return NextResponse.json({error:"PAIRING_CODE_REQUIRED"},{status:400});

  const db=createServiceClient();
  const {data:pair,error}=await db.from("copy_pairing_codes").select("id,auth_user_id,expires_at,redeemed_at,revoked_at").eq("code_hash",sha(code)).maybeSingle();
  if(error || !pair) return NextResponse.json({error:"INVALID_PAIRING_CODE"},{status:401});
  if(pair.redeemed_at || pair.revoked_at || new Date(pair.expires_at).getTime() < Date.now()) return NextResponse.json({error:"PAIRING_CODE_EXPIRED"},{status:401});

  const token=randomBytes(32).toString("hex");
  const {data:follower,error:fErr}=await db.from("copy_followers").upsert({
    auth_user_id:pair.auth_user_id, mt_login:mtLogin, broker_server:brokerServer, ea_version:eaVersion,
    status:"online", copy_enabled:true, api_token_hash:sha(token), last_heartbeat_at:new Date().toISOString()
  },{onConflict:"auth_user_id"}).select("id,auth_user_id,mt_login,broker_server,status,copy_enabled").single();
  if(fErr) return NextResponse.json({error:"FOLLOWER_CREATE_FAILED",detail:fErr.message},{status:500});

  await db.from("copy_pairing_codes").update({redeemed_at:new Date().toISOString()}).eq("id",pair.id);
  const {data:master}=await db.from("copy_masters").select("id").eq("name","VaultTrades Master").maybeSingle();
  if(master) await db.from("copy_links").upsert({master_id:master.id,follower_id:follower.id,status:"active",lot_mode:"fixed",lot_value:0.01},{onConflict:"master_id,follower_id"});
  return NextResponse.json({ok:true,token,followerId:follower.id});
}