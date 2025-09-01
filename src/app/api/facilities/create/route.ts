import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function verifyIdToken(authHeader: string | null) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const idToken = authHeader.split(' ')[1];
  try { return await adminAuth.verifyIdToken(idToken); } catch { return null; }
}

export async function POST(req: Request) {
  const user = await verifyIdToken(req.headers.get('authorization'));
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json();
  const { facilityName, slug, address, plan = { name: 'pro' } } = body || {};
  const cleanSlug = (slug || '').trim().toLowerCase();
  if (!cleanSlug || !/^[a-z0-9-]{3,50}$/.test(cleanSlug)) {
    return NextResponse.json({ error: 'invalid_slug' }, { status: 400 });
  }
  if (!facilityName) return NextResponse.json({ error: 'missing_facilityName' }, { status: 400 });

  const facilitiesRef = adminDb.collection('facilities');

  try {
    await adminDb.runTransaction(async (tx) => {
      const existingQuery = facilitiesRef.where('slug', '==', cleanSlug).limit(1);
      const existingSnap = await tx.get(existingQuery);
      if (!existingSnap.empty) throw new Error('slug_taken');

      const facilityDoc = facilitiesRef.doc();
      tx.set(facilityDoc, {
        ownerId: user.uid,
        name: facilityName,
        slug: cleanSlug,
        address: address || null,
        plan,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      tx.set(facilityDoc.collection('staff').doc(user.uid), {
        role: 'owner',
        displayName: (user as any).name || (user as any).email || 'Owner',
        createdAt: new Date(),
      });
    });
  } catch (err: any) {
    if (String(err.message).includes('slug_taken')) {
      return NextResponse.json({ error: 'slug_taken' }, { status: 409 });
    }
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
