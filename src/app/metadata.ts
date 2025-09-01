
import type { Metadata } from "next";
import { headers } from "next/headers";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, limit } from 'firebase/firestore';

const defaultMetadata = {
  title: "TeeBoxed - Indoor Golf Facility Management",
  description: "Manage memberships, bookings, staff roles, and payments—all in one platform.",
};

export async function generateRootMetadata(
  serverHeaders?: Headers
): Promise<Metadata> {
  const h = serverHeaders || (await headers());
  const host = h.get("host") || "";

  const mainDomain = process.env.NEXT_PUBLIC_MAIN_DOMAIN || 'teeboxed.com';
  const studioDomainPattern = /--\d+--firebase-studio-[a-zA-Z0-9]+\.web\.app$/;

  let slug: string | null = null;

  if (studioDomainPattern.test(host)) {
      slug = host.split('--')[0];
  } else if (host !== mainDomain && host.endsWith(`.${mainDomain}`)) {
      slug = host.split('.')[0];
  }

  if (!slug || slug === 'www') {
    return defaultMetadata;
  }

  try {
    const q = query(collection(db, "facilities"), where("slug", "==", slug), limit(1));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      return {
        ...defaultMetadata,
        title: "Facility Not Found - TeeBoxed",
      };
    }

    const facilityData = querySnapshot.docs[0].data();

    return {
      title: `${facilityData.name} | Powered by TeeBoxed`,
      description: facilityData.description || `Book your bay at ${facilityData.name}, your premier indoor golf destination.`,
      openGraph: {
        title: facilityData.name,
        description: facilityData.description || `Book your bay at ${facilityData.name}.`,
        images: [
          {
            url: facilityData.logoUrl || '/default-og-image.png',
            width: 1200,
            height: 630,
            alt: `${facilityData.name} Logo`,
          },
        ],
      },
    };
  } catch (error) {
    console.error("Error fetching facility for metadata:", error);
    return defaultMetadata;
  }
}
