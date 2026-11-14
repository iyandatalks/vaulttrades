import CommunityHubClient from "./CommunityHubClient";
import "./community-hub.css";

export const metadata = {
  title: "VaultTrades Community | Trade · Technology · Build",
  description: "The central VaultTrades community for announcements, member progress, shared learning and business participation.",
};

export default function VaultTradesCommunityPage() {
  return <CommunityHubClient />;
}
