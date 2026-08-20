"use client";

import Link from "next/link";
import { useState } from "react";
import { createClient } from "../../lib/supabase/client";

export default function JoinPage() {
  const [mode, setMode] = useState<"signup" | "login">("signup");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    const supabase = createClient();

    if (mode === "signup") {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { first_name: firstName, last_name: lastName, phone },
          emailRedirectTo: `${window.location.origin}/auth/callback?next=/subscription`,
        },
      });
      if (error) setMessage(error.message);
      else setMessage("Account created. Check your email if confirmation is enabled, then continue to subscription.");
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setMessage(error.message);
      else window.location.href = "/subscription";
    }
    setLoading(false);
  }

  return (
    <main style={{ minHeight: "calc(100vh - 61px)", background: "#050812", color: "#f4f6fb", display: "grid", placeItems: "center", padding: 24 }}>
      <section style={{ width: "100%", maxWidth: 560, border: "1px solid rgba(212,166,55,.25)", borderRadius: 14, padding: 32, background: "#0a0f1c" }}>
        <div style={{ color: "#d4a637", fontSize: 12, fontWeight: 800, letterSpacing: ".18em" }}>VAULTTRADES</div>
        <h1 style={{ fontSize: 36, margin: "12px 0" }}>{mode === "signup" ? "Create your account" : "Log in to VaultTrades"}</h1>
        <p style={{ color: "#aeb5c6", lineHeight: 1.7 }}>{mode === "signup" ? "Create your VaultTrades profile before choosing your monthly subscription." : "Use your VaultTrades account to continue."}</p>
        <form onSubmit={submit} style={{ display: "grid", gap: 12, marginTop: 24 }}>
          {mode === "signup" ? <>
            <label style={labelStyle}>First Name</label>
            <input value={firstName} onChange={(e) => setFirstName(e.target.value)} required autoComplete="given-name" style={inputStyle} />
            <label style={labelStyle}>Last Name</label>
            <input value={lastName} onChange={(e) => setLastName(e.target.value)} required autoComplete="family-name" style={inputStyle} />
          </> : null}
          <label style={labelStyle}>Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" style={inputStyle} />
          {mode === "signup" ? <>
            <label style={labelStyle}>Cell Number <span style={{ color: "#7f8799", fontWeight: 500 }}>(Optional)</span></label>
            <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" style={inputStyle} />
          </> : null}
          <label style={labelStyle}>Password</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} autoComplete={mode === "signup" ? "new-password" : "current-password"} style={inputStyle} />
          <button type="submit" disabled={loading} style={{ marginTop: 8, padding: "14px 18px", border: 0, borderRadius: 9, background: "#d4a637", color: "#050812", fontWeight: 800, cursor: loading ? "wait" : "pointer" }}>{loading ? "Please wait…" : mode === "signup" ? "Create Account" : "Log In"}</button>
        </form>
        {message ? <p style={{ marginTop: 16, color: "#c9cfdd", lineHeight: 1.6 }}>{message}</p> : null}
        <button onClick={() => { setMode(mode === "signup" ? "login" : "signup"); setMessage(""); }} style={{ marginTop: 18, width: "100%", background: "transparent", border: 0, color: "#d4a637", cursor: "pointer" }}>{mode === "signup" ? "Already have an account? Log in" : "Need an account? Create one"}</button>
        <Link href="/" style={{ display: "block", marginTop: 18, textAlign: "center", color: "#aeb5c6", textDecoration: "none" }}>Back to Home</Link>
      </section>
    </main>
  );
}

const labelStyle: React.CSSProperties = { color: "#d7dbe7", fontSize: 13, fontWeight: 700 };
const inputStyle: React.CSSProperties = { padding: "13px 14px", borderRadius: 8, border: "1px solid rgba(255,255,255,.12)", background: "#050812", color: "#f4f6fb" };
