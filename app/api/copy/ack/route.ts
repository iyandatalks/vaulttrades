import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { createServiceClient } from "@/lib/supabase/service";
export const runtime="nodejs";
const sha=(v:string)=>createHash("sha256").update(v).digest("hex");
export async function POST(req:Request){
 const token=req.headers.get("x-vaulttrades-copy-token")||"";
 if(!token)return NextResponse.json({error:"UNAUTHORIZED"},{status:401});
 const db=createServiceClient();
 const {data:f}=await db.from("copy_followers").select("id").eq("api_token_hash",sha(token)).maybeSingle();
 if(!f)return NextResponse.json({error:"UNAUTHORIZED"},{status:401});
 const b=await req.json().catch(()=>({}));
 if(!b.executionId || !["sent","executed","failed","cancelled"].includes(b.status))return NextResponse.json({error:"INVALID_ACK"},{status:400});
 const patch:any={status:b.status,follower_trade_id:b.followerTradeId||null,executed_volume:b.executedVolume??null,executed_price:b.executedPrice??null,error_code:b.errorCode||null,error_message:b.errorMessage||null};
 if(b.status==="sent")patch.sent_at=new Date().toISOString();
 if(b.status==="executed")patch.executed_at=new Date().toISOString();
 const {error}=await db.from("copy_trade_executions").update(patch).eq("id",b.executionId).eq("follower_id",f.id);
 if(error)return NextResponse.json({error:"ACK_FAILED"},{status:500});
 if(b.status==="failed"){
   const {data:existing}=await db.from("admin_inbox_notifications").select("id").eq("related_id",b.executionId).eq("event_type","copier_execution_failed").maybeSingle();
   if(!existing){
     const {data:follower}=await db.from("copy_followers").select("auth_user_id,mt_login,broker_server").eq("id",f.id).maybeSingle();
     const {data:profile}=follower ? await db.from("users").select("email").eq("auth_user_id",follower.auth_user_id).maybeSingle() : {data:null};
     await db.from("admin_inbox_notifications").insert({
       event_type:"copier_execution_failed",
       title:"MT5 Copier trade execution failed",
       body:`MT5 ${follower?.mt_login || "account"} · ${follower?.broker_server || "broker"}: ${String(b.errorCode || "EXECUTION_FAILED")} — ${String(b.errorMessage || "The MT5 Copier reported an execution failure.").slice(0,700)}`,
       severity:"critical",
       auth_user_id:follower?.auth_user_id || null,
       customer_email:profile?.email || null,
       related_id:b.executionId,
       action_href:"/admin/inbox",
       metadata:{execution_id:b.executionId,mt5_login:follower?.mt_login || null,error_code:b.errorCode || null}
     });
   }
 }
 return NextResponse.json({ok:true});
}