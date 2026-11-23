const questions = [
  {
    question: "What is VaultTrades?",
    answer: "VaultTrades is a business and digital-tools ecosystem built around three connected groups: traders who use our tools, partners who pursue Master Reseller Rights, and members who want to learn and participate in the wider community. VaultTrades provides trading analysis and development tools alongside a structured digital-product reselling opportunity. It is not a broker or an exchange.",
  },
  {
    question: "Is VaultTrades only a trading community?",
    answer: "No. The community includes traders, users of VaultTrades products and partners building a digital reselling business. Some members focus on trading tools, some focus on the Master Reseller opportunity, and others choose to participate in both. You do not have to follow every pathway.",
  },
  {
    question: "What are Master Reseller Rights?",
    answer: "Master Reseller Rights refer to the approved opportunity to market and resell eligible VaultTrades digital products under the applicable partner terms. The selected plan, product eligibility, onboarding requirements, commission rules and payment conditions determine what a partner may offer. The rights do not mean that every VaultTrades service or third-party product is automatically included.",
  },
  {
    question: "Do I have to be a trader to become a Master Reseller?",
    answer: "No. The reselling pathway is a business opportunity in its own right. A partner can focus on learning the products, helping suitable customers understand them and building a customer network without personally trading. Trading is optional and involves separate skills and risks.",
  },
  {
    question: "Can I use VaultTrades tools without becoming a reseller?",
    answer: "Yes. People interested in trading tools can explore the relevant products and access options without taking part in the Master Reseller opportunity. Product availability, subscription requirements and included features depend on the product or plan selected.",
  },
  {
    question: "What are the main VaultTrades trading tools?",
    answer: "The trading toolset includes the Analyzer for market analysis and trade planning, the Risk Manager for planning exposure and position risk, and the Trading Journal for recording and reviewing trading decisions. The Wealth Builder learning module supports members who want to understand capital development and longer-term scaling. Access to each tool or module depends on the applicable plan or product entitlement.",
  },
  {
    question: "How do the Analyzer, Risk Manager and Journal work together?",
    answer: "The Analyzer helps a trader assess market conditions and identify whether a strategy setup is present. The Risk Manager helps plan the risk and position size before execution. The Journal records the trade and its outcome so the trader can review decisions, discipline and performance. These tools support a process; they do not make trading risk-free or guarantee a result.",
  },
  {
    question: "Does the trading approach require me to trade every day?",
    answer: "No. The approach is based on selectivity and following a defined strategy, not forcing trades for the sake of activity. A trader may focus on one planned trade in a day when the Analyzer and strategy identify a valid setup. If the required conditions are not present, waiting or taking no trade can be the correct decision.",
  },
  {
    question: "How can reselling and trading fit together?",
    answer: "Some members may choose to build a customer network and earn qualifying reseller payments, then set aside part of the capital they have accumulated for their own trading journey. They can use the Analyzer, apply their strategy, manage risk and journal their decisions. This is an optional way to combine two separate activities, not a required path or a promise of trading capital or profit.",
  },
  {
    question: "Does VaultTrades offer multiple streams of income?",
    answer: "The ecosystem provides different activities that a member may choose to explore, including eligible digital-product reselling, approved affiliate opportunities and personal trading. Each has its own requirements, terms and risks. Sales are not guaranteed, commissions depend on qualifying activity, and trading can result in losses. No income level or financial outcome is promised.",
  },
  {
    question: "Are trading profits, reseller commissions or wealth-building results guaranteed?",
    answer: "No. Trading involves the risk of loss, and no strategy or tool guarantees profitable trades. Reseller commissions depend on eligible sales, attribution, verification and the applicable partner terms. Wealth-building is a learning and development process, not a guaranteed return or a promise of a particular financial outcome.",
  },
  {
    question: "How do I know which plan or pathway is right for me?",
    answer: "Start by deciding what you want to do: use trading tools, pursue the Master Reseller opportunity, or explore both. Review the current plan descriptions and product access details before purchasing. If anything is unclear, contact VaultTrades or your approved partner and ask for the applicable inclusions, costs and terms in writing.",
  },
];

export default function VaultTradesFaq() {
  return (
    <section className="vt-ecosystem-faq" id="frequently-asked-questions" aria-labelledby="vt-ecosystem-faq-title">
      <div className="vt-ecosystem-faq-inner">
        <div className="vt-ecosystem-faq-kicker">UNDERSTAND THE ECOSYSTEM</div>
        <h2 id="vt-ecosystem-faq-title">Frequently asked questions.</h2>
        <p className="vt-ecosystem-faq-intro">Clear answers about trading tools, Master Reseller Rights and the different ways to participate in VaultTrades.</p>
        <div className="vt-ecosystem-faq-list">
          {questions.map((item) => (
            <details key={item.question}>
              <summary>{item.question}<span aria-hidden="true">+</span></summary>
              <p>{item.answer}</p>
            </details>
          ))}
        </div>
      </div>
      <style jsx>{`
        .vt-ecosystem-faq{background:#070c16;color:#f4f6fb;padding:76px 24px;border-top:1px solid rgba(212,166,55,.2);border-bottom:1px solid rgba(212,166,55,.2)}
        .vt-ecosystem-faq-inner{max-width:960px;margin:0 auto}
        .vt-ecosystem-faq-kicker{color:#d4a637;font-size:10px;font-weight:900;letter-spacing:.19em}
        .vt-ecosystem-faq h2{font-size:clamp(30px,4.5vw,48px);line-height:1.08;letter-spacing:-.04em;margin:13px 0}
        .vt-ecosystem-faq-intro{max-width:720px;color:#aeb5c6;font-size:14px;line-height:1.75;margin:0 0 30px}
        .vt-ecosystem-faq-list{border-top:1px solid rgba(255,255,255,.13)}
        .vt-ecosystem-faq details{border-bottom:1px solid rgba(255,255,255,.13);padding:0 2px}
        .vt-ecosystem-faq summary{list-style:none;display:flex;justify-content:space-between;align-items:center;gap:18px;padding:19px 0;cursor:pointer;font-size:14px;font-weight:750;line-height:1.5}
        .vt-ecosystem-faq summary::-webkit-details-marker{display:none}
        .vt-ecosystem-faq summary span{color:#d4a637;font-size:22px;font-weight:400;flex:none;transition:transform .2s}
        .vt-ecosystem-faq details[open] summary span{transform:rotate(45deg)}
        .vt-ecosystem-faq details p{max-width:850px;margin:0;padding:0 30px 20px 0;color:#aeb5c6;font-size:13px;line-height:1.8}
        @media(max-width:600px){.vt-ecosystem-faq{padding:58px 20px}.vt-ecosystem-faq summary{font-size:13px}.vt-ecosystem-faq details p{font-size:12px}}
      `}</style>
    </section>
  );
}
