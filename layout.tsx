import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "VaultTrades AI — Chart Analyzer",
  description: "Strategy-driven chart analysis for Kill Zone, EMA and Continuation."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}