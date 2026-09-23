import { redirect } from "next/navigation";
import { createClient } from "../../../lib/supabase/server";
import { getProductAccess } from "../../../lib/product-access";

const BOOKING_URL = "https://calendar.app.google/RpASwPtYb89kaDPV8";

export default async function FoundersBookingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login?next=/founders-mentorship/booking");

  const access = await getProductAccess(user.id);
  if (!access.foundersMentorship) redirect("/products");

  return (
    <main className="shell">
      <section className="card">
        <div className="section-label">FOUNDERS MENTORSHIP · PAYMENT CONFIRMED</div>
        <h1 className="title">Book your 1-hour one-on-one session</h1>
        <p className="muted">Your Founders Mentorship entitlement is active. Use the calendar below to book your one-on-one mentorship session for the 7-day program.</p>
        <div className="vt-actions" style={{ marginTop: 22 }}>
          <a className="primary" href={BOOKING_URL} target="_blank" rel="noreferrer">Open booking calendar</a>
          <a className="secondary" href="/founders-mentorship">Open Founders Mentorship</a>
        </div>
      </section>
    </main>
  );
}
