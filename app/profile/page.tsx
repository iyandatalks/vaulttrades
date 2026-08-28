"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createBrowserClient } from "@supabase/ssr";
import FundedAccountWealthBuilder from "./FundedAccountWealthBuilder";

export default function ProfilePage() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [enrolled, setEnrolled] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  useEffect(() => { const sb=createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!); sb.auth.getUser().then(async ({data})=>{setEmail(data.user?.email??null); if(data.user){const {data:u}=await sb.from("users").select("mentorship_enrolled, role").eq("auth_user_id",data.user.id).single(); setEnrolled(Boolean(u?.mentorship_enrolled)); setIsAdmin(u?.role === "admin");} setLoading(false);}); }, []);
  async function handleLogout(){const sb=createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);await sb.auth.signOut();router.replace("/");router.refresh();}
  const founderAccess = enrolled || isAdmin;
  return <main className="shell"><section className="card"><div className="section-label">PROFILE</div><h1 className="title">Your VaultTrades Profile</h1><p className="muted">Account and membership information.</p>
    {!loading&&email&&<div className="card" style={{margin:"24px 0 0"}}><strong>Signed in as</strong><p className="muted">{email}</p><button onClick={handleLogout} className="button" type="button">Log out</button></div>}
    {!loading&&!email&&<div style={{marginTop:24}}><a className="button" href="/auth/login">Log in</a></div>}
    <div className="card" style={{margin:"24px 0 0",border:"1px solid rgba(212,166,55,.35)"}}><div className="section-label">FOUNDERS MENTORSHIP</div><h2 style={{margin:"8px 0"}}>30 Days Founders Mentorship Program</h2><p className="muted">30 days · approximately 1 hour per day · recorded training.</p>{founderAccess?<Link className="button" href="/founders-mentorship">Open Founders Mentorship</Link>:<><p className="muted">This area is visible to members, but access is locked until you enroll in the mentorship program.</p><button className="secondary" type="button" disabled>Locked — Enroll to Access</button></>}</div>
    {!loading&&founderAccess&&<FundedAccountWealthBuilder />}
  </section></main>;
}
