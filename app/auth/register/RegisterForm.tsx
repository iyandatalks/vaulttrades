"use client";

import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";

const membershipNames: Record<string, string> = {
  nexus: "VaultTrades Nexus",
  nexus_plus: "VaultTrades Nexus Plus",
  vortex: "VaultTrades Vortex",
};

export default function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/profile";
  const referralCode = (searchParams.get("ref") || "").trim().toUpperCase();
  const nextParams = new URLSearchParams(next.split("?")[1] || "");
  const checkoutPlan = next.startsWith("/membership/checkout") ? nextParams.get("plan") || "" : "";
  const checkoutName = membershipNames[checkoutPlan] || "your selected VaultTrades membership";
  const isCheckoutRegistration = Boolean(checkoutPlan);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [cellphone, setCellphone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "");
    if (referralCode) {
      document.cookie = "vaulttrades_referral_code=" + encodeURIComponent(referralCode) + "; Max-Age=2592000; Path=/; SameSite=Lax" + (window.location.protocol === "https:" ? "; Secure" : "");
    }
    const siteUrl = configuredSiteUrl || window.location.origin;
    const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/profile";
    document.cookie = "vaulttrades_auth_next=" + encodeURIComponent(safeNext) + "; Max-Age=86400; Path=/; SameSite=Lax" + (window.location.protocol === "https:" ? "; Secure" : "");
    const confirmationRedirect = siteUrl + "/auth/callback?next=" + encodeURIComponent(safeNext);

    const { data, error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: confirmationRedirect,
        data: {
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          cellphone: cellphone.trim() || null,
          referred_by: referralCode || null,
        },
      },
    });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    if (!data.session) {
      window.localStorage.setItem("vaulttrades_pending_signup_email", email.trim());
      router.replace("/auth/verify-email?next=" + encodeURIComponent(safeNext));
      return;
    }

    window.location.assign(safeNext);
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md space-y-6">
        <div>
          <div className="text-xs font-bold tracking-[0.18em] text-amber-500">VAULTTRADES</div>
          <h1 className="text-3xl font-semibold mt-3">Create your VaultTrades profile</h1>
          {isCheckoutRegistration ? (
            <div className="mt-4 rounded-xl border border-amber-500/40 bg-amber-500/5 p-4 space-y-2">
              <p className="font-semibold">{checkoutName} checkout</p>
              <p className="text-sm text-muted-foreground">You are creating your VaultTrades profile to complete this membership purchase through partner {referralCode || nextParams.get("ref") || "referral"}.</p>
              <p className="text-sm text-muted-foreground">After you submit this form, check your email and verify your address. You will then return to the same checkout. Your plan and partner reference will be preserved. Creating a profile does not charge you or complete checkout automatically.</p>
            </div>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">Create your account before accessing member features.</p>
          )}
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input className="w-full rounded-md border p-3" required placeholder="First name" autoComplete="given-name" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
          <input className="w-full rounded-md border p-3" required placeholder="Last name" autoComplete="family-name" value={lastName} onChange={(e) => setLastName(e.target.value)} />
          <input className="w-full rounded-md border p-3" type="tel" placeholder="Cellphone (optional)" autoComplete="tel" value={cellphone} onChange={(e) => setCellphone(e.target.value)} />
          <input className="w-full rounded-md border p-3" type="email" required placeholder="Email address" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input className="w-full rounded-md border p-3" type="password" required minLength={8} placeholder="Password (8+ characters)" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
          <button className="w-full rounded-md border px-4 py-3 font-medium disabled:opacity-50" disabled={loading} type="submit">{loading ? "Creating profile…" : "Create VaultTrades profile"}</button>
        </form>
        <p className="text-sm">Already have a VaultTrades account? <a className="underline" href={"/auth/login?next=" + encodeURIComponent(next)}>Log in</a></p>
      </div>
    </main>
  );
}
