
'use client';
import { useEffect, useState } from 'react';
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { app } from '@/lib/firebase';
import { useRouter } from 'next/navigation';

export default function FacilityLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const auth = getAuth(app);
  const db = getFirestore(app);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const host = window.location.host;
        const main = process.env.NEXT_PUBLIC_MAIN_DOMAIN || 'teeboxed.com';
        let slug: string | null = null;
        if (host.endsWith(`.${main}`)) slug = host.slice(0, -(main.length + 1));
        if (!slug) return;
        try {
          const { query, where, collection, getDocs } = await import('firebase/firestore');
          const facilitiesCol = collection(db, 'facilities');
          const snap = await getDocs(query(facilitiesCol, where('slug', '==', slug)));
          if (snap.empty) return;
          const facilityId = snap.docs[0].id;
          const staffSnap = await getDoc(doc(db, 'facilities', facilityId, 'staff', user.uid));
          const role = staffSnap.exists() ? (staffSnap.data()?.role || 'member') : 'member';
          if (['owner','admin','staff','manager','trainer','maintenance'].includes(role)) {
            router.replace('/dashboard');
          } else {
            router.replace('/portal');
          }
        } catch {}
      }
    });
    return () => unsub();
  }, []);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try { await signInWithEmailAndPassword(auth, email, password); }
    catch (err: any) { setError(err.message || 'Login failed'); }
    finally { setLoading(false); }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 text-slate-100 p-6">
      <form onSubmit={handleLogin} className="w-full max-w-md bg-slate-800 rounded-2xl p-6 space-y-4 shadow-xl">
        <h1 className="text-2xl font-semibold">Facility Login</h1>
        <input placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} />
        <input type="password" placeholder="Password" value={password} onChange={e=>setPassword(e.target.value)} />
        {error && <p className="text-red-400 text-sm">{error}</p>}
        <button disabled={loading}>{loading ? 'Signing in…' : 'Sign In'}</button>
      </form>
    </div>
  );
}
