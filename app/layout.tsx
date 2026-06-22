import type { Metadata } from "next";
import { getSetting } from "@/lib/db/settings";
import "./globals.css";

export const metadata: Metadata = {
  title: "KYNZi",
  description: "Local-first, single-user, AED. Liquidity-first.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const theme = (() => {
    try { return getSetting("theme"); } catch { return "dark"; }
  })();

  return (
    <html lang="en" data-theme={theme}>
      <body>{children}</body>
    </html>
  );
}
