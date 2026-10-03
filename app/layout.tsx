import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3102"),
  title: { default: "Edge Experiments", template: "%s · Edge Experiments" },
  description:
    "A/B tests and feature flags for conversion pages, assigned in Next.js proxy.ts before the page renders. Sticky cookies, no flicker, Wilson intervals and z-tests on the results page.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
