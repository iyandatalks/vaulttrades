import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import AppNav from "./AppNav";
import VaultTradesFooter from "./VaultTradesFooter";

export const metadata: Metadata = {
  title: "VaultTrades",
  description: "Strategy-driven market chart analysis by VaultTrades.",
  icons: {
    icon: "/vaulttrades-logo.png",
    shortcut: "/vaulttrades-logo.png",
    apple: "/vaulttrades-logo.png",
  },
};

const priceFormattingScript = `(() => {
  const original = Number.prototype.toLocaleString;
  Number.prototype.toLocaleString = function(locales, options) {
    if (options && options.maximumFractionDigits === 5 && options.minimumFractionDigits === undefined) {
      return original.call(this, locales, { ...options, minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    return original.call(this, locales, options);
  };
})();`;

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <script dangerouslySetInnerHTML={{ __html: priceFormattingScript }} />
        <AppNav />
        {children}
        <VaultTradesFooter />
      </body>
    </html>
  );
}
