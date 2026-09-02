import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import { Baloo_2, Nunito } from "next/font/google";
import { getPublicSite } from "@/lib/public-data";
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

export async function generateMetadata(): Promise<Metadata> {
  const publicSite = await getPublicSite();
  return {
    metadataBase: new URL(siteUrl),
    title: publicSite.settings.seoTitle,
    description: publicSite.settings.seoDescription,
    keywords: [
      "face painting",
      "facepainting",
      "Burton upon Trent",
      "children's parties",
      "events",
      "fairs",
      "birthday parties",
    ],
    authors: [{ name: publicSite.settings.name }],
    openGraph: {
      title: publicSite.settings.name,
      description: publicSite.settings.seoDescription,
      url: siteUrl,
      siteName: publicSite.settings.name,
      type: "website",
      locale: "en_GB",
      images: [
        {
          url: publicSite.ogSrc,
          width: 1000,
          height: 1333,
          alt: publicSite.hero?.alt ?? "Colourful face-painting design by Sue",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: publicSite.settings.name,
      description: publicSite.settings.seoDescription,
      images: [publicSite.ogSrc],
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
}

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
