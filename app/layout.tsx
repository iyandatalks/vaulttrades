import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "VaultTrades AI",
  description: "AI-powered strategy-driven chart analysis",
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
