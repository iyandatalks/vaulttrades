import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AnalyzerPushSettings from "./push-settings";

export const dynamic = "force-dynamic";

export default async function AdminAnalyzerAlertsPage() {
  const auth = await createClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) redirect("/auth/login?next=/admin/analyzer-alerts");
  const { data: profile } = await auth.from("users").select("role")
    .eq("auth_user_id", user.id).maybeSingle();
  if (profile?.role !== "admin") redirect("/");
  return <main className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8 text-white">
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-400">Private · Admin only</p>
      <h1 className="mt-2 text-3xl font-bold">Analyzer push alerts</h1>
      <p className="mt-2 text-sm text-white/65">Connect this Android Chrome device and send a test notification. This page is not linked from public navigation.</p>
    </div>
    <AnalyzerPushSettings />
    <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <h2 className="font-semibold">Strategy monitoring status</h2>
      <p className="mt-2 text-sm leading-6 text-white/65">Push delivery can work independently of the Analyzer page. Automatic BUY/SELL detection is not enabled yet; it will be connected only after a reliable background market-data or TradingView alert source is configured. No trade execution is performed by this push service.</p>
    </section>
  </main>;
}
