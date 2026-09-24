"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/profile";
  const [email, setEmail] = useState("");
  const [resending, setResending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const pendingEmail = window.localStorage.getItem("vaulttrades_pending_signup_email") || "";
    setEmail(pendingEmail);
  }, []);

  async function resend() {
    const value = email.trim();
    if (!value) {
      setError("Enter the email address you used to create your VaultTrades account.");
      return;
    }

    setResending(true);
    setMessage("");
    setError("");

    const sb = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const safeNext = next.startsWith("/") ? next : "/profile";
    const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "");
    const siteUrl = configuredSiteUrl || window.location.origin;
    document.cookie = "vaulttrades_auth_next=" + encodeURIComponent(safeNext) + "; Max-Age=600; Path=/; SameSite=Lax" + (window.location.protocol === "https:" ? "; Secure" : "");
    const emailRedirectTo = siteUrl + "/auth/callback";

    const { error: resendError } = await sb.auth.resend({
      type: "signup",
      email: value,
      options: { emailRedirectTo },
    });

    if (resendError) setError(resendError.message);
    else setMessage("A new VaultTrades verification email has been sent. Check your inbox and spam folder.");

    setResending(false);
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <section className="w-full max-w-lg space-y-6">
        <div>
          <div className="text-xs font-bold tracking-[0.18em]">VAULTTRADES</div>
          <h1 className="text-3xl font-semibold mt-3">Verify your VaultTrades account</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            We have sent a verification email for your new VaultTrades account. You must verify your email before signing in.
          </p>
        </div>

        <div className="rounded-xl border p-5 space-y-4">
          <strong>Check your email</strong>
          <p className="text-sm text-muted-foreground">
            Look for the VaultTrades verification message in your inbox. If you do not see it, check your spam or promotions folder.
          </p>

          <label className="block text-sm font-medium" htmlFor="verification-email">Email address</label>
          <input
            id="verification-email"
            className="w-full rounded-md border p-3"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email address"
          />

          {message && <p className="text-sm" role="status">{message}</p>}
          {error && <p className="text-sm text-red-600" role="alert">{error}</p>}

          <button
            className="w-full rounded-md border px-4 py-3 font-medium disabled:opacity-50"
            onClick={() => void resend()}
            disabled={resending}
            type="button"
          >
            {resending ? "Sending…" : "Resend verification email"}
          </button>

          <div className="flex gap-4 flex-wrap">
            <Link className="text-sm underline" href="/auth/login">Go to login</Link>
            <Link className="text-sm underline" href="/products">Back to products</Link>
          </div>
        </div>
      </section>
    </main>
  );
}


export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen flex items-center justify-center p-6">
        <section className="w-full max-w-lg">
          <div className="text-xs font-bold tracking-[0.18em]">VAULTTRADES</div>
          <h1 className="text-3xl font-semibold mt-3">Verify your VaultTrades account</h1>
          <p className="mt-2 text-sm text-muted-foreground">Preparing your verification instructions…</p>
        </section>
      </main>
    }>
      <VerifyEmailContent />
    </Suspense>
  );
}
