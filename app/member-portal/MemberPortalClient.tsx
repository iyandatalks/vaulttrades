"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode, FormEvent } from "react";
import Link from "next/link";
import CommunityCalendar from "./CommunityCalendar";
import MemberPortalAdminPanel from "./MemberPortalAdminPanel";

type Plan = "nexus" | "nexus_plus" | "vortex";

type LicensingRequest = { id: string; broker_name: string; broker_server: string | null; mt5_login: string; product_code: string; status: string; admin_notes: string | null; submitted_at: string; license_generated_at: string | null; license_resource_name?: string | null; license_resource_url?: string | null };
type WebsiteRequest = { id: string; domain_preference: string; preferred_name_1: string | null; preferred_name_2: string | null; preferred_name_3: string | null; custom_domain: string | null; status: string; admin_notes: string | null; assigned_domain: string | null; submitted_at: string };
type MemberNotification = { id: string; title: string; body: string; action_href: string; notification_type: string; created_at: string; read_at: string | null };
type KnowledgeResource = { id: string; section_id: string; title: string; description: string | null; resource_kind: string; resource_url: string; plan_codes: string[]; created_at: string };

type Props = {
  plan: Plan;
  isAdmin: boolean;
  memberEmail: string;
  referralUrl: string | null;
  licensingRequests: LicensingRequest[];
  websiteRequests: WebsiteRequest[];
  memberNotifications: MemberNotification[];
  xmRegistrationUrl: string;
  vpsRegistrationUrl: string;
  requestActionsAvailable: boolean;
  licensingActionsAvailable: boolean;
};

const sections = [
  { id: "welcome", label: "Welcome & Your Roadmap", group: "START HERE" },
  { id: "community", label: "1. Join the Community", group: "START HERE" },
  { id: "broker", label: "2. Broker Registration", group: "ACCOUNT SETUP" },
  { id: "mt5", label: "3. Open Your MT5 Account", group: "ACCOUNT SETUP" },
  { id: "licensing", label: "4. Submit Your MT5 Number", group: "EA LICENSING & DELIVERY" },
  { id: "generation", label: "5. Personalised EA Preparation", group: "EA LICENSING & DELIVERY" },
  { id: "download", label: "6. Download Your Licensed EA", group: "EA LICENSING & DELIVERY" },
  { id: "before-install", label: "7. Pre-installation Checklist", group: "EA INSTALLATION & OPERATION" },
  { id: "installation", label: "Nexus Installation Guide", group: "EA INSTALLATION & OPERATION" },
  { id: "understanding", label: "Understanding Nexus", group: "EA INSTALLATION & OPERATION" },
  { id: "ea-settings", label: "EA Settings & Risk Inputs", group: "EA INSTALLATION & OPERATION" },
  { id: "broker-detection", label: "Broker & Symbol Detection", group: "EA INSTALLATION & OPERATION" },
  { id: "signals", label: "How Trading Signals Work", group: "EA INSTALLATION & OPERATION" },
  { id: "execution", label: "Signal-to-Order Lifecycle", group: "EA INSTALLATION & OPERATION" },
  { id: "timeframes", label: "Recommended Timeframes", group: "EA INSTALLATION & OPERATION" },
  { id: "nexus-plus", label: "Nexus Plus Installation", group: "EA INSTALLATION & OPERATION" },
  { id: "vortex-manual", label: "Vortex User Manual", group: "EA INSTALLATION & OPERATION" },
  { id: "vortex-install", label: "Vortex Installation Guide", group: "EA INSTALLATION & OPERATION" },
  { id: "troubleshooting", label: "Troubleshooting", group: "EA INSTALLATION & OPERATION" },
  { id: "vps", label: "Optional VPS Hosting", group: "AUTOMATION & DAILY USE" },
  { id: "daily", label: "Your Daily Trading Routine", group: "AUTOMATION & DAILY USE" },
  { id: "trading-room", label: "Morning Trading Room", group: "LEARNING & DEVELOPMENT" },
  { id: "mentorship", label: "Seven-Day Mentorship", group: "LEARNING & DEVELOPMENT" },
  { id: "scaling", label: "Scaling & KPI Development", group: "LEARNING & DEVELOPMENT" },
  { id: "business", label: "Understand the Reseller Programme", group: "BUILD YOUR BUSINESS" },
  { id: "referrals", label: "Your Existing Referral Link", group: "BUILD YOUR BUSINESS" },
  { id: "website", label: "Your Personal Website", group: "BUILD YOUR BUSINESS" },
  { id: "resources", label: "Partners & Resource Directory", group: "TOOLS & SUPPORT" },
  { id: "tools", label: "Plan-Included Digital Tools", group: "TOOLS & SUPPORT" },
  { id: "risk", label: "Risk & Important Information", group: "TOOLS & SUPPORT" },
  { id: "faq", label: "Frequently Asked Questions", group: "TOOLS & SUPPORT" },
  { id: "notifications", label: "Member Notifications", group: "TOOLS & SUPPORT" },
  { id: "admin", label: "Manage Knowledge Base", group: "ADMINISTRATION" },
] as const;

const planNames: Record<Plan, string> = {
  nexus: "VaultTrades Nexus",
  nexus_plus: "VaultTrades Nexus Plus",
  vortex: "VaultTrades Vortex",
};

export default function MemberPortalClient({
  plan, isAdmin, memberEmail, referralUrl, licensingRequests, websiteRequests, memberNotifications, xmRegistrationUrl, vpsRegistrationUrl, requestActionsAvailable, licensingActionsAvailable,
}: Props) {
  const [active, setActive] = useState<string>("welcome");
  const [topicSearch, setTopicSearch] = useState("");
  const [knowledgeResources, setKnowledgeResources] = useState<KnowledgeResource[]>([]);
  const [copied, setCopied] = useState(false);
  const [requests, setRequests] = useState<LicensingRequest[]>(licensingRequests);
  const [mt5Login, setMt5Login] = useState("");
  const [brokerServer, setBrokerServer] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<"nexus" | "nexus_plus" | "vortex">(plan);
  const [submitting, setSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState("");
  const [websiteRequestRows, setWebsiteRequestRows] = useState<WebsiteRequest[]>(websiteRequests);
  const [notifications] = useState<MemberNotification[]>(memberNotifications);
  const [domainPreference, setDomainPreference] = useState<"vaulttrades_subdomain" | "custom_domain">("vaulttrades_subdomain");
  const [preferredNames, setPreferredNames] = useState(["", "", ""]);
  const [customDomain, setCustomDomain] = useState("");
  const [websiteSubmitting, setWebsiteSubmitting] = useState(false);
  const [websiteMessage, setWebsiteMessage] = useState("");
  useEffect(() => { fetch("/api/member-portal/content", { cache: "no-store" }).then(r => r.ok ? r.json() : Promise.reject(new Error("Resources unavailable"))).then(data => setKnowledgeResources(data.resources ?? [])).catch(() => setKnowledgeResources([])); }, []);
  useEffect(() => {
    const refreshLicensing = async () => {
      try {
        const response = await fetch("/api/member-portal/ea-licensing", { cache: "no-store" });
        if (!response.ok) return;
        const data = await response.json();
        setRequests(data.requests ?? []);
      } catch { /* Keep the last known delivery status if the network is temporarily unavailable. */ }
    };
    const interval = window.setInterval(() => { void refreshLicensing(); }, 30000);
    window.addEventListener("focus", refreshLicensing);
    return () => { window.clearInterval(interval); window.removeEventListener("focus", refreshLicensing); };
  }, []);
  const visibleSections = sections.filter(item => isAdmin || item.id !== "admin");
  const groups = useMemo(() => {
    const result: { group: string; items: typeof sections[number][] }[] = [];
    const query = topicSearch.trim().toLowerCase();
    for (const item of sections.filter(item => isAdmin || item.id !== "admin")) {
      if (query && !item.label.toLowerCase().includes(query) && !item.group.toLowerCase().includes(query)) continue;
      let group = result.find(entry => entry.group === item.group);
      if (!group) { group = { group: item.group, items: [] }; result.push(group); }
      group.items.push(item);
    }
    return result;
  }, [topicSearch, isAdmin]);
  const activeSection = visibleSections.find(item => item.id === active) ?? visibleSections[0];
  const activeIndex = visibleSections.findIndex(item => item.id === active) + 1;

  async function copyReferral() {
    if (!referralUrl) return;
    await navigator.clipboard.writeText(referralUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  async function submitLicensingRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!licensingActionsAvailable) {
      setSubmitMessage("Licensing submissions are temporarily unavailable.");
      return;
    }
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
      if (data.whatsappUrl) window.location.assign(data.whatsappUrl);
    } catch (error) {
      setSubmitMessage(error instanceof Error ? error.message : "Unable to submit your request.");
    } finally { setSubmitting(false); }
  }

  const allowedEaProducts = plan === "nexus"
    ? [{ value: "nexus", label: "VaultTrades Nexus" }]
    : plan === "nexus_plus"
      ? [{ value: "nexus", label: "VaultTrades Nexus" }, { value: "nexus_plus", label: "VaultTrades Nexus Plus" }]
      : [{ value: "nexus", label: "VaultTrades Nexus" }, { value: "nexus_plus", label: "VaultTrades Nexus Plus" }, { value: "vortex", label: "VaultTrades Vortex" }];

  async function submitWebsiteRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!requestActionsAvailable) {
      setWebsiteMessage("This preview can display the Knowledge Base, but website requests are disabled until the privileged request service is configured.");
      return;
    }
    setWebsiteSubmitting(true);
    setWebsiteMessage("");
    try {
      const response = await fetch("/api/member-portal/website-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          domainPreference,
          preferredName1: preferredNames[0],
          preferredName2: preferredNames[1],
          preferredName3: preferredNames[2],
          customDomain,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Unable to submit your website request.");
      setWebsiteRequestRows(current => [data.request, ...current]);
      setWebsiteMessage(data.message || "Your website request has been submitted.");
    } catch (error) {
      setWebsiteMessage(error instanceof Error ? error.message : "Unable to submit your website request.");
    } finally { setWebsiteSubmitting(false); }
  }

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
          <p className="vt-member-note">Use the left-hand topics in order. Supporting materials are added as named links to approved cloud-hosted resources, rather than uploading large files into the website.</p>
        </>;
      case "admin":
        return isAdmin ? <MemberPortalAdminPanel /> : <><h1>Not available.</h1></>;
      case "notifications":
        return <>
          <Eyebrow>MEMBER UPDATES</Eyebrow><h1>Your notifications.</h1>
          <p className="vt-member-lead">Important updates about your EA licensing and optional website setup appear here.</p>
          {notifications.length ? <div className="vt-member-notifications">{notifications.map(notification => <div className={notification.read_at ? "vt-member-notification read" : "vt-member-notification"} key={notification.id}>
            <div><strong>{notification.title}</strong><small>{new Date(notification.created_at).toLocaleString()}</small></div>
            <p>{notification.body}</p>
            {notification.action_href && <Link href={notification.action_href} className="vt-member-tool-link">Open related section ↗</Link>}
          </div>)}</div> : <div className="vt-member-pending"><strong>No new notifications.</strong><span>Updates will appear here when VaultTrades changes your licensing or website request status.</span></div>}
        </>;
      case "community":
        return <>
          <Eyebrow>GET STARTED</Eyebrow><h1>Join the VaultTrades community.</h1>
          <p className="vt-member-lead">Start here. The community is the main announcement channel for member updates, support information, trading-room notices and Google Meet invitations.</p>
          <a className="vt-member-button" href="/vaulttrades-community">Open VaultTrades Community</a>
          <h2>What to look out for</h2>
          <ul><li>Important product and member announcements.</li><li>Updates when a Google Meet trading-room session is scheduled.</li><li>Support guidance and notices about changes to the installation process.</li><li>Links to relevant learning sessions and resources.</li></ul>
          <CommunityCalendar isAdmin={isAdmin} />
          <p className="vt-member-note">Only meetings displayed in this calendar are current. Open the meeting button at the scheduled time. Do not reuse an old meeting URL.</p>
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
              <input required inputMode="numeric" pattern="[0-9]{4,12}" minLength={4} maxLength={12} value={mt5Login} onChange={event => setMt5Login(event.target.value.replace(/\D/g, "").slice(0, 12))} placeholder="Enter your MT5 login number" />
            </label>
            <label>Broker server (optional)
              <input value={brokerServer} onChange={event => setBrokerServer(event.target.value)} maxLength={120} placeholder="For example, XM server name shown in MT5" />
            </label>
            <p className="vt-member-form-note">Submit the MT5 account number only. Do not submit your trading password, investor password or one-time security code.</p>
            {!licensingActionsAvailable && <p className="vt-member-form-note">MT5 request submission is temporarily unavailable.</p>}
             <button className="vt-member-button" type="submit" disabled={submitting || !licensingActionsAvailable}>{submitting ? "Submitting…" : "Submit MT5 number"}</button>
            {submitMessage && <p className="vt-member-submit-message" role="status">{submitMessage}</p>}
          </form>
          <h2>Your licensing requests</h2>
          {requests.length ? <div className="vt-member-request-list">{requests.map(request => <div className="vt-member-request" key={request.id}>
            <div><strong>{request.product_code === "nexus" ? "VaultTrades Nexus" : request.product_code === "nexus_plus" ? "VaultTrades Nexus Plus" : "VaultTrades Vortex"}</strong><small>MT5 {request.mt5_login} · {request.broker_name} · {new Date(request.submitted_at).toLocaleString()}</small></div>
            <span className={"vt-member-request-status " + request.status}>{request.status.replace("_", " ")}</span>
            {request.status === "ready" && (request.license_resource_url ? <a className="vt-member-tool-link" href={request.license_resource_url} target="_blank" rel="noreferrer">{request.license_resource_name || "Open personalised EA"} ↗</a> : <a className="vt-member-tool-link" href={`/api/member-portal/ea-licensing/${request.id}/download`}>Download EA ↗</a>)}
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
            {request.license_resource_url ? <a className="vt-member-button" href={request.license_resource_url} target="_blank" rel="noreferrer">{request.license_resource_name || "Open EA link"}</a> : <a className="vt-member-button" href={`/api/member-portal/ea-licensing/${request.id}/download`}>Download EA</a>}
          </div>)}</div> : <div className="vt-member-pending"><strong>Your personalised EA is not ready yet.</strong><span>Once your MT5 request is approved and the licensed file is uploaded, the download will appear here.</span></div>}
          <h2>Before installing</h2><ul><li>Confirm that the EA name and build match your membership.</li><li>Use the installation guide for that exact product.</li><li>Keep the downloaded file private and do not redistribute it.</li></ul>
        </>;
      case "before-install":
        return <>
          <Eyebrow>PRE-INSTALLATION CHECKLIST</Eyebrow><h1>Before you install.</h1>
          <ul><li>Your VaultTrades membership is active and the personalised EA download is available.</li><li>You have the correct MT5 account open in the terminal.</li><li>MetaTrader 5 is connected to the broker and receiving live quotes.</li><li>The instrument you want to trade is visible in Market Watch.</li><li>At least 500 bars of history are available on the timeframe you intend to use.</li><li>Your account permits automated trading and you understand the selected risk-sizing mode.</li><li>You have the installation guide for the exact build you downloaded.</li></ul>
          <p className="vt-member-note">Do not attach a file licensed to another MT5 account. Do not share your trading password with VaultTrades or anyone assisting with installation.</p>
        </>;
      case "installation":
        return <>
          <Eyebrow>INSTALLATION · STANDARD NEXUS</Eyebrow><h1>Install and attach VaultTrades Nexus.</h1>
          <p className="vt-member-lead">These steps follow the supplied Nexus v1.04 installation guide. Use the separate Nexus Plus page if you are installing the no-window build.</p>
          <h2>Source-package files and folders</h2>
          <ul><li><strong>EA source:</strong> <code>MQL5\Experts\Advisors\VaultTrades_Nexus_v1_01.mq5</code></li><li><strong>Broker compatibility helper:</strong> <code>MQL5\Include\VaultTrades\BrokerCompat.mqh</code></li></ul>
          <h2>Copy or compile the EA</h2>
          <ol><li>In MT5, choose File → Open Data Folder.</li><li>Open the MQL5 folder.</li><li>Place the EA source or compiled EA file in <code>Experts\Advisors</code>.</li><li>Place <code>BrokerCompat.mqh</code> in <code>Include\VaultTrades</code>, creating the VaultTrades folder if required.</li><li>If VaultTrades supplies a compiled <code>.ex5</code> file, copy that file into <code>Experts\\Advisors</code> and skip source compilation. The source and helper files below are only needed when you are given the source package.</li><li>If your download contains <code>.mq5</code> source, press F4 to open MetaEditor, open the Nexus source and press F7 to compile. The supplied guide expects zero errors and zero warnings.</li><li>Return to MT5 and refresh Expert Advisors in the Navigator.</li></ol>
          <h2>Attach to your chart</h2>
          <ol><li>Open the intended instrument chart.</li><li>Select H4 for the primary Nexus setup or M15 for the secondary setup.</li><li>Drag VaultTrades Nexus from Navigator → Expert Advisors onto the chart.</li><li>In the Common tab, allow Algo Trading. Confirm the main MT5 Algo Trading toolbar switch is enabled.</li><li>Click OK and confirm the EA is running. Check the Experts tab for startup messages and account/symbol detection.</li></ol>
          <p className="vt-member-note">Do not attach Nexus Plus using this standard Nexus guide. Nexus Plus has an additional core-file dependency and its own H1 recommendation.</p>
          <p>The MT5 terminal must remain running and connected for a locally hosted EA to operate. A VPS is an optional way to keep the terminal running remotely.</p>
        </>;
      case "understanding":
        return <>
          <Eyebrow>PRODUCT OVERVIEW</Eyebrow><h1>Understanding the VaultTrades Nexus EA.</h1>
          <p className="vt-member-lead">VaultTrades Nexus is a native MetaTrader 5 implementation of the EMA20 Morning Trades strategy. It runs on the chart timeframe you select and evaluates completed candles rather than reacting to an unfinished candle.</p>
          <h2>How it operates</h2>
          <ul><li>One EA instance is attached to one chart and trades that chart's instrument.</li><li>The chart timeframe is the strategy timeframe for that instance.</li><li>It checks its strategy conditions on closed bars using a one-second scan timer.</li><li>It can hold one position at a time for that chart instance. After the position closes, a later qualifying setup may be considered.</li><li>Stop-loss and take-profit are attached to the order when it fills.</li></ul>
          <p className="vt-member-note">The EA does not guarantee a trade every day. It waits when its conditions are not met or when account, broker or trading-window checks prevent execution.</p>
        </>;
      case "ea-settings":
        return <>
          <Eyebrow>INPUTS & CONFIGURATION</Eyebrow><h1>Understanding EA settings.</h1>
          <h2>Position sizing</h2>
          <ul><li><strong>Auto risk sizing:</strong> the default mode calculates volume from account equity, the configured risk percentage, stop distance and broker volume rules.</li><li><strong>Risk percentage:</strong> default 1.0% of equity in Auto mode.</li><li><strong>Fixed lot:</strong> default 0.10 and used only when Fixed sizing is selected.</li><li><strong>Broker minimum volume:</strong> if the requested fixed lot is below the broker minimum, the order may be raised to the minimum. That can make the actual risk larger than intended.</li></ul>
          <h2>Strategy parameters</h2>
          <ul><li>EMA 20 and ATR 14.</li><li>UT Bot ATR period 10, sensitivity 1.0.</li><li>SMI settings 7, 2, 2.</li><li>Pivot length 3 and confirmation bars 3.</li><li>EMA touch threshold 0.20 ATR.</li><li>Stop-loss distance 2.23 ATR; take-profit distance 1.81 times the stop distance.</li><li>Scan timer: one second. The strategy evaluates completed bars.</li><li>Spread guard default: 0 points, which means the spread guard is off.</li></ul>
          <p className="vt-member-note">Do not change inputs casually. Use the supplied product defaults unless you understand the effect and have tested the change on a demo account.</p>
        </>;
      case "broker-detection":
        return <>
          <Eyebrow>BROKER COMPATIBILITY</Eyebrow><h1>Broker and instrument detection.</h1>
          <p className="vt-member-lead">The EA reads the chart instrument and resolves it to a tradable listing available on the connected broker account. Brokers may use different suffixes or aliases for the same underlying instrument.</p>
          <h2>Examples of broker symbol differences</h2>
          <ul><li>EURUSD may appear as EURUSDmicro or another broker-specific suffix.</li><li>Gold may be listed as XAUUSD, GOLD or a broker-specific variant.</li><li>Other suffixes can include forms such as .a, # or _ECN.</li></ul>
          <h2>Important checks</h2>
          <ol><li>Open the exact instrument you intend to trade in Market Watch.</li><li>Attach one EA instance to that instrument's chart.</li><li>Allow MT5 to load sufficient history; the manual specifies at least 500 bars on the selected timeframe.</li><li>Read the EA startup message in the Experts tab to confirm the resolved symbol and account permissions.</li></ol>
          <p className="vt-member-note">One chart instance covers one instrument. Symbol auto-detection does not mean one chart trades every instrument in your account. If a broker listing cannot be resolved or traded, the EA should report that in its logs rather than silently switching to an unrelated instrument.</p>
        </>;
      case "signals":
        return <>
          <Eyebrow>STRATEGY CONDITIONS</Eyebrow><h1>Understanding your trading signals.</h1>
          <p className="vt-member-lead">Nexus evaluates a combination of trend, pullback, candle and momentum conditions. A signal is considered only after the relevant candle has closed and the required confirmation checks agree.</p>
          <h2>Signal checks</h2>
          <ol><li>Market structure and EMA direction must support the trade direction.</li><li>Price must touch or approach EMA20 within the 0.20 ATR threshold.</li><li>A rejection candle and displacement condition must be present.</li><li>The required EMA break condition must be met.</li><li>UT Bot and SMI direction must agree.</li><li>The three-bar confirmation requirement must pass.</li><li>The completed signal candle must fall within the build's permitted trading window.</li></ol>
          <p>For the standard Nexus build, the signal-close window is 02:00–10:45 South African time. Signals outside that window are skipped. Nexus Plus is the alternative no-window build and evaluates every closed bar throughout the day.</p>
          <p className="vt-member-note">The strategy checks closed candles. It does not enter simply because price moves intrabar or because a chart briefly appears to point in one direction.</p>
        </>;
      case "execution":
        return <>
          <Eyebrow>ORDER LIFECYCLE</Eyebrow><h1>From signal to filled order.</h1>
          <ol><li>The EA completes the strategy checks on a closed candle.</li><li>It verifies the account, symbol, trading permissions, available history, position state and volume rules.</li><li>It calculates the requested volume using Auto risk or Fixed lot mode.</li><li>It sends a market order with a maximum deviation setting of 20 points and attaches the stop-loss and take-profit levels.</li><li>When the broker confirms the fill, the position is managed by its broker-side SL and TP.</li></ol>
          <h2>Stop-loss and take-profit</h2>
          <ul><li>Buy stop-loss: entry minus 2.23 ATR; sell stop-loss: entry plus 2.23 ATR.</li><li>Take-profit is set at 1.81 times the stop distance.</li><li>The EA does not use trailing stops, averaging, martingale or hedging.</li><li>After a position closes, the EA waits for another valid setup.</li></ul>
          <p className="vt-member-note">The standard Nexus magic number is based on 6111100 plus the chart timeframe value; Nexus Plus uses a separate magic-number base. A successful MT5 order response (retcode 10009, DONE) indicates the order was accepted. Other retcodes should be checked in the Experts and Journal tabs. A successful order response does not guarantee the exact requested fill price: slippage, gaps, spread changes and broker execution rules can affect the actual result.</p>
        </>;
      case "timeframes":
        return <>
          <Eyebrow>TIMEFRAME SELECTION</Eyebrow><h1>Recommended timeframes.</h1>
          <h2>VaultTrades Nexus — windowed build</h2>
          <p><strong>Primary:</strong> H4. <strong>Secondary:</strong> M15. M30 and H1 were acceptable but marginal in the supplied test sample. M5 is not recommended.</p>
          <div className="vt-member-table-wrap"><table className="vt-member-table"><thead><tr><th>Timeframe</th><th>Trades</th><th>Win rate</th><th>Guidance</th></tr></thead><tbody>
            <tr><td>H4</td><td>36 long-window trades</td><td>50.0%</td><td>Primary timeframe</td></tr>
            <tr><td>M15</td><td>58</td><td>41.4%</td><td>Secondary timeframe</td></tr>
            <tr><td>H1</td><td>103 long-window trades</td><td>40.8%</td><td>Marginal / acceptable</td></tr>
            <tr><td>M30</td><td>23</td><td>39.1%</td><td>Marginal</td></tr>
            <tr><td>M5</td><td>109</td><td>37.6%</td><td>Not recommended</td></tr>
          </tbody></table></div>
          <h2>VaultTrades Nexus Plus — no-window build</h2>
          <p>H1 is the recommended timeframe for Nexus Plus. It evaluates every closed bar across all hours. The supplied long-window H1 sample showed 41.9% wins over 272 trades; H4 and M15 had weaker risk characteristics in the supplied comparisons.</p>
          <p className="vt-member-note">These are historical test samples supplied with the product manuals, not independently verified live results or a forecast. Small samples, especially the two-trade Nexus H4 short sample, should not be treated as reliable evidence of future performance. Backtests do not guarantee future results.</p>
        </>;
      case "troubleshooting":
        return <>
          <Eyebrow>SUPPORT & DIAGNOSTICS</Eyebrow><h1>Troubleshooting.</h1>
          <div className="vt-member-faq">
            <details><summary>The EA does not open trades.</summary><p>Check that Algo Trading is enabled, the account permits automated trading, the EA is attached to the intended chart, the symbol is tradable and the required strategy conditions have occurred on a completed candle. Nexus signals outside 02:00–10:45 South African time are skipped.</p></details>
            <details><summary>The EA icon is grey or inactive.</summary><p>Check the toolbar Algo Trading switch, the EA's Common tab permission and Tools → Options → Expert Advisors. Confirm the broker account also permits automated trading.</p></details>
            <details><summary>No bar or signal information appears.</summary><p>Confirm the terminal has loaded at least 500 bars for the selected timeframe and that new quotes/history are arriving. Check Market Watch and the Experts tab.</p></details>
            <details><summary>The EA says the volume is too small or refuses sizing.</summary><p>Review the broker's minimum lot, lot step, contract specification and available margin. If the broker minimum forces a larger volume, the resulting risk may exceed the configured percentage.</p></details>
            <details><summary>The instrument is not available.</summary><p>Check the broker's exact symbol in Market Watch and read the resolved symbol in the startup log. Do not substitute a different instrument just because its name looks similar.</p></details>
            <details><summary>The order was rejected.</summary><p>Read the Experts and Journal tabs for the broker retcode and reason. Common causes include disabled trading, insufficient margin, invalid volume, market closure or symbol restrictions.</p></details>
            <details><summary>Will the EA run if I close my computer?</summary><p>Not when it is running locally. Your computer and MT5 terminal must remain on and connected. An optional VPS can host the terminal remotely.</p></details>
          </div>
        </>;
      case "nexus-plus":
        return <>
          <Eyebrow>ALTERNATIVE BUILD</Eyebrow><h1>VaultTrades Nexus Plus.</h1>
          <p className="vt-member-lead">Nexus Plus is an alternative no-window build, not simply an upgrade to the standard Nexus. It uses the Nexus core strategy while removing the standard 02:00–10:45 South African trading window.</p>
          <h2>Important installation differences</h2>
          <ul><li><strong>Plus source:</strong> <code>VaultTrades_Nexus_Plus_v1_01.mq5</code>.</li><li><strong>Required Nexus core source:</strong> <code>VaultTrades_Nexus_v1_01.mq5</code>, kept in the Advisors folder.</li><li><strong>Broker helper:</strong> <code>MQL5\Include\VaultTrades\BrokerCompat.mqh</code>.</li><li>Plus evaluates every completed candle throughout all hours.</li><li>Attach Plus to H1; H1 is the recommended timeframe for this build.</li><li>Compile the Plus source file only, following the supplied Plus guide. The compiled EX5 is self-contained after compilation.</li><li>Plus uses a separate magic-number base (6111200) and journal prefix from standard Nexus (6111100 plus the chart timeframe value).</li></ul>
          <p>If you receive only the compiled Plus <code>.ex5</code>, place it in the Advisors folder and skip source compilation. The Nexus core source is required when compiling the Plus source wrapper; do not delete, rename or move it during that process. If both builds are run, avoid attaching both to the same instrument and timeframe unless that behaviour is intentional and understood.</p>
          <p className="vt-member-note">The supplied tests recommend Nexus Plus on H1 only. It is an alternative for broader trading-hour coverage, not a universal performance upgrade.</p>
        </>;
      case "vps":
        return <>
          <Eyebrow>OPTIONAL REMOTE HOSTING</Eyebrow><h1>Keep your EA running with a VPS.</h1>
          <p className="vt-member-lead">A Virtual Private Server (VPS) is a remote computer that can keep MetaTrader 5 and your EA running when your personal computer is switched off or your home internet connection is interrupted.</p>
          <h2>Why members may choose a VPS</h2><ul><li>MetaTrader 5 can remain online independently of your home computer.</li><li>It can reduce interruptions caused by local power, internet or travel.</li><li>You can access the remote desktop to check the terminal when needed.</li></ul>
          <h2>Choose how you want to run MT5</h2>
          <ol><li><strong>Your own computer:</strong> install MT5 locally and keep the computer, terminal and internet connection running while the EA is expected to operate.</li><li><strong>A VPS provider:</strong> rent a remote Windows environment, install MT5 there, sign in to your broker account and attach your licensed EA.</li><li><strong>Another MT5-compatible setup:</strong> you may choose a different provider if it meets your broker, operating-system and terminal requirements.</li></ol>
          {vpsRegistrationUrl ? <a className="vt-member-button" href={vpsRegistrationUrl} target="_blank" rel="noreferrer">View recommended VPS partner ↗</a> : <div className="vt-member-pending"><strong>Recommended VPS partner link is being finalised</strong><span>You can still choose your own VPS provider or run MT5 locally. The partner link will be added when the affiliate arrangement is confirmed.</span></div>}
          <p className="vt-member-note">A VPS is optional and normally carries a separate recurring subscription. Compare Windows support, memory, CPU, location, latency to your broker server, support and cancellation terms. A VPS does not guarantee uninterrupted service, successful execution or profits.</p>
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
          <p className="vt-member-lead">The optional Google Meet room is for members who want to follow market discussion and explore additional trading opportunities beyond the EA's automated activity. The planned morning session is 06:00–07:00 South African time; the community announcement will confirm each session and provide the current Meet link.</p>
          <p>Meeting links and session updates will be posted in the community announcements. Check the latest announcement before joining.</p>
          <ul><li>Participation is optional.</li><li>The EA may already have taken trades before a live discussion begins.</li><li>Room discussions are educational and do not require you to place a trade.</li><li>Any manual trade remains your own decision and responsibility.</li></ul>
          <a className="vt-member-button" href="/vaulttrades-community">Check community announcements</a>
        </>;
      case "mentorship":
        return <>
          <Eyebrow>SEVEN-DAY LEARNING PROGRAMME</Eyebrow><h1>Build your trading knowledge with mentorship.</h1>
          <p className="vt-member-lead">The seven-day mentorship programme is a guided learning resource for members who want to develop their understanding of trading, market structure, risk management and trade execution. Review the topics and arrange your learning around the available booking options.</p>
          <h2>How to use the programme</h2>
          <ol><li>Open the programme and review the topics covered.</li><li>Choose the sessions or topics you want to focus on.</li><li>Where booking options permit, arrange sessions individually or group suitable sessions together.</li><li>Use the supplied slides and learning material to support each topic.</li><li>Apply the concepts on a demo account before changing a live trading routine.</li></ol>
          <a className="vt-member-button" href="/founders-mentorship">Open the seven-day mentorship programme ↗</a>
          <h2>One-on-one mentorship entitlement</h2>
          {hasVortex ? <p>Your VaultTrades Vortex plan includes one-on-one mentorship. Contact the VaultTrades team through the member community to arrange your included session. The existing Founders Mentorship page is a separately access-controlled programme, so do not purchase that programme merely to use your Vortex one-on-one entitlement.</p> : <div className="vt-member-pending"><strong>One-on-one mentorship is a Vortex plan benefit</strong><span>This benefit is not included in your current membership. You can still review the separately available mentorship programme and its terms.</span></div>}
          <p className="vt-member-note">Confirm session availability, booking conditions and any separately payable programme fee before booking. A booking is not confirmed until you receive confirmation. Mentorship is education, not a promise of trading results.</p>
        </>;
      case "scaling":
        return <>
          <Eyebrow>PAID SCALING RESOURCES</Eyebrow><h1>Scaling and KPI development.</h1>
          <p className="vt-member-lead">This module explains how to approach structured growth using the programmes and resources VaultTrades has selected and worked with. It is a learning pathway, not a guarantee of funding, account approval, payouts, trading returns or KPI achievement.</p>
          {plusOrVortex ? <>
            <h2>Work through the scaling process</h2>
            <ol><li><strong>Understand the KPI:</strong> identify the target, measurement period, rules and evidence required by the programme.</li><li><strong>Choose a suitable programme:</strong> compare current account types, fees, restrictions, drawdown rules and payout conditions.</li><li><strong>Prepare an operating plan:</strong> define risk limits, trading schedule, instruments and contingency rules before starting.</li><li><strong>Monitor progress:</strong> record performance, drawdown, consistency and rule compliance, not only headline profit.</li><li><strong>Review before scaling:</strong> increase exposure only when programme rules, results and risk capacity support the decision.</li><li><strong>Repeat with discipline:</strong> retain records and review setbacks without assuming previous results will repeat.</li></ol>
            <h2>Recommended programmes and resources</h2><p>Use the app's partner directory for current provider destinations. Check each provider's latest terms and rules before purchasing or applying.</p>
            <a className="vt-member-button" href="/partners">Explore recommended partners and programmes ↗</a>
            <h2>KPI and account tools</h2>
            <div className="vt-member-tool-list">
              <Tool title="Funded Account Wealth Builder" description="Organise account targets, progress and outstanding milestones." href="/funded-account-wealth-builder" unlocked={hasVortex} />
              <Tool title="Risk Manager" description="Calculate risk and position size before executing a plan." href="/risk-manager" unlocked={hasVortex} />
              <Tool title="Trading Journal" description="Record trades and review consistency, execution and drawdown." href="/journal" unlocked={plusOrVortex} />
            </div>
          </> : <div className="vt-member-pending"><strong>Scaling resources are included with Nexus Plus and Vortex</strong><span>Your current Nexus membership does not include this paid scaling module.</span><a className="vt-member-tool-link" href="/plans">Compare membership plans ↗</a></div>}
          <p className="vt-member-note">Provider terms, programme rules, fees, eligibility and availability can change. Each provider is a separate business and controls its own decisions. Results vary and no outcome is guaranteed.</p>
        </>;
      case "vortex-manual":
        if (!hasVortex) return <><Eyebrow>VORTEX MEMBERSHIP CONTENT</Eyebrow><h1>Vortex user manual.</h1><div className="vt-member-pending"><strong>VaultTrades Vortex membership required</strong><span>This product manual is available to Vortex members. Review the membership plans to see the Vortex package.</span><a className="vt-member-tool-link" href="/plans">View membership plans ↗</a></div></>;
        return <>
          <Eyebrow>VAULTTRADES VORTEX v1.01 · USER MANUAL</Eyebrow><h1>Understand how Vortex operates.</h1>
          <p className="vt-member-lead">Vortex is an automated gold-trading EA. It uses M5 market data regardless of the chart period on which it is attached. It is selective and session-bound; long periods without a trade are normal.</p>
          <h2>Operating principles</h2><ul><li>Uses completed M5 bars and configured New York Silver Bullet session windows.</li><li>One position at a time per symbol.</li><li>No grid trading, averaging into losing positions or stop-loss removal.</li><li>No guaranteed daily trade or profit.</li></ul>
          <h2>Trade lifecycle</h2><ol><li><strong>Initialisation:</strong> reads account and broker gold specifications, prints the Vortex verdict and displays <code>Status: READY</code>. This confirms initialisation, not profitability.</li><li><strong>Session filter:</strong> outside permitted windows, closed M5 bars are skipped with <code>OUTSIDE SILVER BULLET WINDOW</code>.</li><li><strong>Setup:</strong> evaluates completed impulse, retracement, confirmed retest and the minimum confluence score. Statuses may include <code>SETUP DEVELOPING</code> and <code>WAITING FOR VALID FIB SETUP</code>.</li><li><strong>Sizing:</strong> calculates volume and exit model from equity, risk, stop distance and broker volume constraints.</li><li><strong>Execution:</strong> checks spread, minimum stop distance, margin and permissions before sending a market order with SL attached.</li><li><strong>Management:</strong> uses supported partial exits or closes the full position at TP1 if broker minimum volume prevents five-way splitting.</li><li><strong>Completion:</strong> after the position closes, the panel returns to <code>Position: FLAT</code>.</li></ol>
          <h2>Chart panel</h2><p>Displays status, symbol/timeframe, sizing/volume, position, signal time and take-profit model.</p>
          <h2>Key settings</h2><ul><li>Position sizing: Auto by default; Fixed is optional.</li><li>Auto risk per trade: default 1% of equity; valid range is greater than 0 and no more than 10%.</li><li>Fixed lot: default 0.05.</li><li>Gold symbol: leave blank for broker resolution or enter the exact tradable broker symbol.</li><li>Spread limit: 0 disables the spread guard.</li><li>Close fully at TP1: optional Fixed-mode behaviour; Auto chooses the supported exit model.</li><li>Minimum confluence score: default 60/100.</li><li>Maximum bars from Fib touch to confirmed retest: default 8.</li></ul>
          <h2>Automatic sizing and broker minimums</h2><p>Auto sizing uses equity, risk percentage, stop distance and broker contract/volume specifications. Actual volume can differ across brokers. If the broker minimum forces actual risk above target, the EA should log a warning. Do not treat that minimum as a safe workaround; reduce risk or do not take the trade.</p>
          <h2>Five-way exit model</h2><p>Five partial exits are supported only when total volume is at least five times the broker's minimum volume. For a 0.10 minimum, at least 0.50 lots are required. Below that threshold, the full position closes at TP1 instead of attempting invalid partial orders.</p>
          <h2>Experts tab messages</h2><p>Look for <code>VaultTrades account |</code>, <code>Vortex verdict |</code>, <code>Vortex sizing |</code>, <code>Vortex volume plan |</code>, <code>Vortex signal |</code>, <code>Vortex skipped |</code>, <code>no trade opened:</code>, <code>execution blocked:</code>, <code>order rejected retcode=</code> and <code>Vortex near-miss</code>.</p>
          <h2>Historical test results supplied with v1.01</h2><p>User-supplied historical backtest figures, not independently verified live results or a forecast. Gold M5, M1 OHLC model, 5 January 2024 to 10 November 2026.</p>
          <div className="vt-member-table-wrap"><table className="vt-member-table"><thead><tr><th>Test</th><th>Trades</th><th>Win rate</th><th>Profit factor</th><th>Max drawdown</th></tr></thead><tbody><tr><td>A · Auto 1%, mixed exit</td><td>55</td><td>41.8%</td><td>1.012</td><td>8.85%</td></tr><tr><td>B · Fixed 0.50, five targets</td><td>97</td><td>54.6%</td><td>0.573</td><td>101.29% · account wiped</td></tr><tr><td>C · Auto 1%, five targets</td><td>109</td><td>54.1%</td><td>0.865</td><td>13.21%</td></tr><tr><td>D · Fixed 0.10, full close TP1</td><td>75</td><td>50.7%</td><td>1.217</td><td>11.99%</td></tr></tbody></table></div>
          <p>The default test was approximately breakeven, not evidence of a reliable edge. The fixed 0.50-lot test wiped the test account. The reported default run included six consecutive losses. Backtest outcomes do not guarantee future performance.</p>
          <h2>Limitations and safety</h2><ul><li>Gold-focused, M5 decision data and one position at a time per symbol.</li><li>Session-bound; no-trade periods are expected.</li><li>Broker contract specifications and execution conditions affect sizing and fills.</li><li>Stop-loss execution is not guaranteed at the requested price during gaps or slippage.</li><li>Test on demo first and size conservatively enough to withstand losing streaks.</li></ul>
        </>;
      case "vortex-install":
        if (!hasVortex) return <><Eyebrow>VORTEX MEMBERSHIP CONTENT</Eyebrow><h1>Vortex installation guide.</h1><div className="vt-member-pending"><strong>VaultTrades Vortex membership required</strong><span>This installation guide is available to Vortex members.</span><a className="vt-member-tool-link" href="/plans">View membership plans ↗</a></div></>;
        return <>
          <Eyebrow>VAULTTRADES VORTEX v1.01 · INSTALLATION GUIDE</Eyebrow><h1>Install and attach Vortex.</h1>
          <p className="vt-member-lead">This guide covers the compiled Vortex <code>.ex5</code> file. A source package is only needed if VaultTrades specifically supplies one.</p>
          <h2>Before you start</h2><ul><li>MT5 is installed and signed in to the correct broker account.</li><li>Your broker offers a tradable gold instrument.</li><li>Algo Trading is available for your account.</li><li>Your account has sufficient funds for the risk settings you intend to use.</li></ul>
          <h2>Install the compiled EA</h2><ol><li>In MT5 choose File → Open Data Folder.</li><li>Open <code>MQL5\\Experts\\Advisors\\</code>.</li><li>Copy <code>VaultTrades_Vortex_v1_01.ex5</code> into that folder.</li><li>Return to MT5, right-click Expert Advisors in Navigator and choose Refresh.</li><li>Find VaultTrades Vortex in Navigator.</li></ol>
          <h2>If source files are supplied</h2><p>Copy <code>BrokerCompat.mqh</code> and <code>StructureEngine.mqh</code> into <code>MQL5\\Include\\VaultTrades\\</code>, then place the <code>.mq5</code> source in <code>MQL5\\Experts\\Advisors\\</code>. Open MetaEditor, compile with F7 and confirm zero errors and zero warnings. If the package is incomplete, contact support rather than inventing missing helper files.</p>
          <h2>Attach to a gold chart</h2><ol><li>Open your broker's gold chart. Any chart period can be used; M5 is recommended for visual monitoring.</li><li>Drag VaultTrades Vortex onto the chart.</li><li>In Common, allow Algo Trading. Confirm the main MT5 Algo Trading toolbar switch is enabled.</li><li>Leave defaults unchanged for the initial demo test, then click OK.</li><li>Check the status indicator and Experts tab.</li></ol>
          <h2>Verify initialisation</h2><p>The Experts tab should print account information, monitoring symbol, Vortex verdict and initialisation messages. The chart should show <code>Status: READY</code>. The verdict confirms account reading, gold symbol resolution, sizing calculation and exit-model selection. It is not a signal and not proof of profitability.</p>
          <h2>Troubleshooting</h2><ul><li><strong>Missing from Navigator:</strong> check the folder and refresh Navigator.</li><li><strong>Grey/crossed smiley:</strong> enable Algo Trading in EA Common and the terminal toolbar.</li><li><strong>No usable broker specifications:</strong> select the broker's tradable gold listing in Market Watch or enter its exact symbol if the input is available.</li><li><strong>Not tradable:</strong> symbol may be disabled, close-only or outside broker hours; check with broker.</li><li><strong>No verdict:</strong> check attachment and permissions, then inspect Experts and Journal.</li><li><strong>Different symbol in verdict:</strong> confirm that the automatically resolved alias is the intended gold instrument.</li><li><strong>Trading not allowed:</strong> check account-level automated trading permission with broker.</li></ul>
          <h2>Update or remove</h2><p>To update, detach the EA, replace the EX5 and attach the new build. An EA detached from a chart cannot continue managing positions, so review open positions first. To remove Vortex, review open positions, detach the EA and delete the file from Experts\\Advisors.</p>
          <p className="vt-member-note">Use one Vortex instance per gold symbol. Start on demo, verify the account and symbol, and understand the risk settings before considering live use.</p>
        </>;
      case "resources":
        return <>
          <Eyebrow>VAULTTRADES RESOURCE DIRECTORY</Eyebrow><h1>Additional resources and partners.</h1>
          <p className="vt-member-lead">The partner directory is maintained inside the VaultTrades app. Use it as the current source for broker, prop-firm, tool and product destinations instead of relying on old copied links.</p>
          <a className="vt-member-button" href="/partners">Open Partners, Products & Tools ↗</a>
          <h2>What you will find</h2><ul><li><strong>Recommended brokers:</strong> registration destinations and referral information where published.</li><li><strong>Prop firms:</strong> providers to review when researching funded-account programmes.</li><li><strong>Trading tools:</strong> resources for planning, journaling and risk awareness.</li><li><strong>VaultTrades products:</strong> links to products and services included with eligible memberships.</li></ul>
          <h2>Use the directory responsibly</h2><ul><li>Review current provider fees, terms, restrictions and eligibility.</li><li>Check that a link opens the intended provider before submitting personal information or payment.</li><li>Partners are separate businesses and control their own products, approvals, support and payment processes.</li><li>Some referrals may generate a small once-off commission for VaultTrades; referral relationships do not change provider terms.</li></ul>
          <p className="vt-member-note">The directory is the source for current app-managed links. If a resource is not listed or its link is unavailable, contact VaultTrades rather than using an unverified destination.</p>
        </>;
      case "business":
        return <>
          <Eyebrow>YOUR VAULTTRADES BUSINESS</Eyebrow><h1>Understand the reseller programme.</h1>
          <p className="vt-member-lead">This learning path helps you understand the membership packages, explain the value accurately and introduce the programme responsibly to people who may benefit from it.</p>
          <h2>Know what you are explaining</h2>
          <ol><li>Understand the differences between VaultTrades Nexus, Nexus Plus and Vortex.</li><li>Explain the included products, tools, learning resources and plan-specific entitlements accurately.</li><li>Explain that broker funding, VPS hosting and any separately priced services are distinct from the membership fee.</li><li>Ask about the person's needs rather than automatically recommending the highest-priced plan.</li><li>Never promise profits, guaranteed trades, account approval or guaranteed commissions.</li></ol>
          <h2>Membership options at a glance</h2>
          <div className="vt-member-table-wrap"><table className="vt-member-table"><thead><tr><th>Membership</th><th>Once-off fee</th><th>Included learning and tools</th></tr></thead><tbody>
            <tr><td><strong>VaultTrades Nexus</strong></td><td>$150</td><td>Core Nexus membership and its applicable EA onboarding resources.</td></tr>
            <tr><td><strong>VaultTrades Nexus Plus</strong></td><td>$250</td><td>Nexus membership plus Analyzer, Trading Journal, AI Coaching and scaling resources.</td></tr>
            <tr><td><strong>VaultTrades Vortex</strong></td><td>$550</td><td>Nexus Plus resources, Vortex EA materials, advanced Risk Manager, Funded Account Wealth Builder and one-on-one mentorship entitlement.</td></tr>
          </tbody></table></div>
          <p className="vt-member-note">Personal website setup is a separate required reseller-programme setup charge of $39 once-off. A personalised custom domain is optional and any domain purchase or additional connection charge is separate. Confirm the final checkout breakdown before paying.</p>
          <h2>Keep the two programmes separate</h2>
          <ul><li><strong>Existing Referral Programme:</strong> the current referral arrangement for eligible VaultTrades products. Its existing attribution and commission rules remain separate.</li><li><strong>Reseller Programme:</strong> the membership-sales pathway being introduced through this opportunity. The working proposal is a commission on qualifying membership sales personally completed by the member, subject to final published terms.</li><li><strong>No downline:</strong> the working reseller model does not include multi-level or network commissions.</li></ul>
          <h2>How to introduce a membership</h2>
          <ol><li>Share the official opportunity information.</li><li>Let the person review the plan comparison and included resources.</li><li>Answer questions using the approved product descriptions and terms.</li><li>Direct them to the official checkout so the order and referrer can be attributed.</li><li>Follow up respectfully and allow them to decide without pressure.</li></ol>
          <p className="vt-member-note">Any proposed reseller commission rate, deductions, refund reversals and payout timing must be governed by the final approved reseller terms. Do not describe a working proposal as an already payable or guaranteed commission.</p>
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
          <Eyebrow>REQUIRED RESELLER SETUP</Eyebrow><h1>Set up your personal website.</h1>
          <p className="vt-member-lead">A personal website is a required part of the VaultTrades reseller programme. The setup fee is $39 once-off and is separate from your selected membership fee.</p>
          <h2>Choose how your website will be addressed</h2><ul><li><strong>Standard VaultTrades address:</strong> use an approved VaultTrades subdomain such as yourname.vaulttradesve.com.</li><li><strong>Your own personalised domain (optional):</strong> you may purchase and use a domain that you own, such as yourname.com. Once you have the domain, submit its details to VaultTrades so the team can review and connect it.</li></ul>
          <div className="vt-member-highlight"><strong>Required website setup</strong><span>$39 once-off</span><small>A personalised domain is optional. Domain purchase and any applicable connection fee are separate and will be confirmed before work begins.</small></div>
          <h2>Submit your website preferences</h2>
          <form className="vt-member-form" onSubmit={submitWebsiteRequest}>
            <label>Website option
              <select value={domainPreference} onChange={event => setDomainPreference(event.target.value as "vaulttrades_subdomain" | "custom_domain")}>
                <option value="vaulttrades_subdomain">VaultTrades subdomain</option>
                <option value="custom_domain">I already own a custom domain</option>
              </select>
            </label>
            {domainPreference === "vaulttrades_subdomain" ? <div className="vt-member-domain-choices">
              {preferredNames.map((value, index) => <label key={index}>Preferred subdomain {index + 1}
                <input required minLength={3} maxLength={30} pattern="[a-z0-9][a-z0-9-]{1,28}[a-z0-9]" value={value} onChange={event => setPreferredNames(current => current.map((name, i) => i === index ? event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") : name))} placeholder={index === 0 ? "firstchoice" : index === 1 ? "secondchoice" : "thirdchoice"} />
              </label>)}
              <p className="vt-member-form-note">Use 3–30 lowercase letters, numbers or hyphens. We will check all three choices and confirm which name is available.</p>
            </div> : <label>Your custom domain
              <input required value={customDomain} onChange={event => setCustomDomain(event.target.value.toLowerCase().trim())} placeholder="yourname.com" />
            </label>}
            {!requestActionsAvailable && <p className="vt-member-form-note">Admin preview: the guide and layout are available. Website request submission is disabled in this preview environment.</p>}
             <button className="vt-member-button" type="submit" disabled={websiteSubmitting || !requestActionsAvailable}>{websiteSubmitting ? "Submitting…" : "Submit website preferences"}</button>
            {websiteMessage && <p className="vt-member-submit-message" role="status">{websiteMessage}</p>}
          </form>
          <h2>Your website request status</h2>
          {websiteRequestRows.length ? <div className="vt-member-request-list">{websiteRequestRows.map(request => <div className="vt-member-request" key={request.id}>
            <div><strong>{request.domain_preference === "vaulttrades_subdomain" ? "VaultTrades subdomain" : "Custom domain"}</strong><small>{request.assigned_domain || request.custom_domain || [request.preferred_name_1, request.preferred_name_2, request.preferred_name_3].filter(Boolean).join(" · ")}</small></div>
            <span className={"vt-member-request-status " + request.status}>{request.status.replace("_", " ")}</span>
            {request.admin_notes && <p className="vt-member-note">{request.admin_notes}</p>}
          </div>)}</div> : <p className="vt-member-note">No website setup request has been submitted yet. Website setup is a required part of reseller onboarding.</p>}
          <p className="vt-member-note">If you want to use your own personalised domain, purchase and register it in your own name first, then submit the exact domain details here. VaultTrades will confirm the connection requirements and any applicable fee before linking it.</p>
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
            <details><summary>Is the personal website compulsory?</summary><p>Yes. Personal website setup is required for the reseller programme and costs $39 once-off, in addition to the membership fee. Using your own personalised domain is optional.</p></details>
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
          <div className="vt-member-sidebar-intro">
            <span>YOUR LEARNING PATH</span>
            <strong>Choose a topic</strong>
            <small>{sections.length} guides and resources</small>
          </div>
          <label className="vt-member-topic-search">
            <span className="sr-only">Search Knowledge Base topics</span>
            <input value={topicSearch} onChange={event => setTopicSearch(event.target.value)} placeholder="Search topics…" />
          </label>
          {groups.length ? groups.map(group => <div className="vt-member-nav-group" key={group.group}>
            <div className="vt-member-nav-heading"><span>{group.group}</span><small>{group.items.length}</small></div>
            {group.items.map(item => <button type="button" key={item.id} className={active === item.id ? "vt-member-nav-item active" : "vt-member-nav-item"} onClick={() => setActive(item.id)} aria-current={active === item.id ? "page" : undefined}>
              <span className="vt-member-nav-dot" aria-hidden="true" />{item.label}
            </button>)}
          </div>) : <p className="vt-member-no-results">No topics match that search.</p>}
        </aside>
        <article className="vt-member-content" aria-live="polite">
          <div className="vt-member-content-toolbar">
            <div><span>{activeSection.group}</span><strong>{activeSection.label}</strong></div>
            <small>GUIDE {String(activeIndex).padStart(2, "0")} / {visibleSections.length}</small>
          </div>
          {renderContent()}
          <ResourceShelf key={active} active={active} resources={knowledgeResources.filter(resource => resource.section_id === active)} isAdmin={isAdmin} onResourcesChange={(items) => setKnowledgeResources(current => [...current.filter(resource => resource.section_id !== active), ...items])} />
          <div className="vt-member-content-footer">
            <span>VaultTrades Member Knowledge Base</span>
            <button type="button" onClick={() => { const next = visibleSections[Math.min(activeIndex, visibleSections.length - 1)]; setActive(next.id); window.scrollTo({ top: 0, behavior: "smooth" }); }} disabled={activeIndex >= visibleSections.length}>Next topic →</button>
          </div>
        </article>
      </div>
    </main>
  );
}

const resourceSlots: Record<string, { title: string; kind: string; note: string }[]> = {
  community: [
    { title: "Community joining guide", kind: "PDF / quick-start guide", note: "Reserved for the illustrated guide to joining the official VaultTrades community." },
    { title: "Current Google Meet announcement", kind: "Live community link", note: "The current session link is published in community announcements so members do not use expired meeting links." },
  ],
  broker: [{ title: "Broker account-opening walkthrough", kind: "PDF / screenshots", note: "Reserved for annotated registration, verification and MT5 account-creation screenshots." }],
  mt5: [
    { title: "Where to find your MT5 login number", kind: "Screenshot guide", note: "Reserved for desktop and mobile screenshots showing the account number without exposing passwords." },
    { title: "MetaTrader 5 installation resource", kind: "Official download link", note: "The verified platform download destination will be placed here." },
  ],
  licensing: [{ title: "MT5 licensing submission walkthrough", kind: "Step-by-step screenshots", note: "Reserved for a visual walkthrough of the submission form and the information members should provide." }],
  generation: [{ title: "Licensing status guide", kind: "PDF / status reference", note: "Reserved for explanations of Submitted, In Progress, Ready and Rejected statuses." }],
  download: [{ title: "Personalised EA download", kind: "Private member attachment", note: "The licensed EA file appears in the download area above when the licensing team marks the request as ready." }],
  installation: [
    { title: "Nexus installation manual", kind: "PDF attachment", note: "Reserved for the approved Nexus installation manual and annotated MT5 screenshots." },
    { title: "Nexus installation video", kind: "Video tutorial", note: "Reserved for a screen-recorded installation walkthrough." },
  ],
  "nexus-plus": [{ title: "Nexus Plus installation manual", kind: "PDF attachment", note: "Reserved for the separate Nexus Plus guide and its core-file dependency instructions." }],
  "vortex-manual": [{ title: "Vortex user manual", kind: "PDF attachment", note: "Reserved for the approved Vortex manual and chart-panel reference images." }],
  "vortex-install": [{ title: "Vortex installation screenshots", kind: "Image attachments", note: "Reserved for the MT5 Data Folder, Advisors folder, Navigator and chart-attachment screenshots." }],
  vps: [
    { title: "VPS setup walkthrough", kind: "PDF / video", note: "Reserved for connecting to a Windows VPS, installing MT5 and transferring the licensed EA." },
    { title: "Recommended VPS provider", kind: "External registration link", note: "The tracked partner registration button will be enabled when the provider and referral URL are confirmed." },
  ],
  "trading-room": [{ title: "Trading-room session materials", kind: "Slides / recordings", note: "Reserved for approved session slides and recordings. The current live meeting link remains in community announcements." }],
  mentorship: [
    { title: "Seven-day mentorship presentation", kind: "Slide deck attachment", note: "Reserved for the complete mentorship slides, organised by day and topic." },
    { title: "Mentorship booking", kind: "Booking link", note: "Reserved for the confirmed scheduling link and booking conditions." },
  ],
  scaling: [
    { title: "Scaling and KPI workbook", kind: "Workbook / spreadsheet", note: "Reserved for the KPI tracker, milestones and review templates." },
    { title: "Scaling programme presentation", kind: "Slide deck attachment", note: "Reserved for the completed scaling presentation and supporting examples." },
  ],
  business: [
    { title: "Reseller programme guide", kind: "PDF attachment", note: "Reserved for the final approved reseller terms, direct-sale commission rules and member sales workflow." },
    { title: "Membership comparison sheet", kind: "PDF / comparison guide", note: "Reserved for the approved Nexus, Nexus Plus and Vortex comparison." },
  ],
  referrals: [{ title: "Existing referral programme guide", kind: "PDF attachment", note: "Reserved for the current eligible-product referral rules, attribution and payout information." }],
  website: [
    { title: "Personal website examples", kind: "Image gallery", note: "Reserved for sample member websites and the standard VaultTrades subdomain layout." },
    { title: "Website content checklist", kind: "PDF / editable template", note: "Reserved for the information and branding members must provide for website setup." },
  ],
  resources: [{ title: "Partner registration links", kind: "Verified external links", note: "Partner cards and current destinations are maintained in the VaultTrades Partners directory." }],
  tools: [{ title: "Tool access and plan matrix", kind: "PDF / quick reference", note: "Reserved for the final plan-by-plan digital tool access matrix." }],
  faq: [{ title: "Member quick-reference sheet", kind: "PDF attachment", note: "Reserved for a printable summary of common onboarding and troubleshooting questions." }],
};

function ResourceShelf({ active, resources, isAdmin, onResourcesChange }: { active: string; resources: KnowledgeResource[]; isAdmin: boolean; onResourcesChange: (items: KnowledgeResource[]) => void }) {
  const slots = (resourceSlots[active] ?? []).filter(slot => !resources.some(resource => resource.title.toLowerCase() === slot.title.toLowerCase()));
  const [editing, setEditing] = useState<KnowledgeResource | null>(null);
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState("External link");
  const [description, setDescription] = useState("");
  const [resourceUrl, setResourceUrl] = useState("");
  const [planCode, setPlanCode] = useState("all");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  if (!slots.length && !resources.length && !isAdmin) return null;

  function beginEdit(resource?: KnowledgeResource) {
    setEditing(resource ?? null); setTitle(resource?.title ?? ""); setKind(resource?.resource_kind ?? "External link");
    setDescription(resource?.description ?? ""); setResourceUrl(resource?.resource_url ?? "");
    setPlanCode(resource?.plan_codes?.[0] ?? "all"); setMessage("");
  }
  async function saveResource(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setMessage("");
    try {
      const response = await fetch("/api/member-portal/admin", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({
        action:"resource_upsert", id:editing?.id, sectionId:active, title, resourceKind:kind, description, resourceUrl, planCodes:planCode==="all"?[]:[planCode],
      })});
      const data=await response.json(); if(!response.ok) throw new Error(data.error||"Unable to save link.");
      onResourcesChange([...resources.filter(item=>item.id!==data.resource.id),data.resource]);
      beginEdit(); setMessage("Supporting link saved.");
    } catch(error) { setMessage(error instanceof Error?error.message:"Unable to save link."); }
    finally { setSaving(false); }
  }
  async function removeResource(id:string) {
    if(!window.confirm("Remove this supporting link from the Knowledge Base?")) return;
    const response=await fetch("/api/member-portal/admin",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"resource_delete",id})});
    const data=await response.json(); if(!response.ok){setMessage(data.error||"Unable to remove link.");return;}
    onResourcesChange(resources.filter(item=>item.id!==id)); setMessage("Supporting link removed.");
  }
  return <section className="vt-member-resource-shelf" aria-label="Topic attachments and resources">
    <div className="vt-member-resource-heading">
      <div><span>SUPPORTING MATERIAL</span><h2>Downloads, links & attachments</h2></div>
      <small>{resources.length ? `${resources.length} published link(s)` : "Reserved resource area"}</small>
    </div>
    <p className="vt-member-resource-explainer">Resources open from their approved cloud location. The Knowledge Base stores the resource title and link only; documents are not uploaded to this website.</p>
    <div className="vt-member-resource-grid">
      {resources.map(resource=><div className="vt-member-resource-card" key={resource.id}>
        <div className="vt-member-resource-icon" aria-hidden="true">↗</div>
        <div className="vt-member-resource-copy"><strong>{resource.title}</strong><span>{resource.resource_kind}</span>{resource.description&&<p>{resource.description}</p>}</div>
        <a className="vt-member-resource-open" href={resource.resource_url} target="_blank" rel="noreferrer">Open resource ↗</a>
        {isAdmin&&<div className="vt-member-resource-admin-actions"><button type="button" onClick={()=>beginEdit(resource)}>Edit</button><button type="button" onClick={()=>void removeResource(resource.id)}>Remove</button></div>}
      </div>)}
      {slots.map(slot=><div className="vt-member-resource-card" key={slot.title}>
        <div className="vt-member-resource-icon" aria-hidden="true">＋</div>
        <div className="vt-member-resource-copy"><strong>{slot.title}</strong><span>{slot.kind}</span><p>{slot.note}</p></div>
        <span className="vt-member-resource-status">Resource link to be added</span>
      </div>)}
    </div>
    {isAdmin&&<div className="vt-member-resource-editor">
      <h3>{editing?"Edit supporting link":"Add supporting link to this topic"}</h3>
      <form className="vt-member-form" onSubmit={saveResource}>
        <label>Resource name<input required value={title} onChange={e=>setTitle(e.target.value)} maxLength={140} placeholder="Name shown to members"/></label>
        <label>Link type<input value={kind} onChange={e=>setKind(e.target.value)} maxLength={80} placeholder="PDF guide, screenshot guide, registration, installation"/></label>
        <label>Resource description<textarea value={description} onChange={e=>setDescription(e.target.value)} maxLength={600} rows={2} placeholder="Brief explanation of what the link contains"/></label>
        <label>Cloud file / destination URL<input required type="url" value={resourceUrl} onChange={e=>setResourceUrl(e.target.value)} placeholder="https://drive.google.com/..."/></label>
        <label>Member access<select value={planCode} onChange={e=>setPlanCode(e.target.value)}><option value="all">All active memberships</option><option value="nexus">Nexus and above</option><option value="nexus_plus">Nexus Plus and above</option><option value="vortex">Vortex only</option></select></label>
        <div className="vt-calendar-form-actions"><button className="vt-member-button" type="submit" disabled={saving}>{saving?"Saving…":editing?"Update link":"Add link"}</button>{editing&&<button type="button" className="vt-member-outline" onClick={()=>beginEdit()}>Cancel edit</button>}</div>
      </form>
      {message&&<p className="vt-member-submit-message" role="status">{message}</p>}
    </div>}
  </section>;
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
