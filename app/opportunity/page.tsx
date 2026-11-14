import "./opportunity.css";
import OpportunityIncomeSection from "./OpportunityIncomeSection";
import Link from "next/link";
import fs from "node:fs";
import path from "node:path";

const stages = [
  ["01", "PREPARE", "Understand the market environment, set your priorities and wait for conditions that fit a defined plan."],
  ["02", "PLAN", "Consider the setup, the risk and the decision before taking action."],
  ["03", "EXECUTE WITH DISCIPLINE", "Follow the process when conditions are present. Do not force activity just to feel productive."],
  ["04", "REVIEW", "Reflect on decisions, record lessons and improve the process over time."],
];

const learningSteps = [
  ["FOUNDATION", "Understand the opportunity, the expectations and the importance of managing risk."],
  ["DEVELOP", "Build practical knowledge through structured learning and guided support."],
  ["PARTICIPATE", "Explore the trading and digital pathways available within the ecosystem."],
  ["CONNECT", "Learn how to communicate value, build relationships and grow a network."],
  ["EXPAND", "Explore selected digital products and external affiliate opportunities."],
  ["SCALE", "Develop your skills and build consistently over time, without relying on quick-result promises."],
];

const faqs = [
  ["Do I need trading experience?", "You can begin by learning the foundations, but trading requires study, practice and risk awareness. No experience does not mean no learning is required."],
  ["Will automated trading generate income every day?", "No. Automation can execute a defined strategy, but it cannot guarantee a trading opportunity, a winning trade or daily income. Trading can result in losses."],
  ["Is this only about trading?", "No. The wider opportunity also includes membership, selected digital products, learning and a scaling affiliate pathway. The options available depend on the membership selected."],
  ["Can I access individual digital products?", "Selected products may be available independently for people who want a particular capability without joining the wider membership ecosystem. Availability and terms are shown with the relevant product."],
  ["How does the membership opportunity work?", "Membership gives access to a defined set of benefits and may include eligibility for participation in the wider network. Any applicable commissions, qualifying conditions and payment terms are explained before a person joins."],
  ["Are trading returns or commissions guaranteed?", "No. Trading outcomes vary and losses are possible. Any commission depends on qualifying activity and the applicable terms. No income level or number of sales is promised."],
  ["Are brokers and proprietary trading firms part of VaultTrades?", "No. Brokers and proprietary trading firms are independent third parties. Their services are subject to their own terms and conditions."],
];

const resultStages = [
  {
    number: "01",
    title: "HUMBLE BEGINNINGS",
    marker: "BELOW $50",
    description: "The early part of the journey. Small beginnings can provide useful lessons about patience, process and risk.",
    visual: "vto-result-visual-beginning",
    visualLabel: "THE STARTING POINT",
  },
  {
    number: "02",
    title: "BUILDING CONSISTENCY",
    marker: "THE PROCESS OVER TIME",
    description: "A closer look at how individual outcomes fit into a longer trading record, including both wins and losses.",
    visual: "vto-result-visual-consistency",
    visualLabel: "DISCIPLINE AND REVIEW",
  },
  {
    number: "03",
    title: "SCALING UP",
    marker: "LARGER MILESTONES",
    description: "Examples of later milestones, shown with their dates, account context and supporting records.",
    visual: "vto-result-visual-scale",
    visualLabel: "GROWTH WITH CONTEXT",
  },
];

export default function OpportunityPage() {
  const evidenceGallery = getEvidenceGallery();
  return (
    <main className="vt-opportunity">
      <section className="vto-hero">
        <div className="vto-hero-image" role="img" aria-label="VaultTrades lifestyle workspace" />
        <div className="vto-hero-shade" />
        <div className="vto-hero-content">
          <div className="vto-kicker">WELCOME TO THE VAULTTRADES OPPORTUNITY</div>
          <div className="vto-brand">VAULT<span>TRADES</span></div>
          <h1>A process you can follow.<br /><em>A business you can build.</em></h1>
          <p className="vto-hero-lead">Explore a structured trading journey alongside a digital opportunity designed to help you develop skills, build connections and grow over time.</p>
          <div className="vto-hero-actions">
            <a className="vto-button vto-button-gold" href="#the-opportunity">EXPLORE THE OPPORTUNITY</a>
            <Link className="vto-button vto-button-outline" href="/plans">SEE HOW TO JOIN</Link>
          </div>
          <div className="vto-hero-foot">FOCUS. DISCIPLINE. CONSISTENCY.</div>
        </div>
        <div className="vto-hero-popouts" aria-label="The two parts of the opportunity">
          <div><span>01</span><strong>A PROCESS<br />YOU CAN FOLLOW</strong></div>
          <div><span>02</span><strong>A BUSINESS<br />YOU CAN BUILD</strong></div>
        </div>
      </section>

      <section className="vto-story vto-container" id="my-story">
        <div className="vto-story-photo-column">
          <div className="vto-story-photo-frame">
            <div className="vto-story-sun" aria-hidden="true" />
            <img
              className="vto-story-photo"
              src="/images/vaulttrades-lifestyle.jpg"
              alt="VaultTrades founder"
              loading="eager"
              fetchPriority="high"
            />
            <div className="vto-story-photo-caption">BUILT THROUGH EXPERIENCE</div>
          </div>
        </div>
        <div className="vto-story-copy">
          <div className="vto-kicker">THE PERSON BEHIND THE OPPORTUNITY</div>
          <h2>My journey started with a lesson in <span>experience.</span></h2>
          <p>I entered trading believing it could create a different future. Like many people who begin without enough experience, I made mistakes, lost money and became discouraged. I also explored other business opportunities, but found that many depended heavily on selling without giving me a clear structure to build around.</p>
          <p>Over time, I came to see that trading and digital business both require more than excitement. They need a process: learning, planning, risk awareness, disciplined execution and honest review. That is the thinking behind the VaultTrades ecosystem.</p>
          <p>This opportunity is about giving people a structured way to explore trading, digital tools and a business pathway—then decide for themselves whether it fits their goals and circumstances.</p>
          <div className="vto-story-signoff">FOCUS. DISCIPLINE. CONSISTENCY.</div>
          <Link className="vto-button vto-button-gold vto-story-cta" href="/start">EXPLORE THE OPPORTUNITY <span aria-hidden="true">→</span></Link>
        </div>
      </section>

      <section className="vto-intro vto-container" id="the-opportunity">
        <div className="vto-kicker">A DIFFERENT WAY TO THINK ABOUT YOUR NEXT MOVE</div>
        <h2>More than one pathway.<br /><span>One ecosystem to explore.</span></h2>
        <p className="vto-lead">VaultTrades brings together personal trading, membership, digital products and a scaling affiliate opportunity. You can explore the different pathways, understand what each involves and decide which membership fits your goals and circumstances.</p>
        <div className="vto-pillars">
          <article className="vto-pillar"><div className="vto-number">01</div><h3>PERSONAL TRADING</h3><p>Develop a structured approach to the markets, with learning and automation options designed around a defined trading process.</p></article>
          <article className="vto-pillar"><div className="vto-number">02</div><h3>MEMBERSHIP</h3><p>Become part of a wider ecosystem, develop your knowledge and explore the opportunity to build a network over time.</p></article>
          <article className="vto-pillar"><div className="vto-number">03</div><h3>DIGITAL PRODUCTS</h3><p>Explore selected digital products and individual access options for people looking for particular capabilities.</p></article>
          <article className="vto-pillar"><div className="vto-number">04</div><h3>SCALING AFFILIATE OPPORTUNITY</h3><p>Discover selected external partnerships and the potential to develop additional commission channels under their terms.</p></article>
        </div>
      </section>

      <section className="vto-automation-range vto-container" id="trading-automation">
        <div className="vto-kicker">THE VAULTTRADES TRADING AUTOMATION RANGE</div>
        <h2>Trading technology built around <span>a defined process.</span></h2>
        <p className="vto-automation-intro">VaultTrades develops trading tools and automated execution products to support a structured approach to the markets. Each automation product is part of the trading side of the VaultTrades business. Automation does not remove market risk or guarantee trading results.</p>
        <div className="vto-automation-grid">
          <article className="vto-automation-card"><span>01 · AUTOMATION</span><h3>VaultTrades Nexus – Automation</h3><p>Our core automated trading product for traders who want to apply a defined trading process.</p></article>
          <article className="vto-automation-card"><span>02 · AUTOMATION</span><h3>VaultTrades Nexus Plus – Automation</h3><p>An expanded automated trading product within the VaultTrades trading ecosystem.</p></article>
          <article className="vto-automation-card"><span>03 · AUTOMATION</span><h3>VaultTrades Vortex – Automation</h3><p>Our advanced automation product within the wider VaultTrades trading and development pathway.</p></article>
        </div>
        <p className="vto-automation-note">The automation products are trading tools, not standalone income opportunities. Trading involves risk, and losses are possible. Product access, setup, licensing and operating requirements are explained before purchase.</p>
      </section>


      <section className="vto-dark-band">
        <div className="vto-container vto-split">
          <div>
            <div className="vto-kicker">A PROCESS YOU CAN FOLLOW</div>
            <h2>Less guesswork.<br /><span>More deliberate decisions.</span></h2>
            <p>The aim is not to be active every day. It is to develop a repeatable routine, understand risk before acting and recognise when the best decision is to wait. Automation is a way to execute defined rules—not a promise of daily returns.</p>
          </div>
          <div className="vto-workflow">
            {stages.map(([number, title, description]) => (
              <article className="vto-step" key={number}><span>{number}</span><div><h3>{title}</h3><p>{description}</p></div></article>
            ))}
          </div>
        </div>
      </section>

      <section className="vto-capital vto-growth-story">
        <div className="vto-container">
          <div className="vto-capital-grid">
            <div>
              <div className="vto-kicker">A DIGITAL OPPORTUNITY BUILT FOR THE LONG VIEW</div>
              <h2>Make room for growth.<br /><span>Build with a clear process.</span></h2>
            </div>
            <div>
              <p>Technology has changed how people access financial markets, learn new skills and participate in digital business. VaultTrades brings these possibilities together in one guided ecosystem—so you can develop your understanding, use structured tools and explore ways to build beyond a single activity.</p>
              <p>You do not need to become a content creator or build a complicated platform from scratch. The focus is on understanding the opportunity, learning how the tools work, following a clear process and developing useful connections over time.</p>
            </div>
          </div>
          <div className="vto-growth-routine">
            <div className="vto-growth-time"><strong>~50</strong><span>MINUTES</span><small>A suggested focused daily learning and review routine</small></div>
            <div>
              <div className="vto-kicker">START WITH A ROUTINE YOU CAN SUSTAIN</div>
              <h3>Learn a little. Apply what you learn. Review your progress.</h3>
              <p>A focused block of time can help you understand the system, review the market process and keep building your knowledge. The time required will vary with your experience, the tools you use and the level of participation you choose. It is not a promise of a particular trading result.</p>
            </div>
          </div>
          <div className="vto-build-horizon">
            <div className="vto-kicker">THINK BEYOND THE FIRST DAY</div>
            <h3>Give yourself three to six months to build, implement and evaluate.</h3>
            <p>Use the first stage to learn and get set up, the next to establish a consistent routine, and the following months to review your progress and decide how you want to develop. This is a suggested development horizon—not a guaranteed payback period or a promise of income.</p>
          </div>
        </div>
      </section>

      <section className="vto-pathway-band" id="business-pathway">
        <div className="vto-container">
          <div className="vto-section-heading">
            <div className="vto-kicker">FROM DISCOVERY TO BUILDING</div>
            <h2>See where the opportunity leads.</h2>
            <p>A simple route through the process, so you can understand what happens next and the kind of digital business you can work towards building.</p>
          </div>
          <div className="vto-pathway-track">
            <article className="vto-pathway-card"><span>01</span><div><h3>DISCOVER</h3><p>Understand the opportunity and what participation involves.</p></div><b aria-hidden="true">→</b></article>
            <article className="vto-pathway-card"><span>02</span><div><h3>EXPLORE</h3><p>Review the structure, available pathways and applicable terms.</p></div><b aria-hidden="true">→</b></article>
            <article className="vto-pathway-card"><span>03</span><div><h3>GET SET UP</h3><p>Choose a suitable plan and complete the onboarding process.</p></div><b aria-hidden="true">→</b></article>
            <article className="vto-pathway-card"><span>04</span><div><h3>BUILD</h3><p>Develop your digital presence, skills and customer relationships over time.</p></div><b aria-hidden="true">↗</b></article>
          </div>
          <div className="vto-pathway-actions">
            <Link className="vto-button vto-button-gold" href="/opportunity#business-pathway">EXPLORE THE OPPORTUNITY</Link>
            <Link className="vto-button vto-button-outline" href="/plans">SEE HOW TO JOIN</Link>
          </div>
        </div>
      </section>

      <section className="vto-container vto-section vto-business">
        <div className="vto-business-copy">
          <div className="vto-kicker">A BUSINESS YOU CAN BUILD</div>
          <h2>Learn to attract.<br /><span>Connect. Grow with purpose.</span></h2>
          <p>Develop digital-business skills, learn how the membership ecosystem works and understand how selected digital products and partnerships can create additional opportunities.</p>
          <p>As members progress, eligible plans may provide access to a wider set of tools, products and network-building opportunities. The specific access and terms are presented with each membership option.</p>
        </div>
        <div className="vto-business-list">
          {[
            ["01", "UNDERSTAND", "Get clear on the value, the process and the people the ecosystem is designed to serve."],
            ["02", "BUILD CONNECTIONS", "Develop communication skills and meaningful relationships through useful information."],
            ["03", "CREATE OPPORTUNITY", "Explore membership and selected digital products in a way that fits the needs of each person."],
            ["04", "SCALE WITH STRUCTURE", "Learn how a network and approved affiliate relationships can be developed over time."],
          ].map(([number, title, description]) => (
            <div className="vto-business-row" key={number}><span>{number}</span><div><b>{title}</b><p>{description}</p></div></div>
          ))}
        </div>
      </section>

      <OpportunityIncomeSection />

      <section className="vto-mid-cta">
        <div className="vto-container vto-mid-cta-inner">
          <div><div className="vto-kicker">TAKE THE NEXT STEP</div><h2>Explore the structure.<br /><span>Decide if it fits you.</span></h2></div>
          <div className="vto-mid-cta-actions">
            <Link className="vto-button vto-button-gold" href="/start">EXPLORE THE OPPORTUNITY</Link>
            <Link className="vto-button vto-button-outline" href="/plans">SEE HOW TO JOIN</Link>
          </div>
        </div>
      </section>

      <section className="vto-container vto-section vto-faq">
        <div className="vto-section-heading"><div className="vto-kicker">CLEAR ANSWERS BEFORE YOU DECIDE</div><h2>Frequently asked questions.</h2></div>
        <div className="vto-faq-list">{faqs.map(([question, answer]) => (<details key={question}><summary>{question}<span>+</span></summary><p>{answer}</p></details>))}</div>
      </section>

      <section className="vto-final">
        <div className="vto-container">
          <div className="vto-kicker">YOUR NEXT STEP</div>
          <h2>Ready to explore<br /><span>your options?</span></h2>
          <p>Discover how the VaultTrades opportunity works, what you can build over time and the next step to explore when you are ready.</p>
          <div className="vto-final-actions"><Link className="vto-button vto-button-gold" href="/plans">EXPLORE MEMBERSHIP OPTIONS</Link></div>
          <small>Trading involves risk and losses are possible. Past performance does not guarantee future results. Trading returns and business commissions are not guaranteed and depend on market outcomes, qualifying activity and the applicable terms.</small>
        </div>
      </section>

      <section className="vto-results vto-results-float" id="results-gallery">
        <div className="vto-container">
          <div className="vto-section-heading">
            <div className="vto-kicker">REAL EXPERIENCES & SUPPORTING RECORDS</div>
            <h2>Testimonials and <span>certificates.</span></h2>
            <p>Review the available original trading records and certificates with their dates and context. Each record is presented as historical evidence, not a promise of future results.</p>
          </div>
          <div className="vto-evidence-groups">
            <EvidenceCarousel
              title="TRADE CERTIFICATES"
              description="A moving selection of the original trade records, shown as examples of the trading process."
              items={evidenceGallery.trades}
              emptyMessage="Trade certificates will appear here when the original records are available."
            />
            <EvidenceCarousel
              title="CHALLENGE & FUNDED-PROFILE CERTIFICATES"
              description="Examples of challenge milestones and profile progress, kept separate from individual trade records."
              items={evidenceGallery.certificates}
              emptyMessage="Challenge and funded-profile certificates will appear here when those records are uploaded."
            />
          </div>
          <p className="vto-results-note">The final certificate gallery will display the original trade records with their actual dates and context. Historical examples are not a forecast or guarantee of future performance.</p>
        </div>
      </section>
    </main>
  );
}


function EvidenceCarousel({
  title,
  description,
  items,
  emptyMessage,
}: {
  title: string;
  description: string;
  items: { title: string; src: string }[];
  emptyMessage: string;
}) {
  if (!items.length) {
    return (
      <section className="vto-evidence-group">
        <div className="vto-evidence-group-heading">
          <h3>{title}</h3>
          <p>{description}</p>
        </div>
        <div className="vto-gallery-empty">{emptyMessage}</div>
      </section>
    );
  }

  const loopItems = [...items, ...items];
  return (
    <section className="vto-evidence-group">
      <div className="vto-evidence-group-heading">
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
      <div
        className="vto-evidence-marquee"
        aria-label={title}
      >
        <div className="vto-evidence-track">
          {loopItems.map((item, index) => (
            <div className="vto-evidence-item" key={`${item.src}-${index}`}>
              <div className="vto-evidence-image-wrap">
                <img src={item.src} alt={item.title} loading="lazy" draggable={false} />
                <span className="vto-evidence-watermark" aria-hidden="true">VAULTTRADES</span>
              </div>
              <div className="vto-evidence-caption"><strong>{item.title}</strong></div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function getEvidenceGallery() {
  const readFolder = (folders: string[]) => folders.flatMap((folder) => {
    const absolute = path.join(process.cwd(), "public", folder);
    if (!fs.existsSync(absolute)) return [];
    return fs.readdirSync(absolute, { withFileTypes: true })
      .filter((entry: import("node:fs").Dirent) =>
        entry.isFile() && /\.(png|jpe?g|webp|avif)$/i.test(entry.name)
      )
      .sort((a: import("node:fs").Dirent, b: import("node:fs").Dirent) => a.name.localeCompare(b.name))
      .map((entry: import("node:fs").Dirent) => ({
        title: path.basename(entry.name, path.extname(entry.name)).replace(/[-_]+/g, " "),
        src: "/" + path.relative("public", path.join(absolute, entry.name)).split(path.sep).join("/"),
      }));
  });

  return {
    trades: readFolder(["images/marketing/trading-results"]),
    certificates: readFolder([
      "images/marketing/certificates",
      "images/marketing/challenge-progress",
    ]),
  };
}
