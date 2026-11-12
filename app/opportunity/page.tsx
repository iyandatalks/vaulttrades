import "./opportunity.css";

import Link from "next/link";

const pillars = [
  {
    number: "01",
    title: "TRADE WITH A PLAN",
    description: "Build a repeatable routine around market preparation, valid setups, defined risk and deliberate execution. A good trading day can also mean choosing not to trade.",
  },
  {
    number: "02",
    title: "USE THE RIGHT TOOLS",
    description: "Bring analysis, risk management, trade journaling and execution support into one connected VaultTrades environment.",
  },
  {
    number: "03",
    title: "BUILD A DIGITAL BUSINESS",
    description: "Develop practical online marketing skills and, where your membership permits, introduce VaultTrades products through an attributed reseller opportunity.",
  },
];

const workflow = [
  ["01", "PREPARE", "Review the market, identify important levels and wait for conditions that fit your chosen strategy."],
  ["02", "PLAN", "Define the entry idea, invalidation point, position size and risk before placing a trade."],
  ["03", "EXECUTE OR WAIT", "Follow the plan when a valid setup appears. Do not force a trade simply to create activity."],
  ["04", "REVIEW", "Record the decision, outcome and lessons so your process can be assessed over time."],
];

const tools = [
  ["ANALYZER", "Evaluate market structure, liquidity, order blocks, Fibonacci levels and strategy conditions to support discretionary trade planning.", "/analyzer"],
  ["RISK MANAGER", "Calculate position size and planned exposure so risk is considered before execution.", "/risk-manager"],
  ["JOURNAL", "Record trades, review decisions and build a clearer picture of your execution history.", "/journal"],
  ["AI COACH", "Explore trading concepts, strategy conditions and decision-making questions with an AI-supported learning tool.", "/ai-coach"],
  ["COPY TRADING", "Explore the MT5 copy-trading service and its account-connection requirements.", "/copy"],
  ["COMMUNITY", "Connect with the VaultTrades online trading community and follow product and learning updates.", "/vaulttrades-community"],
];

const learning = [
  ["FOUNDATION", "Understand the products, the trading process and the importance of managing risk."],
  ["ATTRACTION", "Learn to communicate clearly, create useful content and introduce people to relevant resources."],
  ["ENGAGEMENT", "Build trust through education, transparent explanations and consistent follow-up."],
  ["CONVERSION", "Understand the approved product plans, customer journey and reseller attribution process."],
  ["LEVERAGING", "Use digital tools and AI responsibly to support content planning and business organisation."],
  ["DEVELOPMENT", "Review what is working, improve your skills and build at a pace that suits your circumstances."],
];

const faqs = [
  ["Do I need trading experience?", "You can begin by learning the process and the tools, but trading is a skill that requires study, practice and sound risk management. No experience does not mean no learning is required."],
  ["Will I make money every day?", "No. VaultTrades does not promise daily profits or a fixed income. There may be days when no suitable setup appears, and trading can result in losses."],
  ["Does a larger trading account guarantee a larger daily profit?", "No. Account capital can affect the monetary size of a position when risk rules are applied, but it does not create a profitable setup or remove the possibility of loss. Returns are never guaranteed."],
  ["Can I resell VaultTrades products?", "Reseller rights and commission limits depend on the membership plan you purchase and the applicable reseller terms. A member may only earn within their own plan's commission entitlement on a qualifying sale."],
  ["Do I keep 100% of every sale?", "Not necessarily. Under the proposed VaultTrades reseller structure, commission is capped by the reseller's own plan entitlement. The applicable checkout, fees, refunds and payout terms will be shown in the reseller agreement."],
  ["Is VaultTrades a prop firm or broker?", "No. VaultTrades is a separate technology, education and trading-tools business. Brokers and proprietary trading firms are independent third parties."],
];

export default function OpportunityPage() {
  return (
    <main className="vt-opportunity">
      <section className="vto-hero">
        <div className="vto-hero-image" role="img" aria-label="VaultTrades lifestyle workspace" />
        <div className="vto-hero-shade" />
        <div className="vto-hero-content">
          <div className="vto-kicker">THE VAULTTRADES OPPORTUNITY</div>
          <div className="vto-brand">VAULT<span>TRADES</span></div>
          <h1>Trade with structure.<br /><em>Build with purpose.</em></h1>
          <p className="vto-hero-lead">One connected ecosystem for a more disciplined trading process—and the opportunity to build a digital business around products and tools you understand.</p>
          <div className="vto-hero-actions">
            <a className="vto-button vto-button-gold" href="#the-blueprint">DISCOVER THE BLUEPRINT</a>
            <Link className="vto-button vto-button-outline" href="/products">EXPLORE THE TOOLS</Link>
          </div>
          <div className="vto-hero-foot">FOCUS. DISCIPLINE. CONSISTENCY.</div>
        </div>
        <div className="vto-hero-caption">A process you can follow. A business you can build at your own pace.</div>
      </section>

      <section className="vto-intro vto-container" id="the-blueprint">
        <div className="vto-kicker">MORE THAN A TRADING TOOL</div>
        <h2>Two opportunities.<br /><span>One connected ecosystem.</span></h2>
        <p className="vto-lead">VaultTrades brings together a structured approach to trading, practical technology and a digital-business pathway. Start by understanding the process. Explore the tools. Then decide how you want to participate.</p>
        <div className="vto-pillars">
          {pillars.map((item) => (
            <article className="vto-pillar" key={item.number}>
              <div className="vto-number">{item.number}</div>
              <h3>{item.title}</h3>
              <p>{item.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="vto-dark-band">
        <div className="vto-container vto-split">
          <div>
            <div className="vto-kicker">THE DAILY TRADING BLUEPRINT</div>
            <h2>One plan at a time.<br /><span>No chasing. No forcing.</span></h2>
            <p>Our approach centres on preparation, patience and risk awareness. The objective is not to take a trade every day. It is to recognise when conditions align with a plan—and to stay out when they do not.</p>
            <Link className="vto-inline-link" href="/how-it-works">Explore how VaultTrades works <span>→</span></Link>
          </div>
          <div className="vto-workflow">
            {workflow.map(([number, title, description]) => (
              <article className="vto-step" key={number}>
                <span>{number}</span>
                <div><h3>{title}</h3><p>{description}</p></div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="vto-container vto-section">
        <div className="vto-section-heading">
          <div className="vto-kicker">THE VAULTTRADES ECOSYSTEM</div>
          <h2>Tools that support the process.</h2>
          <p>Each product has a defined role. Availability and access depend on the product or membership entitlement shown at checkout.</p>
        </div>
        <div className="vto-tools">
          {tools.map(([title, description, href], index) => (
            <article className="vto-tool" key={title}>
              <div className="vto-tool-top"><span>0{index + 1}</span><i /></div>
              <h3>{title}</h3>
              <p>{description}</p>
              <Link href={href}>LEARN MORE <span>→</span></Link>
            </article>
          ))}
        </div>
      </section>

      <section className="vto-capital">
        <div className="vto-container vto-capital-grid">
          <div>
            <div className="vto-kicker">CAPITAL & RISK</div>
            <h2>Understand the opportunity.<br /><span>Respect the risk.</span></h2>
          </div>
          <div>
            <p>Trading capital influences the position size and monetary value of a market move when risk is calculated appropriately. It does not determine whether a trade will win, how often a setup will appear, or how much a trader will earn.</p>
            <p>Our focus is on helping traders plan exposure before execution—not advertising a fixed daily income. Results vary, and losses are possible regardless of account size.</p>
            <Link className="vto-inline-link" href="/risk-manager">Explore the Risk Manager <span>→</span></Link>
          </div>
        </div>
      </section>

      <section className="vto-container vto-section vto-business">
        <div className="vto-business-copy">
          <div className="vto-kicker">THE DIGITAL BUSINESS PATHWAY</div>
          <h2>Learn to attract.<br /><span>Build trust. Create opportunity.</span></h2>
          <p>VaultTrades is also developing a reseller pathway for members who want to learn how to introduce digital products and tools to an audience. It starts with understanding what you offer, who it can help and how to communicate its value honestly.</p>
          <p>Depending on the plan purchased, members may receive reseller rights to eligible VaultTrades products. Commission entitlement is linked to the member's own plan and qualifying completed sales.</p>
        </div>
        <div className="vto-business-list">
          {[
            ["01", "CLARITY", "Understand the products, audience and value proposition."],
            ["02", "CONTENT", "Create useful, authentic content that educates rather than overpromises."],
            ["03", "CONNECTION", "Build relationships through transparent communication and follow-up."],
            ["04", "RESELL", "Share eligible products using your assigned attribution and approved terms."],
          ].map(([number, title, description]) => (
            <div className="vto-business-row" key={number}><span>{number}</span><div><b>{title}</b><p>{description}</p></div></div>
          ))}
        </div>
      </section>

      <section className="vto-learning-band">
        <div className="vto-container">
          <div className="vto-section-heading">
            <div className="vto-kicker">A LEARNING PATH YOU CAN FOLLOW</div>
            <h2>Build skills step by step.</h2>
            <p>The pathway is designed to make the process understandable. Learn the foundations first, then build on them with practice.</p>
          </div>
          <div className="vto-learning-grid">
            {learning.map(([title, description], index) => (
              <article key={title}><span>PHASE 0{index + 1}</span><h3>{title}</h3><p>{description}</p></article>
            ))}
          </div>
        </div>
      </section>

      <section className="vto-evidence">
        <div className="vto-container vto-evidence-inner">
          <div className="vto-kicker">THE JOURNEY. THE PROCESS. THE RECORD.</div>
          <h2>Progress should be <span>documented.</span></h2>
          <p>We are building a transparent performance and milestone gallery for dated trading examples, challenge progress and certificates. Evidence will be added after review, with third-party branding and private account details handled appropriately. No results are implied before supporting records are published.</p>
          <div className="vto-evidence-cards">
            <div><span>01</span><b>TRADING RECORDS</b><small>Individual trade examples with entry, exit and outcome context.</small><em>GALLERY BEING PREPARED</em></div>
            <div><span>02</span><b>CHALLENGE JOURNEY</b><small>Dated progress and milestones, clearly identified as historical or current.</small><em>GALLERY BEING PREPARED</em></div>
            <div><span>03</span><b>CERTIFICATES</b><small>Supporting credentials and certificates with accurate issuer context.</small><em>GALLERY BEING PREPARED</em></div>
          </div>
        </div>
      </section>

      <section className="vto-container vto-section vto-faq">
        <div className="vto-section-heading">
          <div className="vto-kicker">GOOD QUESTIONS. CLEAR ANSWERS.</div>
          <h2>Before you get started.</h2>
        </div>
        <div className="vto-faq-list">
          {faqs.map(([question, answer]) => (
            <details key={question}><summary>{question}<span>+</span></summary><p>{answer}</p></details>
          ))}
        </div>
      </section>

      <section className="vto-final">
        <div className="vto-container">
          <div className="vto-kicker">YOUR NEXT STEP</div>
          <h2>Understand the opportunity.<br /><span>Choose your direction.</span></h2>
          <p>Explore the VaultTrades products and services, ask questions and decide whether the trading and digital-business pathways fit your goals and circumstances.</p>
          <div className="vto-final-actions">
            <Link className="vto-button vto-button-gold" href="/products">EXPLORE VAULTTRADES PRODUCTS</Link>
            <a className="vto-button vto-button-outline" href="https://wa.me/27746653633?text=Hello%20VaultTrades%2C%20I%20would%20like%20to%20understand%20the%20VaultTrades%20opportunity." target="_blank" rel="noopener noreferrer">ASK A QUESTION</a>
          </div>
          <small>Trading involves risk. Past performance does not guarantee future results. Reseller commissions are not guaranteed and depend on qualifying sales and the applicable plan terms.</small>
        </div>
      </section>
    </main>
  );
}
