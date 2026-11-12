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
            <Link className="vto-button vto-button-outline" href="/plans">EXPLORE MEMBERSHIP OPTIONS</Link>
          </div>
          <div className="vto-hero-foot">FOCUS. DISCIPLINE. CONSISTENCY.</div>
        </div>
        <div className="vto-hero-popouts" aria-label="The two parts of the opportunity">
          <div><span>01</span><strong>A PROCESS<br />YOU CAN FOLLOW</strong></div>
          <div><span>02</span><strong>A BUSINESS<br />YOU CAN BUILD</strong></div>
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

      <section className="vto-capital">
        <div className="vto-container vto-capital-grid">
          <div><div className="vto-kicker">DISCIPLINE BEFORE EXPECTATION</div><h2>Understand the potential.<br /><span>Respect the risk.</span></h2></div>
          <div>
            <p>Personal trading and business commissions are separate activities. Trading outcomes depend on market conditions and carry the risk of loss. Automated execution does not remove that risk or create a guaranteed daily income.</p>
            <p>Any additional commission opportunity depends on the relevant membership, qualifying activity and applicable terms. The aim is to build knowledge and a process that can be developed over time—not to promise quick or effortless income.</p>
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

      <section className="vto-results">
        <div className="vto-container">
          <div className="vto-section-heading">
            <div className="vto-kicker">THE JOURNEY, SHOWN IN STAGES</div>
            <h2>From humble beginnings<br /><span>to scaling up.</span></h2>
            <p>Trading results are best understood in context. Explore the stages of the journey, with examples to be supported by dated certificates and records—not isolated claims.</p>
          </div>
          <div className="vto-results-track" aria-label="Trading journey stages. Scroll horizontally to explore all three cards.">
            {resultStages.map((stage) => (
              <article className="vto-result-card" key={stage.number}>
                <div className={`vto-result-visual ${stage.visual}`}>
                  <span>{stage.visualLabel}</span>
                  <strong>{stage.number}</strong>
                  <i aria-hidden="true" />
                </div>
                <div className="vto-result-copy">
                  <span className="vto-result-marker">{stage.marker}</span>
                  <h3>{stage.title}</h3>
                  <p>{stage.description}</p>
                </div>
              </article>
            ))}
          </div>
          <p className="vto-results-note">The final certificate gallery will display the original trade records with their actual dates and context. Historical examples are not a forecast or guarantee of future performance.</p>
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
          <p>Take a closer look at the membership options and decide whether the trading and digital pathways fit your goals. Take your time and review the terms before choosing.</p>
          <div className="vto-final-actions"><Link className="vto-button vto-button-gold" href="/plans">EXPLORE MEMBERSHIP OPTIONS</Link></div>
          <small>Trading involves risk and losses are possible. Past performance does not guarantee future results. Trading returns and business commissions are not guaranteed and depend on market outcomes, qualifying activity and the applicable terms.</small>
        </div>
      </section>
    </main>
  );
}
