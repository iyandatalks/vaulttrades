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
 return NextResponse.json({ok:true});
}