// src/lib/firebaseAdmin.ts
import { getApps, initializeApp, cert, App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

function initAdmin(): App {
  if (getApps().length) return getApps()[0]!;

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKeyRaw = process.env.FIREBASE_PRIVATE_KEY;

  const hasServiceAccount = !!(projectId && clientEmail && privateKeyRaw);

  // Prefer explicit service account when provided; otherwise fall back to ADC.
  if (hasServiceAccount) {
    const privateKey = privateKeyRaw!.replace(/\\n/g, '\n');
    return initializeApp({
      credential: cert({
        projectId: projectId!,
        clientEmail: clientEmail!,
        privateKey,
      } as any),
    });
  }

  // No service-account envs available (common on Firebase App Hosting at build):
  // Use Application Default Credentials (ADC) which Google environments provide.
  // Optionally pass projectId if you’ve set FIREBASE_PROJECT_ID; otherwise let ADC infer.
  return initializeApp(projectId ? { projectId } as any : undefined);
}

const adminApp = initAdmin();
export const adminAuth = getAuth(adminApp);
export const adminDb = getFirestore(adminApp);
