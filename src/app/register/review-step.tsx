'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { getAuth } from 'firebase/auth';
import { app } from '@/lib/firebase'; // your client SDK initializer

type Props = {
  // If your page passes these in as props, keep them.
  // Otherwise this component can render its own mini-form.
  initialFacilityName?: string;
  initialSlug?: string;
  initialAddress?: string;
};

function isValidSlug(s: string) {
  return /^[a-z0-9-]{3,50}$/.test(s);
}

export default function ReviewStep(props: Props) {
  const auth = useMemo(() => getAuth(app), []);
  const [facilityName, setFacilityName] = useState(props.initialFacilityName ?? '');
  const [slug, setSlug] = useState((props.initialSlug ?? '').toLowerCase());
  const [address, setAddress] = useState(props.initialAddress ?? '');
  const [slugStatus, setSlugStatus] = useState<'idle' | 'checking' | 'ok' | 'taken' | 'invalid'>('idle');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Debounced slug check
  useEffect(() => {
    let cancelled = false;

    async function check() {
      if (!slug) return setSlugStatus('idle');
      if (!isValidSlug(slug)) return setSlugStatus('invalid');
      setSlugStatus('checking');
      try {
        const r = await fetch(`/api/facilities/check-slug?slug=${encodeURIComponent(slug)}`);
        const data = await r.json().catch(() => ({}));
        if (!cancelled) setSlugStatus(data.ok ? 'ok' : 'taken');
      } catch {
        if (!cancelled) setSlugStatus('idle');
      }
    }

    const t = setTimeout(check, 350);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [slug]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (!facilityName.trim()) {
      setError('Please enter a facility name.');
      return;
    }
    if (!isValidSlug(slug)) {
      setError('Slug must be 3–50 chars, lowercase letters, numbers, or hyphens.');
      return;
    }
    if (slugStatus === 'taken') {
      setError('That subdomain is already taken. Please choose another.');
      return;
    }

    setSubmitting(true);
    try {
      const user = auth.currentUser;
      if (!user) {
        setError('You must be signed in first.');
        return;
      }
      const token = await user.getIdToken();

      const res = await fetch('/api/facilities/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          facilityName: facilityName.trim(),
          slug: slug.trim().toLowerCase(),
          address: address.trim() || null,
          plan: { name: 'pro' }, // adjust if you support plan selection here
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data?.error === 'slug_taken') {
          setError('That subdomain was just taken. Try a different one.');
        } else if (data?.error === 'unauthorized') {
          setError('Session expired. Please sign in again.');
        } else if (data?.error === 'invalid_slug') {
          setError('Invalid slug.');
        } else {
          setError('Server error creating facility. Try again.');
        }
        return;
      }

      setSuccess(true);
      // Optional: redirect the user to their new facility domain
      // window.location.href = `https://${slug}.${process.env.NEXT_PUBLIC_MAIN_DOMAIN ?? 'teeboxed.com'}/dashboard`;
    } catch (err: any) {
      setError(err?.message ?? 'Unexpected error.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-4 text-slate-100">
      <h2 className="text-xl font-semibold mb-4">Review & Create Facility</h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm mb-1">Facility Name</label>
          <input
            value={facilityName}
            onChange={(e) => setFacilityName(e.target.value)}
            className="w-full rounded px-3 py-2 bg-slate-800 outline-none"
            placeholder="Tigers Den Golf"
          />
        </div>

        <div>
          <label className="block text-sm mb-1">Facility Subdomain (slug)</label>
          <div className="flex items-center gap-2">
            <input
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase())}
              className="flex-1 rounded px-3 py-2 bg-slate-800 outline-none"
              placeholder="tigers-den"
            />
            <span className="text-sm opacity-80">. {process.env.NEXT_PUBLIC_MAIN_DOMAIN ?? 'teeboxed.com'}</span>
          </div>
          <p className="text-xs mt-1 opacity-80">
            {slugStatus === 'checking' && 'Checking availability…'}
            {slugStatus === 'ok' && 'Available.'}
            {slugStatus === 'taken' && 'Already taken.'}
            {slugStatus === 'invalid' && 'Only lowercase letters, numbers, and hyphens. 3–50 chars.'}
          </p>
        </div>

        <div>
          <label className="block text-sm mb-1">Address (optional)</label>
          <input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className="w-full rounded px-3 py-2 bg-slate-800 outline-none"
            placeholder="123 Golf St, Denver CO"
          />
        </div>

        {error && <div className="text-red-400 text-sm">{error}</div>}
        {success && <div className="text-emerald-400 text-sm">Facility created successfully!</div>}

        <button
          type="submit"
          disabled={submitting || slugStatus === 'checking'}
          className="px-4 py-2 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-semibold"
        >
          {submitting ? 'Creating…' : 'Create Facility'}
        </button>
      </form>
    </div>
  );
}
