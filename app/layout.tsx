import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
  const origin = `${protocol}://${host}`;

  return {
    title: "經典文學闖關島｜高中統測篇",
    description: "踏上五座文學島嶼，與水墨守護生物一起破解字詞、文意、語藝、國學與綜合判讀。",
    icons: { icon: "/guardians/modian.jpg", shortcut: "/guardians/modian.jpg" },
    openGraph: {
      title: "經典文學闖關島",
      description: "五島自由探索，一起成為經典守護者。",
      type: "website",
      locale: "zh_TW",
      images: [{ url: `${origin}/og.png`, width: 1200, height: 630, alt: "經典文學闖關島與五位守護生物" }],
    },
    twitter: { card: "summary_large_image", title: "經典文學闖關島", description: "五島自由探索，一起成為經典守護者。", images: [`${origin}/og.png`] },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-Hant"><body>{children}</body></html>;
}
