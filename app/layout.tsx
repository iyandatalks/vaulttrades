import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "VaultTrades Analyzer",
  description:
    "Strategy-driven market chart analysis by VaultTrades.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
