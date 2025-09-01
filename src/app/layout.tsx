
import type { Metadata } from "next";
import { Poppins, PT_Sans } from 'next/font/google';
import "./globals.css";
import { cn } from "@/lib/utils";
import { generateRootMetadata } from "./metadata";
import { headers } from "next/headers";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, limit } from "firebase/firestore";

const poppins = Poppins({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-poppins',
  weight: ['400', '500', '600', '700'],
});

const pt_sans = PT_Sans({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-pt-sans',
  weight: ['400', '700'],
});

async function getFacilityColors(host: string): Promise<{ primary?: string; accent?: string }> {
  const mainDomain = process.env.NEXT_PUBLIC_MAIN_DOMAIN || 'teeboxed.com';
  const studioDomainPattern = /--\d+--firebase-studio-[a-zA-Z0-9]+\.web\.app$/;
  let slug: string | null = null;

  if (studioDomainPattern.test(host)) {
      slug = host.split('--')[0];
  } else if (host !== mainDomain && host.endsWith(`.${mainDomain}`)) {
      slug = host.split('.')[0];
  }

  if (!slug || slug === 'www') {
    return {};
  }
  
  try {
    const q = query(collection(db, "facilities"), where("slug", "==", slug), limit(1));
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
        const facilityData = querySnapshot.docs[0].data();
        return facilityData.colors || {};
    }
  } catch (error) {
    console.error("Failed to fetch facility colors", error);
  }

  return {};
}

function hexToHsl(hex: string): string | null {
    if (!hex) return null;
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) return null;

    let r = parseInt(result[1], 16) / 255;
    let g = parseInt(result[2], 16) / 255;
    let b = parseInt(result[3], 16) / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0, s = 0, l = (max + min) / 2;

    if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }

    h = Math.round(h * 360);
    s = Math.round(s * 100);
    l = Math.round(l * 100);

    return `${h} ${s}% ${l}%`;
}


export async function generateMetadata(): Promise<Metadata> {
  const h = await headers();
  return generateRootMetadata(h);
}


export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const h = await headers();
  const host = h.get("host") || "";
  const { primary, accent } = await getFacilityColors(host);

  const primaryHsl = hexToHsl(primary || '#059669');
  const accentHsl = hexToHsl(accent || '#a7f3d0');

  const backgroundHsl = hexToHsl('#F0F4EF');

  return (
    <html lang="en" className="h-full">
       <head>
        <style>
          {`
            :root {
              ${primaryHsl ? `--primary: ${primaryHsl};` : ''}
              ${accentHsl ? `--accent: ${accentHsl};` : ''}
              ${backgroundHsl ? `--background: ${backgroundHsl};` : ''}
            }
          `}
        </style>
      </head>
      <body className={cn("h-full font-body antialiased", poppins.variable, pt_sans.variable)}>
        {children}
      </body>
    </html>
  );
}
