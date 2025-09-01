// src/server/facilities.ts
import { headers } from 'next/headers';
import { adminDb } from '@/lib/firebaseAdmin';

const MAIN_DOMAIN = process.env.NEXT_PUBLIC_MAIN_DOMAIN || 'teeboxed.com';

function extractSlugFromHost(host: string | null): string | null {
  if (!host) return null;
  const lower = host.toLowerCase();

  // local/dev: no subdomain slug
  if (lower.includes('localhost')) return null;

  // Firebase preview hosts: {slug}--{id}--firebase-studio-*.web.app
  const previewMatch = lower.match(/^([a-z0-9-]+)--\d+--firebase-studio-[a-z0-9-]+\.web\.app$/);
  if (previewMatch) return previewMatch[1];

  // *.teeboxed.com
  if (lower.endsWith(`.${MAIN_DOMAIN}`)) {
    const sub = lower.slice(0, -(MAIN_DOMAIN.length + 1));
    if (sub && sub !== 'www' && sub !== 'app') return sub;
  }
  return null;
}

export async function getFacilityByHost() {
  // NOTE: in your setup, headers() returns a Promise<ReadonlyHeaders>
  const h = await headers();
  const host = h.get('host');
  const slug = extractSlugFromHost(host);
  if (!slug) return null;

  const snap = await adminDb.collection('facilities').where('slug', '==', slug).limit(1).get();
  if (snap.empty) return null;
  const doc = snap.docs[0];
  return { id: doc.id, ...(doc.data() as any) };
}

export function hostToSlug(host: string | null) {
  return extractSlugFromHost(host);
}
