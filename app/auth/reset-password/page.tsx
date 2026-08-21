"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { useEffect, useState as useStateAlias } from "react";
import { createBrowserClient } from "@supabase/ssr";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    supabase.auth.getSession().then(({ data }) => setReady(Boolean(data.session)));
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setError(updateError.message);
      setLoading(false);
      return;
    }
    setMessage("Password updated successfully. You can now log in with your new password.");
    setLoading(false);
    setTimeout(() => router.replace("/auth/login"), 1000);
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md space-y-6">
        <h1 className="text-3xl font-semibold">Create a new password</h1>
        {!ready && <p className="text-sm text-muted-foreground">Open this page from the password-reset email.</p>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <input className="w-full rounded-md border p-3" type="password" required minLength={8} autoComplete="new-password" placeholder="New password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <input className="w-full rounded-md border p-3" type="password" required minLength={8} autoComplete="new-password" placeholder="Confirm new password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
          {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
          {message && <p className="text-sm" role="status">{message}</p>}
          <button className="w-full rounded-md border px-4 py-3 font-medium disabled:opacity-50" disabled={loading || !ready} type="submit">{loading ? "Updating…" : "Update password"}</button>
        </form>
      </div>
    </main>
  );
}
