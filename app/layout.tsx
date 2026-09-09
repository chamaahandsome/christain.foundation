import type { Metadata } from "next";
import { Hurricane } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import "./globals.css";

// The signature script (the Maltivas look) — used everywhere a typed
// signature renders: dialog previews, chips, and executed documents.
const hurricane = Hurricane({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-signature",
  display: "swap",
});

const description =
  "A home for sound doctrine — taught, sung, and lived. In essentials, UNITY. In non-essentials, liberty. In all things, charity.";

export const metadata: Metadata = {
  metadataBase: new URL("https://thecf.online"),
  title: {
    default: "Christian Foundation",
    template: "%s · Christian Foundation",
  },
  description,
  openGraph: {
    type: "website",
    siteName: "Christian Foundation",
    title: "Christian Foundation",
    description,
    url: "/",
    images: [{ url: "/og.jpg", width: 1200, height: 630, alt: "Christian Foundation — a home for sound doctrine" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Christian Foundation",
    description,
    images: ["/og.jpg"],
  },
};

const hasClerkKeys = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

/* Runs before paint so the page never flashes the wrong theme. Users with a
   saved choice get it; everyone else follows the OS, live. */
// Light is the default; dark only when the visitor explicitly chose it
// via the toggle (no OS-preference fallback).
const themeInitScript = `(function(){try{document.documentElement.classList.toggle("dark",localStorage.getItem("theme")==="dark")}catch(e){}})()`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const body = (
    <html lang="en" suppressHydrationWarning className={hurricane.variable}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="flex min-h-screen flex-col antialiased">
        <SiteHeader />
        <div className="flex-1">{children}</div>
        <SiteFooter />
      </body>
    </html>
  );
  return hasClerkKeys ? <ClerkProvider>{body}</ClerkProvider> : body;
}
