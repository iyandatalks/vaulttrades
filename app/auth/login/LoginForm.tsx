"use client";

import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/profile";
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

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (signInError) {
      setError(signInError.message);
      setLoading(false);
      return;
    }

    router.replace(next.startsWith("/") ? next : "/profile");
    router.refresh();
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md space-y-6">
        <div>
          <h1 className="text-3xl font-semibold">Log in to VaultTrades</h1>
          <p className="mt-2 text-sm text-muted-foreground">Sign in to continue to VaultTrades.</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input className="w-full rounded-md border p-3" type="email" required autoComplete="email" placeholder="Email address" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input className="w-full rounded-md border p-3" type="password" required autoComplete="current-password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
          {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
          <button className="w-full rounded-md border px-4 py-3 font-medium disabled:opacity-50" disabled={loading} type="submit">{loading ? "Signing in…" : "Log in"}</button>
        </form>
        <a className="text-sm underline" href="/auth/forgot-password">Forgot your password?</a>
        <p className="text-sm">Don&apos;t have an account? <a className="underline" href="/auth/register">Create an account</a></p>
      </div>
    </main>
  );
}
