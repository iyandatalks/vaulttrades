import { Suspense } from "react";
import RegisterForm from "./RegisterForm";

export default function RegisterPage() {
  return (
    <Suspense fallback={<main className="min-h-screen flex items-center justify-center p-6">Loading…</main>}>
      <RegisterForm />
    </Suspense>
  );
}
