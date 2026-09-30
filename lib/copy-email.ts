const BASE_URL = "https://vaulttradesve.com";
const FROM_EMAIL = "no-reply@vaulttradesve.com";

export async function sendCopyActivationEmail(args: {
  to: string;
  mt5Login: string | null;
  accessUntil: string | null;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || !args.to) return { sent: false, reason: "email_not_configured" };

  const accessUntil = args.accessUntil
    ? new Date(args.accessUntil).toLocaleString("en-ZA", {
        timeZone: "Africa/Johannesburg",
        dateStyle: "medium",
      })
    : "Your active subscription period";

  const downloadUrl = BASE_URL + "/downloads/VaultTrades_Copier.ex5";
  const copyUrl = BASE_URL + "/copy";

  const html = `
    <div style="background:#070b12;color:#f4f6fb;padding:32px;font-family:Arial,Helvetica,sans-serif;line-height:1.6">
      <div style="max-width:680px;margin:0 auto;background:#0d1420;border:1px solid #202b3a;border-radius:14px;padding:28px">
        <div style="color:#d4a637;font-size:18px;font-weight:900;letter-spacing:.12em">VAULTTRADES</div>
        <p style="color:#aeb5c6">Built by Traders. Focus, discipline, consistency.</p>
        <h1 style="font-size:24px">Copy Trading access is active</h1>
        <p>Your VaultTrades Copy Trading subscription has been activated and your MT5 account is linked to your VaultTrades entitlement.</p>
        <p><strong>MT5 Account:</strong> ${args.mt5Login || "Registered account"}<br/>
        <strong>Access Until:</strong> ${accessUntil}</p>
        <p><a href="${downloadUrl}" style="display:inline-block;background:#d4a637;color:#050812;padding:12px 18px;border-radius:8px;text-decoration:none;font-weight:800">Download VaultTrades Copier</a></p>
        <p>After installing the EX5 in MT5, open the VaultTrades Copy page to generate your pairing code and complete activation.</p>
        <p><a href="${copyUrl}" style="color:#d4a637;font-weight:800">Open VaultTrades Copy Trading</a></p>
        <p style="margin-top:24px;color:#7f8a99;font-size:12px"><strong style="color:#aeb5c6">Disclaimer:</strong> VaultTrades is an analytical and trading-support platform. It does not provide financial advice, investment advice or a guarantee of trading results. Trading involves substantial risk and users remain solely responsible for their own trading decisions.</p>
        <div style="margin-top:18px;color:#687387;font-size:11px">© 2026 VaultTrades. All rights reserved.</div>
      </div>
    </div>`;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "VaultTrades <" + FROM_EMAIL + ">",
      to: [args.to],
      subject: "VaultTrades Copy Trading access is active",
      html,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    console.error("VaultTrades Copy activation email failed", response.status, body);
    return { sent: false, reason: "resend_error" };
  }

  return { sent: true };
}
