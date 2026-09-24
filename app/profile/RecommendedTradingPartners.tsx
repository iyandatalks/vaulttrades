"use client";

const partners = [
  {
    category: "RECOMMENDED BROKER",
    name: "XM Broker",
    bestFor: "Beginners to experienced traders who want MT4/MT5 access, Gold (XAUUSD) and multi-asset trading.",
    why: [
      "MT4 and MT5 support",
      "Forex, Gold and other markets",
      "Negative balance protection",
      "Flexible leverage, depending on account and jurisdiction",
    ],
    offer: "Join through my referral link for the current VaultTrades partner offer.",
    href: "https://www.xmza.com/referral?token=9TMOAfWroLZu69ys2-IUqg",
    cta: "Open XM Account",
  },
  {
    category: "RECOMMENDED BROKER",
    name: "Headway",
    bestFor: "Traders who value flexible execution conditions, MT4/MT5 and access to Forex, Gold, indices and other instruments.",
    why: [
      "MT4 and MT5 support",
      "Pro account spreads from 0.0 pips",
      "350+ trading instruments",
      "South African FSCA-regulated operating entity",
    ],
    offer: "Join through my referral link for the current VaultTrades partner offer.",
    href: "https://headway.partners/user/signup?hwp=d93922",
    cta: "Open Headway Account",
  },
  {
    category: "RECOMMENDED PROP FIRM",
    name: "Top One Trader",
    bestFor: "Traders looking for structured 1-step and 2-step evaluation models.",
    why: [
      "Multiple evaluation models",
      "Clear risk and payout requirements",
      "Bi-weekly payouts on applicable funded programs",
      "Optional payout upgrades on eligible models",
    ],
    offer: "50% OFF all my trading products when you join through my link.",
    href: "https://toponetrader.com/?linkId=lp_148658&sourceId=sibongilesz2017gmailcom&tenantId=toponetrader",
    cta: "Start Top One Trader Challenge",
  },
  {
    category: "RECOMMENDED PROP FIRM",
    name: "Goat Funded Trader",
    bestFor: "Traders comparing challenge and instant-funding models.",
    why: [
      "1-step, 2-step and instant funding models",
      "MT5 available for eligible clients",
      "Up to $2M simulated capital advertised",
      "Model-specific reward, drawdown and trading-day structures",
    ],
    offer: "Review the exact model rules and current promotion before purchasing.",
    href: "https://www.goatfundedtrader.com/",
    cta: "Explore Goat Funded Trader",
  },
  {
    category: "RECOMMENDED PROP FIRM",
    name: "Blue Guardian",
    bestFor: "Traders who want a choice between instant funding and evaluation models.",
    why: [
      "Instant and evaluation models are available",
      "Funded profit splits vary by model, with up to 90% advertised on eligible plans",
      "Payout options include instant/on-demand structures on eligible accounts",
      "EAs are allowed on eligible accounts",
    ],
    offer: "Review the exact account model, drawdown and payout rules before joining.",
    href: "https://blueguardian.com/?afmc=2dw1",
    cta: "Open Blue Guardian",
  },
] as const;

function PartnerCard({ partner }: { partner: typeof partners[number] }) {
  return (
    <article className="vt-info-card" style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div className="vt-label">{partner.category}</div>
      <h2 style={{ marginTop: 10 }}>{partner.name}</h2>

      <p style={{ marginTop: 10 }}>
        <strong>Best for:</strong> {partner.bestFor}
      </p>

      <p style={{ marginTop: 14, marginBottom: 6 }}>
        <strong>Why I recommend it:</strong>
      </p>

      <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.75 }}>
        {partner.why.map((item) => <li key={item}>{item}</li>)}
      </ul>

      <p className="muted" style={{ marginTop: 14 }}>{partner.offer}</p>

      <div style={{ marginTop: "auto", paddingTop: 18 }}>
        <a
          className="vt-primary"
          href={partner.href}
          target="_blank"
          rel="noopener noreferrer"
          style={{ display: "inline-block" }}
        >
          {partner.cta} →
        </a>
      </div>
    </article>
  );
}

export default function RecommendedTradingPartners() {
  return (
    <section style={{ marginTop: 28 }}>
      <div className="vt-info-card" style={{ textAlign: "left" }}>
        <div className="vt-label">TRADING PARTNERS</div>
        <h2 style={{ margin: "10px 0 8px", fontSize: 30 }}>
          Trade With the Right Partners — Brokers & Prop Firms I Personally Recommend
        </h2>
        <p style={{ marginTop: 10, fontSize: 18, fontWeight: 700 }}>
          Tested. Trusted. Built for serious traders.
        </p>
        <p style={{ marginTop: 10, maxWidth: 850 }}>
          Your broker or prop firm matters. Execution conditions, platform support, risk rules and payout requirements can materially affect how you trade. These are the platforms I personally recommend based on the way I trade and the type of trading workflow VaultTrades supports.
        </p>

        <div className="vt-info-card" style={{ marginTop: 18, background: "rgba(212,166,55,.05)" }}>
          <h3 style={{ marginTop: 0 }}>Why I recommend these platforms</h3>
          <ul style={{ margin: "10px 0 0", paddingLeft: 22, lineHeight: 1.8 }}>
            <li>I’ve tested execution quality.</li>
            <li>I’ve evaluated withdrawals and reliability.</li>
            <li>I only partner with platforms I trust.</li>
            <li>They align with my trading style, including XAUUSD and structure-based trading.</li>
            <li>I don’t recommend everything — only platforms I would use myself.</li>
          </ul>
        </div>
      </div>

      <div className="vt-label" style={{ marginTop: 28, marginBottom: 12 }}>RECOMMENDED BROKERS</div>
      <div className="vt-info-grid">
        {partners.filter((partner) => partner.category === "RECOMMENDED BROKER").map((partner) => (
          <PartnerCard key={partner.name} partner={partner} />
        ))}
      </div>

      <div className="vt-label" style={{ marginTop: 28, marginBottom: 12 }}>RECOMMENDED PROP FIRMS</div>
      <div className="vt-info-grid">
        {partners.filter((partner) => partner.category === "RECOMMENDED PROP FIRM").map((partner) => (
          <PartnerCard key={partner.name} partner={partner} />
        ))}
      </div>

      <div className="vt-info-card" style={{ marginTop: 18 }}>
        <p className="muted" style={{ margin: 0 }}>
          External partner links may be referral links. Availability, regulation, account conditions, promotions, trading rules and payout requirements can vary by jurisdiction and account model. Review the provider’s current terms before opening an account or purchasing a challenge.
        </p>
      </div>
    </section>
  );
}
