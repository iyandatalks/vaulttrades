import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { createServiceClient } from "@/lib/supabase/service";
export const runtime="nodejs";
const sha=(v:string)=>createHash("sha256").update(v).digest("hex");
export async function GET(req:Request){
 const token=req.headers.get("x-vaulttrades-copy-token")||"";
 if(!token)return NextResponse.json({error:"UNAUTHORIZED"},{status:401});
 const db=createServiceClient();
 const {data:f}=await db.from("copy_followers").select("id,status,copy_enabled").eq("api_token_hash",sha(token)).maybeSingle();
 if(!f || f.status==="disabled")return NextResponse.json({error:"UNAUTHORIZED"},{status:401});
 await db.from("copy_followers").update({status:"online",last_heartbeat_at:new Date().toISOString()}).eq("id",f.id);
 if(!f.copy_enabled)return NextResponse.json({commands:[]});
 const {data,error}=await db.from("copy_trade_executions").select("id,command_id,event_id,requested_volume,status,copy_trade_events(master_trade_id,event_type,symbol,direction,volume,price,stop_loss,take_profit,event_time,payload)").eq("follower_id",f.id).eq("status","pending").order("created_at",{ascending:true}).limit(25);
 if(error)return NextResponse.json({error:"POLL_FAILED"},{status:500});
 return NextResponse.json({commands:data||[]});
}