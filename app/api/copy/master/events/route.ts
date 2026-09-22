import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
export const runtime="nodejs";
function authorized(req:Request){const key=process.env.VAULTTRADES_MASTER_API_KEY;return !!key&&req.headers.get("x-vaulttrades-master-key")===key;}
export async function POST(req:Request){
 if(!authorized(req))return NextResponse.json({error:"UNAUTHORIZED"},{status:401});
 const b=await req.json().catch(()=>({}));
 const {masterId,masterTradeId,eventType,symbol,direction,volume,price,stopLoss,takeProfit,eventTime,payload}=b;
 if(!masterId||!masterTradeId||!["OPEN","MODIFY","CLOSE"].includes(eventType)||!symbol)return NextResponse.json({error:"INVALID_EVENT"},{status:400});
 const db=createServiceClient();
 const {data:master}=await db.from("copy_masters").select("id").eq("id",masterId).maybeSingle();
 if(!master)return NextResponse.json({error:"MASTER_NOT_FOUND"},{status:404});
 const {data:event,error}=await db.from("copy_trade_events").upsert({
  master_id:masterId,master_trade_id:String(masterTradeId),event_type:eventType,symbol,
  direction:direction||null,volume:volume??null,price:price??null,stop_loss:stopLoss??null,take_profit:takeProfit??null,
  event_time:eventTime||new Date().toISOString(),payload:payload||{}
 },{onConflict:"master_id,master_trade_id,event_type,event_time"}).select("id").single();
 if(error)return NextResponse.json({error:"EVENT_STORE_FAILED",detail:error.message},{status:500});
 const {data:links}=await db.from("copy_links").select("follower_id,lot_mode,lot_value").eq("master_id",masterId).eq("status","active");
 for(const link of links||[]){
  let requestedVolume=volume??null;
  if(requestedVolume!=null&&link.lot_mode==="fixed")requestedVolume=Number(link.lot_value);
  if(requestedVolume!=null&&link.lot_mode==="multiplier")requestedVolume=Number(requestedVolume)*Number(link.lot_value);
  await db.from("copy_trade_executions").upsert({event_id:event.id,follower_id:link.follower_id,requested_volume:requestedVolume,status:"pending"},{onConflict:"event_id,follower_id"});
 }
 return NextResponse.json({ok:true,eventId:event.id,fanoutCount:(links||[]).length});
}