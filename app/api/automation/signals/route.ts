import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const auth=await createClient();
  const {data:{user}}=await auth.auth.getUser();
  if(!user) return NextResponse.json({error:"UNAUTHENTICATED"},{status:401});
  const db=createServiceClient();
  const {data,error}=await db.from("automation_signals").select("id,signal_id,strategy_id,strategy_name,symbol,direction,timeframe,entry_price,stop_loss,tp1,tp2,tp3,tp4,tp5,rr,confidence,execution_mode,event,source,generated_at,received_at,tp1_hit_at,tp2_hit_at,tp3_hit_at,tp4_hit_at,tp5_hit_at,stop_loss_hit_at,closed_at,close_reason,status,last_update_at").order("generated_at",{ascending:false}).limit(100);
  if(error) return NextResponse.json({error:"SIGNAL_READ_FAILED",detail:error.message},{status:500});
  return NextResponse.json({signals:data||[]});
}
