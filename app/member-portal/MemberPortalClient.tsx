"use client";

import { useMemo, useState } from "react";
import type { ReactNode, FormEvent } from "react";
import Link from "next/link";

type Plan = "nexus" | "nexus_plus" | "vortex";

type LicensingRequest = { id: string; broker_name: string; broker_server: string | null; mt5_login: string; product_code: string; status: string; admin_notes: string | null; submitted_at: string; license_generated_at: string | null };

type Props = {
  plan: Plan;
  isAdmin: boolean;
  memberEmail: string;
  referralUrl: string | null;
  licensingRequests: LicensingRequest[];
  xmRegistrationUrl: string;
  vpsRegistrationUrl: string;
};

const sections = [
  { id: "welcome", label: "Welcome to VaultTrades", group: "START HERE" },
  { id: "community", label: "Join the Community", group: "GET STARTED" },
  { id: "broker", label: "Recommended Broker — XM", group: "GET STARTED" },
  { id: "mt5", label: "Open Your MT5 Account", group: "GET STARTED" },
  { id: "licensing", label: "Submit Your MT5 Number", group: "EA LICENSING" },
  { id: "generation", label: "Personalised EA Generation", group: "EA LICENSING" },
  { id: "download", label: "EA Download", group: "EA LICENSING" },
  { id: "installation", label: "Installation Guide", group: "EA LICENSING" },
  { id: "vps", label: "Optional 24/7 VPS", group: "AUTOMATION" },
  { id: "daily", label: "Your Daily Trading Routine", group: "AUTOMATION" },
  { id: "trading-room", label: "Morning Trading Room", group: "LEARNING & SUPPORT" },
  { id: "mentorship", label: "Optional Trading Mentorship", group: "LEARNING & SUPPORT" },
  { id: "business", label: "Understand Your Business", group: "BUILD YOUR BUSINESS" },
  { id: "referrals", label: "Your Referral Link", group: "BUILD YOUR BUSINESS" },
  { id: "website", label: "Your Personal Website", group: "BUILD YOUR BUSINESS" },
  { id: "tools", label: "Additional Tools", group: "MEMBER TOOLS" },
  { id: "risk", label: "Risk & Important Information", group: "MEMBER TOOLS" },
  { id: "faq", label: "Frequently Asked Questions", group: "MEMBER TOOLS" },
] as const;

const planNames: Record<Plan, string> = {
  nexus: "VaultTrades Nexus",
  nexus_plus: "VaultTrades Nexus Plus",
  vortex: "VaultTrades Vortex",
};

export default function MemberPortalClient({
  plan, isAdmin, memberEmail, referralUrl, licensingRequests, xmRegistrationUrl, vpsRegistrationUrl,
}: Props) {
  const [active, setActive] = useState<string>("welcome");
  const [copied, setCopied] = useState(false);
  const [requests, setRequests] = useState<LicensingRequest[]>(licensingRequests);
  const [mt5Login, setMt5Login] = useState("");
  const [brokerServer, setBrokerServer] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<"nexus" | "nexus_plus" | "vortex">(plan);
  const [submitting, setSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState("");
  const groups = useMemo(() => {
    const result: { group: string; items: typeof sections[number][] }[] = [];
    for (const item of sections) {
      let group = result.find(entry => entry.group === item.group);
      if (!group) { group = { group: item.group, items: [] }; result.push(group); }
      group.items.push(item);
    }
    return result;
  }, []);

  async function copyReferral() {
    if (!referralUrl) return;
    await navigator.clipboard.writeText(referralUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  async function submitLicensingRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setSubmitMessage("");
    try {
      const response = await fetch("/api/member-portal/ea-licensing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mt5Login, brokerServer, productCode: selectedProduct }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Unable to submit your MT5 number.");
      setRequests(current => [data.request, ...current]);
      setMt5Login("");
      setBrokerServer("");
      setSubmitMessage(data.message || "Your licensing request has been submitted.");
    } catch (error) {
      setSubmitMessage(error instanceof Error ? error.message : "Unable to submit your request.");
    } finally { setSubmitting(false); }
  }

  const allowedEaProducts = plan === "nexus"
    ? [{ value: "nexus", label: "VaultTrades Nexus" }]
    : plan === "nexus_plus"
      ? [{ value: "nexus", label: "VaultTrades Nexus" }, { value: "nexus_plus", label: "VaultTrades Nexus Plus" }]
      : [{ value: "nexus", label: "VaultTrades Nexus" }, { value: "nexus_plus", label: "VaultTrades Nexus Plus" }, { value: "vortex", label: "VaultTrades Vortex" }];

  const plusOrVortex = plan === "nexus_plus" || plan === "vortex";
  const hasVortex = plan === "vortex";

  function renderContent() {
    switch (active) {
      case "welcome":
        return <>
          <Eyebrow>YOUR MEMBER WORKSPACE</Eyebrow>
          <h1>Welcome to VaultTrades.</h1>
          <p className="vt-member-lead">This is your central guide to getting started, activating your personalised EA, learning how to use your membership and building your VaultTrades business.</p>
          <div className="vt-member-highlight">
            <strong>Your membership</strong>
            <span>{planNames[plan]}{isAdmin ? " · Administrator access" : ""}</span>
            <small>{memberEmail}</small>
          </div>
          <h2>Follow the process in order</h2>
          <ol className="vt-member-steps">
            <li><strong>Join the community.</strong> This is where member announcements, support information and Google Meet updates are shared.</li>
            <li><strong>Open your broker account.</strong> Use the VaultTrades XM registration link when it is published in this section.</li>
            <li><strong>Open your MT5 trading account.</strong> You will need its account number for personalised licensing.</li>
            <li><strong>Submit your MT5 number.</strong> VaultTrades uses it to prepare your licensed EA.</li>
            <li><strong>Wait for licensing.</strong> Allow 24–48 hours after the correct MT5 number has been received.</li>
            <li><strong>Download and install your EA.</strong> Follow the product-specific installation guide.</li>
            <li><strong>Consider VPS hosting.</strong> This optional service can keep the terminal running remotely.</li>
            <li><strong>Learn and build.</strong> Use the community, optional mentorship and your referral resources.</li>
          </ol>
          <p className="vt-member-note">Some links and request forms are being connected to the member administration workflow. Where a link is not yet published, this guide will be updated rather than sending you to an unverified destination.</p>
        </>;
      case "community":
        return <>
          <Eyebrow>GET STARTED</Eyebrow><h1>Join the VaultTrades community.</h1>
          <p className="vt-member-lead">Start here. The community is the main announcement channel for member updates, support information, trading-room notices and Google Meet invitations.</p>
          <a className="vt-member-button" href="/vaulttrades-community">Open VaultTrades Community</a>
          <h2>What to look out for</h2>
          <ul><li>Important product and member announcements.</li><li>Updates when a Google Meet trading-room session is scheduled.</li><li>Support guidance and notices about changes to the installation process.</li><li>Links to relevant learning sessions and resources.</li></ul>
          <p className="vt-member-note">Check the community announcements for the current meeting link and session time. Do not rely on an old meeting link or assume that a session is running unless it has been announced.</p>
        </>;
      case "broker":
        return <>
          <Eyebrow>RECOMMENDED BROKER</Eyebrow><h1>Register with XM.</h1>
          <p className="vt-member-lead">XM is the broker recommended by VaultTrades for this onboarding route. You will register directly with the broker and open your own trading account.</p>
          {xmRegistrationUrl ? <a className="vt-member-button" href={xmRegistrationUrl} target="_blank" rel="noreferrer">Continue to XM registration ↗</a> : <div className="vt-member-pending"><strong>XM registration link pending</strong><span>The VaultTrades tracked registration link will appear here once it has been configured.</span></div>}
          <h2>Important</h2>
          <ul><li>Your broker account is held with the broker, not VaultTrades.</li><li>Complete the broker's own identity checks and account-opening requirements.</li><li>Use the correct registration link supplied here so the referral can be attributed where applicable.</li><li>Keep your broker login password private. VaultTrades does not need your trading password to generate the EA licence.</li></ul>
          <p className="vt-member-note">Broker services, account approval, deposits, withdrawals, spreads and trading conditions are controlled by the broker. Review its terms before opening or funding an account.</p>
        </>;
      case "mt5":
        return <>
          <Eyebrow>YOUR TRADING ACCOUNT</Eyebrow><h1>Open your MT5 account.</h1>
          <p className="vt-member-lead">After registering with XM, open a MetaTrader 5 trading account. The account number (sometimes called the login ID) is the identifier needed for your EA licence.</p>
          <ol><li>Complete the broker's registration and verification process.</li><li>Open an MT5 trading account from your broker's client area.</li><li>Install MetaTrader 5 on the computer you will use, or prepare your VPS later.</li><li>Sign in to MT5 and locate the account number shown in the terminal.</li><li>Keep the number available for the licensing submission step.</li></ol>
          <div className="vt-member-pending"><strong>Do not submit your password.</strong><span>VaultTrades needs the MT5 account number for licensing, not your broker password, investor password or one-time security code.</span></div>
        </>;
      case "licensing":
        return <>
          <Eyebrow>PERSONALISED LICENSING</Eyebrow><h1>Submit your MT5 account number.</h1>
          <p className="vt-member-lead">Your EA is generated for the MT5 account number you submit. It is not a shared, ready-made download that every member receives.</p>
          <h2>Submit your licensing request</h2>
          <form className="vt-member-form" onSubmit={submitLicensingRequest}>
            <label>EA product
              <select value={selectedProduct} onChange={event => setSelectedProduct(event.target.value as "nexus" | "nexus_plus" | "vortex")}>
                {allowedEaProducts.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
            <label>MT5 account number
              <input required inputMode="numeric" pattern="[0-9]{4,12}" minLength={4} maxLength={12} value={mt5Login} onChange={event => setMt5Login(event.target.value.replace(/\\D/g, "").slice(0, 12))} placeholder="Enter your MT5 login number" />
            </label>
            <label>Broker server (optional)
              <input value={brokerServer} onChange={event => setBrokerServer(event.target.value)} maxLength={120} placeholder="For example, XM server name shown in MT5" />
            </label>
            <p className="vt-member-form-note">Broker: XM. Submit the MT5 account number only. Do not submit your trading password, investor password or one-time security code.</p>
            <button className="vt-member-button" type="submit" disabled={submitting}>{submitting ? "Submitting…" : "Submit MT5 number"}</button>
            {submitMessage && <p className="vt-member-submit-message" role="status">{submitMessage}</p>}
          </form>
          <h2>Your licensing requests</h2>
          {requests.length ? <div className="vt-member-request-list">{requests.map(request => <div className="vt-member-request" key={request.id}>
            <div><strong>{request.product_code === "nexus" ? "VaultTrades Nexus" : request.product_code === "nexus_plus" ? "VaultTrades Nexus Plus" : "VaultTrades Vortex"}</strong><small>MT5 {request.mt5_login} · {request.broker_name} · {new Date(request.submitted_at).toLocaleString()}</small></div>
            <span className={"vt-member-request-status " + request.status}>{request.status.replace("_", " ")}</span>
            {request.status === "ready" && <a className="vt-member-tool-link" href={`/api/member-portal/ea-licensing/${request.id}/download`}>Download EA ↗</a>}
            {request.status === "rejected" && request.admin_notes && <p className="vt-member-note">{request.admin_notes}</p>}
          </div>)}</div> : <p className="vt-member-note">You have not submitted an MT5 licensing request yet.</p>}
          <p className="vt-member-note">Allow 24–48 hours after VaultTrades receives the correct MT5 number. The personalised file will appear in your download area once licensing is complete.</p>
        </>;
      case "generation":
        return <>
          <Eyebrow>LICENCE PREPARATION</Eyebrow><h1>Your personalised EA is prepared.</h1>
          <p className="vt-member-lead">After VaultTrades receives your correct MT5 account number, the licensing team prepares the EA build linked to that account.</p>
          <div className="vt-member-highlight"><strong>Expected processing time</strong><span>24–48 hours after receipt of the correct MT5 account number</span><small>Processing time may be affected if the submitted number is incomplete or needs clarification.</small></div>
          <h2>What happens next</h2><ol><li>VaultTrades checks the submitted account number and membership entitlement.</li><li>The EA is generated with the applicable licence details.</li><li>The licensing status is updated.</li><li>When it is ready, the download becomes available in your member portal.</li></ol>
        </>;
      case "download":
        return <>
          <Eyebrow>YOUR EA FILE</Eyebrow><h1>Download when your licence is ready.</h1>
          <p className="vt-member-lead">The download area will display the EA file generated for your approved MT5 account. It will become available after the licensing team marks the build as ready.</p>
          {requests.some(request => request.status === "ready") ? <div className="vt-member-request-list">{requests.filter(request => request.status === "ready").map(request => <div className="vt-member-request" key={request.id}>
            <div><strong>{request.product_code === "nexus" ? "VaultTrades Nexus" : request.product_code === "nexus_plus" ? "VaultTrades Nexus Plus" : "VaultTrades Vortex"}</strong><small>MT5 {request.mt5_login} · Licensed {request.license_generated_at ? new Date(request.license_generated_at).toLocaleString() : ""}</small></div>
            <a className="vt-member-button" href={`/api/member-portal/ea-licensing/${request.id}/download`}>Download EA</a>
          </div>)}</div> : <div className="vt-member-pending"><strong>Your personalised EA is not ready yet.</strong><span>Once your MT5 request is approved and the licensed file is uploaded, the download will appear here.</span></div>}
          <h2>Before installing</h2><ul><li>Confirm that the EA name and build match your membership.</li><li>Use the installation guide for that exact product.</li><li>Keep the downloaded file private and do not redistribute it.</li></ul>
        </>;
      case "installation":
        return <>
          <Eyebrow>INSTALLATION</Eyebrow><h1>Install and attach your EA.</h1>
          <p className="vt-member-lead">Use the installation guide supplied for your exact EA build. The Nexus and Nexus Plus builds have different operating behaviour, so do not substitute one guide for the other.</p>
          <h2>MetaTrader 5 preparation</h2><ol><li>Install and open MetaTrader 5 for your broker account.</li><li>Sign in to the correct trading account.</li><li>Open File → Open Data Folder.</li><li>Copy the licensed EA and any required support files into the exact folders specified by the supplied installation guide.</li><li>Compile the source in MetaEditor only if your download includes source files and the guide instructs you to compile.</li><li>Refresh the Navigator, attach the EA to the specified chart and enable Algo Trading.</li><li>Check the Experts tab for startup and permission messages.</li></ol>
          <div className="vt-member-pending"><strong>Use the supplied product guide for exact file paths and settings.</strong><span>Do not guess file locations, change EA inputs or assume that the Nexus and Nexus Plus installation packages are interchangeable.</span></div>
          <p className="vt-member-note">The terminal must remain running for a locally hosted EA to operate. A VPS is an optional way to keep the terminal running remotely.</p>
        </>;
      case "vps":
        return <>
          <Eyebrow>OPTIONAL REMOTE HOSTING</Eyebrow><h1>Keep your EA running with a VPS.</h1>
          <p className="vt-member-lead">A Virtual Private Server (VPS) is a remote computer that can keep MetaTrader 5 and your EA running when your personal computer is switched off or your home internet connection is interrupted.</p>
          <h2>Why members may choose a VPS</h2><ul><li>MetaTrader 5 can remain online independently of your home computer.</li><li>It can reduce interruptions caused by local power, internet or travel.</li><li>You can access the remote desktop to check the terminal when needed.</li></ul>
          {vpsRegistrationUrl ? <a className="vt-member-button" href={vpsRegistrationUrl} target="_blank" rel="noreferrer">View VPS subscription option ↗</a> : <div className="vt-member-pending"><strong>VPS subscription link pending</strong><span>The recommended VPS subscription link will be published here when configured.</span></div>}
          <p className="vt-member-note">VPS hosting is optional and may involve a separate recurring fee. It does not guarantee uninterrupted service, trade execution or profits. You remain responsible for monitoring your account and EA.</p>
        </>;
      case "daily":
        return <>
          <Eyebrow>DAILY ROUTINE</Eyebrow><h1>Your daily trading routine.</h1>
          <ol><li>Check that your MT5 terminal is connected to the correct broker account.</li><li>Confirm Algo Trading is enabled and the EA is attached to the intended chart.</li><li>Review the Experts and Journal tabs for errors or permission warnings.</li><li>Check open positions, stop-loss and take-profit levels.</li><li>Review account equity, margin and exposure before making any manual decisions.</li><li>Check community announcements for session notices or product updates.</li><li>At the end of your session, review the account history and record any observations.</li></ol>
          <p className="vt-member-note">An automated EA does not promise a trade every day. It may remain inactive when its strategy conditions are not met, when the trading window is closed, or when broker/account conditions prevent execution.</p>
        </>;
      case "trading-room":
        return <>
          <Eyebrow>COMMUNITY LEARNING</Eyebrow><h1>Morning trading room.</h1>
          <p className="vt-member-lead">The optional Google Meet room is for members who want to follow market discussion and explore additional trading opportunities beyond the EA's automated activity.</p>
          <p>Meeting links and the current session schedule will be posted in the community announcements. Check the latest announcement before joining.</p>
          <ul><li>Participation is optional.</li><li>The EA may already have taken trades before a live discussion begins.</li><li>Room discussions are educational and do not require you to place a trade.</li><li>Any manual trade remains your own decision and responsibility.</li></ul>
          <a className="vt-member-button" href="/vaulttrades-community">Check community announcements</a>
        </>;
      case "mentorship":
        return <>
          <Eyebrow>OPTIONAL LEARNING</Eyebrow><h1>Learn the basics of trading.</h1>
          <p className="vt-member-lead">Members who want to understand manual trading, market structure, risk and trade management can explore optional mentorship.</p>
          <p>Mentorship is not compulsory for using the EA. It is for members who want additional education and a clearer understanding of the decisions involved in trading.</p>
          <a className="vt-member-button" href="/founders-mentorship">Explore mentorship</a>
          <p className="vt-member-note">Session availability, format and any additional fees should be checked on the mentorship page before booking.</p>
        </>;
      case "business":
        return <>
          <Eyebrow>YOUR VAULTTRADES BUSINESS</Eyebrow><h1>Understand the product you joined.</h1>
          <p className="vt-member-lead">You can introduce VaultTrades membership packages to people who may value the trading tools, learning resources and business opportunity.</p>
          <h2>Know what you are explaining</h2><ul><li>Describe the membership package accurately and explain what it includes.</li><li>Show how the EA licensing and installation process works.</li><li>Explain that broker funding and VPS hosting are separate from the membership fee.</li><li>Be clear that trading involves risk and neither trading returns nor reseller income is guaranteed.</li><li>Never promise profits, guaranteed trades or guaranteed commissions.</li></ul>
          <p>Members may personally refer any of the three VaultTrades plans, subject to the final reseller terms. The programme is based on direct customer sales, not recruitment alone.</p>
          <a className="vt-member-button" href="/plans">Review the membership plans</a>
        </>;
      case "referrals":
        return <>
          <Eyebrow>YOUR PERSONAL LINK</Eyebrow><h1>Share your VaultTrades referral link.</h1>
          <p className="vt-member-lead">Your referral link identifies people who visit VaultTrades through your introduction. Share it with people who may be interested in the membership and explain the products honestly.</p>
          {referralUrl ? <div className="vt-member-referral"><code>{referralUrl}</code><button type="button" className="vt-member-outline" onClick={copyReferral}>{copied ? "Copied" : "Copy link"}</button></div> : <div className="vt-member-pending"><strong>Referral link not available</strong><span>Contact support if your member referral link has not been generated.</span></div>}
          <h2>A simple daily business habit</h2><ol><li>Think of people who may genuinely benefit from the products.</li><li>Share your referral link and invite them to review the opportunity.</li><li>Explain the plan differences and answer questions accurately.</li><li>Follow up without pressure and respect each person's decision.</li></ol>
          <p className="vt-member-note">Start by introducing the opportunity to five people who may be interested. This is a suggested activity target, not a promise of sales or income. Commission terms and eligibility are governed by the final reseller programme rules.</p>
        </>;
      case "website":
        return <>
          <Eyebrow>OPTIONAL ADD-ON</Eyebrow><h1>Set up your personal website.</h1>
          <p className="vt-member-lead">A personal website can give you a branded place to introduce VaultTrades and share your referral link. It is optional and separate from your membership.</p>
          <h2>Choose your domain route</h2><ul><li><strong>VaultTrades subdomain:</strong> a name such as yourname.vaulttradesve.com, subject to availability and approval.</li><li><strong>Your own domain:</strong> a domain you purchase and own, such as yourname.com, which can be connected to the website.</li></ul>
          <div className="vt-member-highlight"><strong>Website setup</strong><span>$39 once-off setup fee</span><small>Any annual hosting, maintenance or domain charges will be confirmed separately before you commit.</small></div>
          <h2>Subdomain preferences</h2><p>When the website request form is enabled, you will be asked to provide three preferred subdomain names in order of preference. VaultTrades will check availability before confirming the assigned name.</p>
          <p className="vt-member-note">Do not purchase a custom domain until you have checked the spelling and availability. Website setup is not automatically included in the membership price.</p>
        </>;
      case "tools":
        return <>
          <Eyebrow>PLAN-BASED TOOLS</Eyebrow><h1>Your additional tools.</h1>
          <p className="vt-member-lead">Your portal displays the tools associated with your membership. Tools are protected by account entitlement; a visible link does not replace the required access check.</p>
          <div className="vt-member-tool-list">
            <Tool title="Trading Journal" description="Record and review your trading activity." href="/journal" unlocked={plusOrVortex} />
            <Tool title="Analyzer" description="Structured market analysis and trade planning." href="/analyzer" unlocked={plusOrVortex} />
            <Tool title="AI Coaching" description="Ask questions about market structure and your trading process." href="/ai-coach" unlocked={plusOrVortex} />
            <Tool title="Risk Manager" description="Calculate position size and manage account risk." href="/risk-manager" unlocked={hasVortex} />
            <Tool title="Funded Account Wealth Builder" description="Model funded-account targets and progress." href="/funded-account-wealth-builder" unlocked={hasVortex} />
          </div>
          <p className="vt-member-note">Nexus Plus and Vortex include the additional tools described in their plan. Vortex includes the advanced risk-management resources. Your access is determined by your active membership entitlement.</p>
        </>;
      case "risk":
        return <>
          <Eyebrow>IMPORTANT INFORMATION</Eyebrow><h1>Risk management and responsibility.</h1>
          <ul><li>Trading leveraged financial products involves substantial risk and may result in losses.</li><li>Past performance and backtest results do not guarantee future results.</li><li>Automated trading can experience slippage, gaps, spread changes, connection failures and broker execution restrictions.</li><li>A VPS can reduce dependence on your local device but cannot guarantee uninterrupted operation.</li><li>Always understand the EA's settings, stop-loss, take-profit and account exposure.</li><li>Never risk money you cannot afford to lose. Consider testing on a demo account before using live funds.</li><li>VaultTrades is not your broker and does not control broker execution, account conditions or withdrawals.</li></ul>
        </>;
      case "faq":
        return <>
          <Eyebrow>HELP CENTRE</Eyebrow><h1>Frequently asked questions.</h1>
          <div className="vt-member-faq">
            <details><summary>Is the EA a ready-made download?</summary><p>No. The EA is generated for the MT5 account number submitted by the member. The expected preparation period is 24–48 hours after the correct number is received.</p></details>
            <details><summary>Do I submit my broker password?</summary><p>No. Submit only the MT5 account number requested for licensing. Never share your trading password or one-time security codes.</p></details>
            <details><summary>Do I have to buy a VPS?</summary><p>No. VPS hosting is optional. You can run MT5 on your own computer, but the computer and terminal must remain running for the EA to operate locally.</p></details>
            <details><summary>Will the EA trade every day?</summary><p>No. The EA only acts when its strategy conditions and execution requirements are met. There is no guaranteed daily trade or profit.</p></details>
            <details><summary>Do I have to attend the trading room or mentorship?</summary><p>No. Both are optional learning opportunities.</p></details>
            <details><summary>Is the personal website compulsory?</summary><p>No. Website setup is optional and separately priced.</p></details>
            <details><summary>Can I refer all three plans?</summary><p>Members may personally introduce any of the three plans, subject to the final reseller terms. Qualifying sales and commissions are not guaranteed.</p></details>
          </div>
        </>;
      default:
        return <><h1>Choose a topic.</h1><p>Select a topic from the left navigation to read its guide.</p></>;
    }
  }

  return (
    <main className="vt-member-shell">
      <header className="vt-member-header">
        <div><span className="vt-member-kicker">VAULTTRADES MEMBER WORKSPACE</span><h1>Knowledge Base</h1><p>One place for onboarding, EA licensing, learning and business resources.</p></div>
        <div className="vt-member-header-actions"><span className="vt-member-plan">{planNames[plan]}</span><Link href="/profile" className="vt-member-outline">My profile</Link></div>
      </header>
      <div className="vt-member-layout">
        <aside className="vt-member-sidebar" aria-label="Knowledge Base topics">
          {groups.map(group => <div className="vt-member-nav-group" key={group.group}>
            <div className="vt-member-nav-heading">{group.group}</div>
            {group.items.map(item => <button type="button" key={item.id} className={active === item.id ? "vt-member-nav-item active" : "vt-member-nav-item"} onClick={() => setActive(item.id)}>{item.label}</button>)}
          </div>)}
        </aside>
        <article className="vt-member-content" aria-live="polite">{renderContent()}</article>
      </div>
    </main>
  );
}

function Eyebrow({ children }: { children: ReactNode }) {
  return <div className="vt-member-kicker">{children}</div>;
}

function Tool({ title, description, href, unlocked }: { title: string; description: string; href: string; unlocked: boolean }) {
  return <div className="vt-member-tool">
    <div><strong>{title}</strong><p>{description}</p></div>
    {unlocked ? <Link href={href} className="vt-member-tool-link">Open tool ↗</Link> : <span className="vt-member-locked">Unlocked with a higher plan</span>}
  </div>;
}
