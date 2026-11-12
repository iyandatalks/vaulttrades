import "./opportunity.css";
import Link from "next/link";

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

      <section className="vto-results vto-results-float" id="results-gallery">
        <div className="vto-container">
          <div className="vto-section-heading">
            <div className="vto-kicker">REAL TRADING RECORDS</div>
            <h2>Results and <span>certificates.</span></h2>
            <p>Explore the original VaultTrades trading records and certificates.</p>
          </div>
          {evidenceGallery.length > 0 ? (
            <div className="vto-evidence-gallery">
              {evidenceGallery.map((item) => (
                <a className="vto-evidence-item" href={item.src} target="_blank" rel="noreferrer" key={item.src}>
                  <img src={item.src} alt={item.title} loading="lazy" />
                  <div className="vto-evidence-caption"><span>{item.category}</span><strong>{item.title}</strong></div>
                </a>
              ))}
            </div>
          ) : (
            <div className="vto-gallery-empty" aria-live="polite">Original certificates and trading-result images will appear here when added to the evidence gallery.</div>
          )}
          <p className="vto-results-note">The final certificate gallery will display the original trade records with their actual dates and context. Historical examples are not a forecast or guarantee of future performance.</p>
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

      <section className="vto-learning-band">
        <div className="vto-container">
          <div className="vto-section-heading"><div className="vto-kicker">A GUIDED LEARNING JOURNEY</div><h2>Build capability step by step.</h2><p>Start with the foundations, practise the skills and develop at a pace that suits your circumstances.</p></div>
          <div className="vto-learning-grid">
            {learningSteps.map(([title, description], index) => (
              <article key={title}><span>PHASE 0{index + 1}</span><h3>{title}</h3><p>{description}</p></article>
            ))}
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
    </main>
  );
}


function getEvidenceGallery() {
  const fs = require("node:fs") as typeof import("node:fs");
  const path = require("node:path") as typeof import("node:path");
  const folders = [
    ["Certificates", "public/images/marketing/certificates"],
    ["Challenge progress", "public/images/marketing/challenge-progress"],
    ["Profit plans", "public/images/marketing/profit-plans/01-small-capital"],
    ["Profit plans", "public/images/marketing/profit-plans/02-medium-capital"],
    ["Profit plans", "public/images/marketing/profit-plans/03-large-capital"],
    ["Trading results", "public/images/marketing/trading-results"],
  ];
  const allowed = new Set([".png", ".jpg", ".jpeg", ".webp", ".avif"]);
  return folders.flatMap(([category, folder]) => {
    const absolute = path.join(process.cwd(), folder);
    if (!fs.existsSync(absolute)) return [];
    return fs.readdirSync(absolute, { withFileTypes: true })
      .filter((entry: import("node:fs").Dirent) => entry.isFile() && allowed.has(path.extname(entry.name).toLowerCase()))
      .sort((a: import("node:fs").Dirent, b: import("node:fs").Dirent) => a.name.localeCompare(b.name))
      .map((entry: import("node:fs").Dirent) => ({
        category,
        title: path.basename(entry.name, path.extname(entry.name)).replace(/[-_]+/g, " "),
        src: "/" + path.relative("public", path.join(absolute, entry.name)).split(path.sep).join("/"),
      }));
  });
}
