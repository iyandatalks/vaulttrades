import {NextResponse} from "next/server";
import {createClient} from "@/lib/supabase/server";
import {createAdminClient} from "@/lib/supabase/admin";
export const dynamic="force-dynamic";
const reserved=new Set(["www","api","mail","admin","app","vaulttrades","support","members","member","portal","dashboard","auth","cdn","static","assets","billing","checkout","start","opportunity","subscription","community","profile","login","register"]);
export async function GET(request:Request){
 const session=await createClient();const {data:{user}}=await session.auth.getUser();if(!user)return NextResponse.json({error:"Sign in required."},{status:401});
 const db=createAdminClient();const {data:profile}=await db.from("users").select("role").eq("auth_user_id",user.id).maybeSingle();if(profile?.role!=="admin")return NextResponse.json({error:"Administrator access required."},{status:403});
 const url=new URL(request.url);const raw=(url.searchParams.get("domain")||"").trim().toLowerCase();const requestId=url.searchParams.get("requestId")||"";
 const slug=raw.replace(/^https?:\/\//,"").replace(/\.vaulttradesve\.com$/,"").split(/[/?#]/)[0];
 if(!/^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/.test(slug)||reserved.has(slug))return NextResponse.json({available:false,message:"Enter a valid, non-reserved name (2–30 characters).",domain:slug+".vaulttradesve.com"});
 const domain=slug+".vaulttradesve.com";
 const [{data:assigned},{data:custom}]=await Promise.all([db.from("member_website_requests").select("id").ilike("assigned_domain",domain).maybeSingle(),db.from("member_website_requests").select("id").ilike("custom_domain",domain).maybeSingle()]);
 if([assigned,custom].some(x=>x&&x.id!==requestId))return NextResponse.json({available:false,message:"Already taken by an existing website assignment.",domain});
 return NextResponse.json({available:true,message:"Available in the VaultTrades partner website registry.",domain},{headers:{"Cache-Control":"no-store"}});
}