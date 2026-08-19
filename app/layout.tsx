import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import AppNav from "./AppNav";

export const metadata: Metadata = {
  title: "VaultTrades",
  description: "Strategy-driven market chart analysis by VaultTrades.",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <AppNav />
        {children}
      </body>
    </html>
  );
}
