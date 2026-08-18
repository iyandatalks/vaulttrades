import type { Metadata } from "next";
import "./globals.css";
import AppNav from "./AppNav";

export const metadata: Metadata = {
  title: "VaultTrades",
  description: "Strategy-driven market chart analysis by VaultTrades.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <AppNav />
        {children}
      </body>
    </html>
  );
}
