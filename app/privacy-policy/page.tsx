import Link from "next/link";

export default function PrivacyPolicyPage() {
  return (
    <main className="vt-privacy-page">
      <section>
        <div className="vt-privacy-kicker">VAULTTRADES · PRIVACY NOTICE</div>
        <h1>Your information.<br /><span>Your choices.</span></h1>
        <p className="vt-privacy-updated">Last updated: 12 November 2026</p>
        <h2>Information collected on the opportunity page</h2>
        <p>When you request access to the VaultTrades opportunity overview, we collect the first name, email address and cellphone number you submit. We also record the source of the enquiry and the privacy and marketing choices you make.</p>
        <h2>Why we use it</h2>
        <p>We use the information you submit to process your request, provide the opportunity information and respond to questions about that request. If you separately opt in, we may also send VaultTrades marketing updates through the channel you selected.</p>
        <h2>Marketing choices</h2>
        <p>Email and WhatsApp marketing permissions are optional and separate. You can request to stop marketing messages at any time by replying to the message with an opt-out request or contacting VaultTrades. Withdrawing marketing permission does not affect messages needed to respond to an enquiry you initiated.</p>
        <h2>Storage and access</h2>
        <p>Enquiry details are stored in VaultTrades' access-controlled application database and are available to authorised personnel who need them to manage enquiries. We do not display your contact details publicly. We do not sell personal information.</p>
        <h2>Retention and your rights</h2>
        <p>We retain enquiry information only for as long as reasonably necessary for the purposes described above, to manage the relationship and to meet applicable legal obligations. Subject to applicable law, you may request access to or correction or deletion of your information, or object to or withdraw consent where consent is the basis for processing.</p>
        <h2>Contact VaultTrades</h2>
        <p>For privacy questions, access or correction requests, or to withdraw a marketing choice, contact the VaultTrades team through the official WhatsApp contact below.</p>
        <a className="vt-privacy-contact" href="https://wa.me/27746653633?text=Hello%20VaultTrades%2C%20I%20have%20a%20privacy%20request." target="_blank" rel="noopener noreferrer">CONTACT VAULTTRADES</a>
        <p className="vt-privacy-note">This notice describes the lead form's current data use. VaultTrades should keep this notice aligned with its final legal-entity details, retention schedule, service providers and full POPIA compliance documentation.</p>
        <Link href="/start" className="vt-privacy-back">Back to the access page</Link>
      </section>
    </main>
  );
}
