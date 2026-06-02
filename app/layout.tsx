import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Liquidity & Asset Platform",
  description: "Local-first, single-user, AED. Liquidity-first.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
