import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { SiteHeader } from "@/components/SiteHeader";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Christian Foundation",
    template: "%s · Christian Foundation",
  },
  description:
    "A home for sound teaching — and for the people who teach it. In essentials, UNITY. In non-essentials, liberty. In all things, charity.",
};

const hasClerkKeys = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

/* Runs before paint so the page never flashes the wrong theme. Users with a
   saved choice get it; everyone else follows the OS, live. */
const themeInitScript = `(function(){try{var m=window.matchMedia("(prefers-color-scheme: dark)");function apply(){var s=localStorage.getItem("theme");document.documentElement.classList.toggle("dark",s==="dark"||(s!=="light"&&m.matches))}apply();m.addEventListener("change",apply)}catch(e){}})()`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const body = (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-screen antialiased">
        <SiteHeader />
        {children}
      </body>
    </html>
  );
  return hasClerkKeys ? <ClerkProvider>{body}</ClerkProvider> : body;
}
