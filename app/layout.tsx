import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import { Baloo_2, Nunito } from "next/font/google";
import "./globals.css";

const baloo = Baloo_2({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-baloo",
  display: "swap",
});

const nunito = Nunito({
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
  variable: "--font-nunito",
  display: "swap",
});

const siteUrl = "https://facepaintingbysue.co.uk";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Facepainting by Sue | Colourful face painting in Burton upon Trent",
  description:
    "Fun, colourful and professional face painting by Sue for birthdays, fairs, parties and events across Burton upon Trent and beyond.",
  keywords: [
    "face painting",
    "facepainting",
    "Burton upon Trent",
    "children's parties",
    "events",
    "fairs",
    "birthday parties",
  ],
  authors: [{ name: "Facepainting by Sue" }],
  openGraph: {
    title: "Facepainting by Sue",
    description:
      "Fun, colourful and professional face painting for birthdays, fairs, parties and events across Burton upon Trent.",
    url: siteUrl,
    siteName: "Facepainting by Sue",
    type: "website",
    locale: "en_GB",
    images: [
      {
        url: "/gallery/sue-01.jpg",
        width: 768,
        height: 1024,
        alt: "Colourful mermaid face-painting design by Sue",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Facepainting by Sue",
    description:
      "Fun, colourful face painting for birthdays, fairs, parties and events across Burton upon Trent.",
    images: ["/gallery/sue-01.jpg"],
  },
  icons: {
    icon: [
      { url: "/favicon/favicon.ico", sizes: "any" },
      { url: "/favicon/favicon-32x32.png", type: "image/png", sizes: "32x32" },
      { url: "/favicon/favicon-16x16.png", type: "image/png", sizes: "16x16" },
    ],
    apple: [{ url: "/favicon/apple-touch-icon.png" }],
  },
  manifest: "/favicon/site.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#fff7ee",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-GB" className={`${baloo.variable} ${nunito.variable}`}>
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
