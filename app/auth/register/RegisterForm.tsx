"use client";

import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";

export default function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/profile";
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [cellphone, setCellphone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);

    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { data, error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          cellphone: cellphone.trim() || null,
        },
      },
    });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    if (!data.session) {
      setMessage("Account created. Check your email to confirm your account, then log in.");
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
          <h1 className="text-3xl font-semibold">Create your VaultTrades account</h1>
          <p className="mt-2 text-sm text-muted-foreground">Create your account before accessing member features.</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input className="w-full rounded-md border p-3" required placeholder="First name" autoComplete="given-name" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
          <input className="w-full rounded-md border p-3" required placeholder="Last name" autoComplete="family-name" value={lastName} onChange={(e) => setLastName(e.target.value)} />
          <input className="w-full rounded-md border p-3" type="tel" placeholder="Cellphone (optional)" autoComplete="tel" value={cellphone} onChange={(e) => setCellphone(e.target.value)} />
          <input className="w-full rounded-md border p-3" type="email" required placeholder="Email address" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input className="w-full rounded-md border p-3" type="password" required minLength={8} placeholder="Password (8+ characters)" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
          {message && <p className="text-sm" role="status">{message}</p>}
          <button className="w-full rounded-md border px-4 py-3 font-medium disabled:opacity-50" disabled={loading} type="submit">{loading ? "Creating account…" : "Create account"}</button>
        </form>
        <p className="text-sm">Already have an account? <a className="underline" href="/auth/login">Log in</a></p>
      </div>
    </main>
  );
}
