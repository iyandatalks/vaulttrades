import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

export default async function AdminRevenueModelPage() {
  const auth = await createClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) redirect("/auth/login?next=/admin/revenue-model");
  const db = createServiceClient();
  const { data: profile } = await db.from("users").select("role")
    .eq("auth_user_id", user.id).maybeSingle();
  if (profile?.role !== "admin") redirect("/");

  return (
    <main className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8 text-white">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-400">Private · Admin only</p>
        <h1 className="mt-2 text-3xl font-bold">VaultTrades Revenue Model</h1>
        <p className="mt-2 text-sm text-white/65">Internal planning document. Not visible to members or prospects.</p>
        <Link href="/profile" className="mt-4 inline-block text-sm font-semibold text-amber-400">← Back to profile</Link>
      </div>

      <section className="rounded-2xl border border-amber-400/30 bg-white/[0.03] p-5">
        <h2 className="text-xl font-semibold">1. Membership and reseller model</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-white/75">
          <li>Plan 1 — VaultTrades Nexus: $150 once-off.</li>
          <li>Plan 2 — VaultTrades Nexus Plus: $250 once-off.</li>
          <li>Plan 3 — VaultTrades Nexus Vortex: $550 once-off.</li>
          <li>A member should be able to refer any of the three plans, regardless of which plan they personally purchased.</li>
          <li>Working proposal: 100% commission on the qualifying membership plan personally sold by that member. No downline, multi-level or network commission is intended.</li>
          <li>The commission applies to the membership sale only. It is not a promise of trading profit or a guaranteed income.</li>
        </ul>
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <h2 className="text-xl font-semibold">2. VaultTrades revenue channels</h2>
        <ol className="mt-3 list-decimal space-y-3 pl-5 text-sm leading-6 text-white/75">
          <li><strong className="text-white">Trading products:</strong> sales/licensing of VaultTrades Nexus, Nexus Plus, Vortex and Analyzer, where those products are separately chargeable.</li>
          <li><strong className="text-white">Website services:</strong> optional member website setup and annual hosting/maintenance. Previously discussed pricing was $150 setup and $39 annually; a possible $49 setup figure was also mentioned and must be confirmed before publishing or charging it.</li>
          <li><strong className="text-white">Community:</strong> a possible $5 monthly community fee was discussed, but Plan 1 was also described as having free community access. Decide whether the community is free, paid, or tiered before implementation.</li>
          <li><strong className="text-white">Broker partnerships:</strong> affiliate/referral revenue from approved broker relationships and qualifying referred activity. Disclose that brokers are independent third parties and do not imply that deposits or trading activity produce a fixed commission.</li>
          <li><strong className="text-white">Other digital products:</strong> direct product sales and approved external affiliate arrangements under each partner's terms.</li>
        </ol>
      </section>

      <section className="rounded-2xl border border-amber-400/30 bg-white/[0.03] p-5">
        <h2 className="text-xl font-semibold">3. Critical decisions before checkout is enabled</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-white/75">
          <li><strong className="text-white">EA inclusion:</strong> confirm whether each plan's EA is included in the membership fee or whether the membership grants reseller/business access while the EA licence is purchased separately. Do not charge or promise the same EA twice.</li>
          <li><strong className="text-white">100% commission basis:</strong> decide whether “100%” means the gross plan price or the amount after PayPal processing fees, refunds and chargebacks. If it is gross, identify who absorbs payment fees.</li>
          <li><strong className="text-white">Refunds and reversals:</strong> commission must be reversed or withheld for refunded, disputed, fraudulent or charged-back sales. Set a payout hold/reconciliation policy.</li>
          <li><strong className="text-white">Website ownership and access:</strong> VaultTrades may administer the website and technical integration, but define the member's domain ownership, content rights, access level, cancellation and handover terms in writing.</li>
          <li><strong className="text-white">Community and website pricing:</strong> confirm the $5/month community proposal and resolve the $49 versus $150 setup discussion and $39 annual maintenance before showing a final price.</li>
          <li><strong className="text-white">Existing referral programme:</strong> keep the current 20% eligible-product referral programme separate from this proposed 100% membership reseller commission. Do not merge or overwrite the existing rules without an explicit migration decision.</li>
        </ul>
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <h2 className="text-xl font-semibold">4. Recommended payment and attribution flow</h2>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-6 text-white/75">
          <li>Generate a unique VaultTrades referral URL for each member and each plan. The URL identifies the referrer and selected plan.</li>
          <li>Keep the checkout/order creation and verified PayPal webhook on VaultTrades' server. The referral URL can be the member's shareable link; the payment processor and webhook should not be controlled by an unconnected third-party account.</li>
          <li>On a verified completed payment event, record the order, customer, plan, referrer, gross amount, currency, PayPal fee, refund state and commission liability in a ledger.</li>
          <li>Do not treat the browser return/success page as proof of payment. Confirm payment server-to-server through PayPal's verified webhook/capture status.</li>
          <li>Calculate and release the reseller commission only under the approved policy, after the applicable refund/dispute checks.</li>
          <li>Keep website setup, hosting, EA licences, Analyzer access and broker affiliate activity as separate ledger categories so each revenue source is measurable.</li>
        </ol>
        <p className="mt-4 text-xs leading-6 text-white/50">PayPal marketplace split payments are not assumed. PayPal's current South African eligibility table limits the listed seller options, and its multiparty platform capabilities require partner approval. A VaultTrades-managed checkout with a commission ledger and compliant payouts is the safer design to evaluate first; confirm eligibility directly with PayPal before development.</p>
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <h2 className="text-xl font-semibold">5. Operating principle</h2>
        <p className="mt-3 text-sm leading-7 text-white/75">Members receive the agreed commission for their own qualifying membership sales. VaultTrades earns from its own products and services, optional website services, and disclosed third-party affiliate relationships. There is no downline commission. Every payment, product entitlement and commission must be traceable to a real order and clear terms.</p>
      </section>
    </main>
  );
}
