import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const slug = (searchParams.get('slug') || '').trim().toLowerCase();
  if (!slug || !/^[a-z0-9-]{3,50}$/.test(slug)) {
    return NextResponse.json({ ok: false, reason: 'invalid' }, { status: 400 });
  }
  const q = adminDb.collection('facilities').where('slug', '==', slug).limit(1);
  const existing = await q.get();
  return NextResponse.json({ ok: existing.empty });
}
