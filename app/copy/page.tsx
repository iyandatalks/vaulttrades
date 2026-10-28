import CopyClient from "./CopyClient";

export const dynamic = "force-dynamic";

export default function CopyPage() {
  // The public landing page is browseable without a subscription. Subscriber
  // controls are conditionally rendered by CopyClient from server-verified API status.
  return <CopyClient />;
}
