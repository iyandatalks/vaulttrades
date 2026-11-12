import Link from "next/link";

export default function PlansPage() {
  return (
    <main className="vt-plans-placeholder">
      <section>
        <div>VAULTTRADES MEMBERSHIP</div>
        <h1>Choose the pathway<br /><span>that fits your goals.</span></h1>
        <p>The new membership and reseller plans are being prepared. Plan prices, access, reseller entitlements and commission limits will be displayed together before you are asked to create a profile or purchase.</p>
        <Link href="/opportunity">BACK TO THE OPPORTUNITY</Link>
      </section>
    </main>
  );
}
