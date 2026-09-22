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
 await db.from("copy_followers").update({status:"online",mt_login:b.mtLogin?String(b.mtLogin):undefined,broker_server:b.brokerServer?String(b.brokerServer):undefined,ea_version:b.eaVersion?String(b.eaVersion):undefined,last_heartbeat_at:new Date().toISOString()}).eq("id",f.id);
 return NextResponse.json({ok:true,copyEnabled:true});
}