import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Crimson_Text } from "next/font/google";
import "./globals.css";
import { StorageGuard } from "@/components/StorageGuard";

const bricolageGrotesque = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
  display: "swap",
});

const crimsonText = Crimson_Text({
  variable: "--font-crimson",
  weight: ["400", "600", "700"],
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Burn Snap | Clinical Burn Assessment & Resuscitation",
  description: "Bedside AI burn assessment, wound scanning, 2D anatomical TBSA mapping, and deterministic Parkland fluid resuscitation.",
  applicationName: "Burn Snap",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/icon.png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
    shortcut: "/icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Burn Snap",
  },
  openGraph: {
    title: "Burn Snap — Clinical Burn Care & Triage",
    description: "Bedside AI burn assessment, wound scanning, TBSA mapping, and deterministic Parkland resuscitation.",
    siteName: "Burn Snap",
    images: [{ url: "/icon-512.png", width: 512, height: 512, alt: "Burn Snap Logo" }],
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#faeee7",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${bricolageGrotesque.variable} ${crimsonText.variable}`}
    >
      <head>
        <link rel="icon" href="/icon.png" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="apple-mobile-web-app-title" content="Burn Snap" />
        <meta name="application-name" content="Burn Snap" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body>
        {children}
        <StorageGuard />
      </body>
    </html>
  );
}
