"use client";

import { useEffect, useMemo, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

type Entry = { id: string; type: string; symbol: string; timeframe: string; direction: string; entry: number | null; sl: number | null; tp: number | null; value: number | null; closedPrice: number | null; result: "WIN" | "LOSS" | "BREAK EVEN"; pnl: number; note: string; created_at: string; };

const supabase = () => createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

export default function JournalPage() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [form, setForm] = useState({ type: "", symbol: "XAUUSD", timeframe: "M5", direction: "BUY", entry: "", sl: "", tp: "", value: "", closedPrice: "", result: "WIN" as Entry["result"], note: "" });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const load = async () => {
    const sb = supabase();
    const { data: auth } = await sb.auth.getUser();
    if (!auth.user) return;
    setUserId(auth.user.id);
    const { data: u } = await sb.from("users").select("id").eq("auth_user_id", auth.user.id).single();
    if (!u?.id) return;
    await sb.from("journal_entries").delete().eq("user_id", u.id).lt("created_at", new Date(Date.now() - 7 * 86400000).toISOString());
    const { data } = await sb.from("journal_entries").select("id, type, symbol, timeframe, direction, entry, sl, tp, value, closed_price, result, pnl, note, created_at").eq("user_id", u.id).gte("created_at", new Date(Date.now() - 7 * 86400000).toISOString()).order("created_at", { ascending: false });
    setEntries((data ?? []).map((x: any) => ({ ...x, closedPrice: x.closed_price, pnl: Number(x.pnl ?? 0), value: x.value === null ? null : Number(x.value) })) as Entry[]);
  };

  useEffect(() => { load(); }, []);

  const pnlFor = (direction: string, entry: number | null, closed: number | null, value: number | null, result: Entry["result"]) => {
    if (entry === null || closed === null || !Number.isFinite(entry) || !Number.isFinite(closed)) return result === "LOSS" && value ? -Math.abs(value) : result === "WIN" && value ? Math.abs(value) : 0;
    const move = direction === "SELL" ? entry - closed : closed - entry;
    return Number((value ? move * value : move).toFixed(2));
  };

  const save = async () => {
    if (!userId) return;
    const sb = supabase();
    const { data: u } = await sb.from("users").select("id").eq("auth_user_id", userId).single();
    if (!u?.id) return;
    const entry = form.entry ? Number(form.entry) : null, sl = form.sl ? Number(form.sl) : null, tp = form.tp ? Number(form.tp) : null, value = form.value ? Number(form.value) : null, closed = form.closedPrice ? Number(form.closedPrice) : null;
    const pnl = pnlFor(form.direction, entry, closed, value, form.result);
    const payload = { user_id: u.id, email: (await sb.auth.getUser()).data.user?.email ?? null, type: form.type.trim() || "Manual Trade", symbol: form.symbol.trim(), timeframe: form.timeframe.trim(), direction: form.direction, entry, sl, tp, value, closed_price: closed, result: form.result, pnl, total: pnl, note: form.note.trim(), data: { value, closedPrice: closed } };
    if (editingId) await sb.from("journal_entries").update(payload).eq("id", editingId).eq("user_id", u.id); else await sb.from("journal_entries").insert(payload);
    setEditingId(null); setForm({ type: "", symbol: "XAUUSD", timeframe: "M5", direction: "BUY", entry: "", sl: "", tp: "", value: "", closedPrice: "", result: "WIN", note: "" }); setSaved(true); setTimeout(() => setSaved(false), 1800); await load();
  };

  const edit = (e: Entry) => setForm({ type: e.type, symbol: e.symbol, timeframe: e.timeframe, direction: e.direction, entry: e.entry?.toString() ?? "", sl: e.sl?.toString() ?? "", tp: e.tp?.toString() ?? "", value: e.value?.toString() ?? "", closedPrice: e.closedPrice?.toString() ?? "", result: e.result, note: e.note });
  const remove = async (id: string) => { if (!userId || !window.confirm("Delete this journal entry?")) return; const sb = supabase(); const { data: u } = await sb.from("users").select("id").eq("auth_user_id", userId).single(); if (u?.id) { await sb.from("journal_entries").delete().eq("id", id).eq("user_id", u.id); await load(); } };

  const weekly = useMemo(() => ({ wins: entries.filter(e => e.result === "WIN").length, losses: entries.filter(e => e.result === "LOSS").length, total: entries.reduce((s, e) => s + Number(e.pnl || 0), 0) }), [entries]);
  const set = (key: string, value: string) => setForm(f => ({ ...f, [key]: value } as typeof f));

  return <main className="shell">
    <section className="card"><div className="section-label">JOURNAL · 7 DAY MEMORY</div><h1 className="title">Trading Journal</h1><p className="muted">Your journal is stored against your account. Entries older than 7 days are automatically removed.</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10, marginTop: 20 }}>
        {[["Entry Type","type"],["Symbol","symbol"],["Timeframe","timeframe"],["Direction","direction"],["Entry Price","entry"],["SL Price","sl"],["TP Price","tp"],["Value","value"],["Closed Price","closedPrice"]].map(([label,key]) => <label key={key} className="muted">{label}<input className="coach-question" value={(form as any)[key]} onChange={e => set(key,e.target.value)} placeholder={label} /></label>)}
        <label className="muted">Result<select value={form.result} onChange={e => set("result",e.target.value)}><option>WIN</option><option>LOSS</option><option>BREAK EVEN</option></select></label>
      </div>
      <textarea className="coach-question" style={{ marginTop: 10 }} rows={3} value={form.note} onChange={e => set("note",e.target.value)} placeholder="Trade notes..." />
      <div style={{ display: "flex", gap: 10, marginTop: 10 }}><button className="primary" onClick={save}>{editingId ? "Update Entry" : "Save Entry"}</button>{editingId && <button className="secondary" onClick={() => setEditingId(null)}>Cancel</button>}</div>{saved && <div className="condition-box" style={{ marginTop: 10 }}>Journal entry saved.</div>}
    </section>
    <section className="card" style={{ marginTop: 16 }}><div className="section-label">THIS WEEK · AUTOMATIC SUMMARY</div><div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}><div className="condition-box"><strong>Wins</strong><div>{weekly.wins}</div></div><div className="condition-box"><strong>Losses</strong><div>{weekly.losses}</div></div><div className="condition-box"><strong>Total P&L</strong><div>{weekly.total.toFixed(2)}</div></div></div></section>
    <section className="card" style={{ marginTop: 16 }}><div className="section-label">RECENT ENTRIES</div>{entries.length === 0 ? <p className="muted">No journal entries in the last 7 days.</p> : <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse" }}><thead><tr>{["Type","Symbol","Direction","Entry","SL","TP","Value","Closed","Result","Auto P&L","Total",""].map(h=><th key={h} style={{ textAlign:"left", padding:8 }}>{h}</th>)}</tr></thead><tbody>{entries.map(e=><tr key={e.id}><td>{e.type}</td><td>{e.symbol}</td><td>{e.direction}</td><td>{e.entry ?? "—"}</td><td>{e.sl ?? "—"}</td><td>{e.tp ?? "—"}</td><td>{e.value ?? "—"}</td><td>{e.closedPrice ?? "—"}</td><td>{e.result}</td><td>{e.pnl.toFixed(2)}</td><td>{e.pnl.toFixed(2)}</td><td><button className="secondary" onClick={()=>{setEditingId(e.id);edit(e)}}>Edit</button> <button className="secondary" onClick={()=>remove(e.id)}>Delete</button></td></tr>)}</tbody></table></div>}</section>
  </main>;
}
