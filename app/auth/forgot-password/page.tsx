"use client";

import { FormEvent, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");
    setLoading(true);

    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const redirectTo = `${window.location.origin}/auth/reset-password`;
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo,
    });

    if (resetError) {
      setError(resetError.message);
    } else {
      setMessage("If an account exists for that email address, a password reset link has been sent.");
    }
    setLoading(false);
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md space-y-6">
        <div>
          <h1 className="text-3xl font-semibold">Reset your password</h1>
          <p className="mt-2 text-sm text-muted-foreground">Enter your email and we will send you a password reset link.</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input className="w-full rounded-md border p-3" type="email" required autoComplete="email" placeholder="Email address" value={email} onChange={(e) => setEmail(e.target.value)} />
          {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
          {message && <p className="text-sm" role="status">{message}</p>}
          <button className="w-full rounded-md border px-4 py-3 font-medium disabled:opacity-50" disabled={loading} type="submit">{loading ? "Sending…" : "Send reset link"}</button>
        </form>
        <p className="text-sm"><a className="underline" href="/auth/login">Back to login</a></p>
      </div>
    </main>
  );
}
