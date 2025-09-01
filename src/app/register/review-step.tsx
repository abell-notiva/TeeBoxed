'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { app } from '@/lib/firebase';
import { useWizardStore } from '@/hooks/use-wizard-store';
import { useRouter } from 'next/navigation';

function isValidSlug(s: string) {
  return /^[a-z0-9-]{3,50}$/.test(s);
}

export default function ReviewStep() {
  const auth = useMemo(() => getAuth(app), []);
  const router = useRouter();
  const { account, facility, plan, bays, reset } = useWizardStore();
  const [slugStatus, setSlugStatus] = useState<'idle' | 'checking' | 'ok' | 'taken' | 'invalid'>('idle');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Debounced slug check
  useEffect(() => {
    let cancelled = false;

    async function check() {
      if (!facility.slug) return setSlugStatus('idle');
      if (!isValidSlug(facility.slug)) return setSlugStatus('invalid');
      setSlugStatus('checking');
      try {
        const r = await fetch(`/api/facilities/check-slug?slug=${encodeURIComponent(facility.slug)}`);
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
  }, [facility.slug]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (!facility.name.trim()) {
      setError('Please enter a facility name.');
      return;
    }
    if (!isValidSlug(facility.slug)) {
      setError('Slug must be 3–50 chars, lowercase letters, numbers, or hyphens.');
      return;
    }
    if (slugStatus === 'taken') {
      setError('That subdomain is already taken. Please choose another.');
      return;
    }

    setSubmitting(true);
    try {
      // First create the user account
      const userCredential = await createUserWithEmailAndPassword(auth, account.email, account.password);
      const user = userCredential.user;
      const token = await user.getIdToken();

      // Then create the facility
      const res = await fetch('/api/facilities/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          facilityName: facility.name.trim(),
          slug: facility.slug.trim().toLowerCase(),
          address: `${facility.address}, ${facility.city}, ${facility.state} ${facility.zip}`.trim(),
          plan: { name: plan.id },
          bays: bays,
          ownerName: account.fullName,
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
      reset(); // Clear wizard data
      
      // Redirect to main dashboard (owners use main TeeBoxed dashboard)
      setTimeout(() => {
        router.push('/dashboard');
      }, 2000);
    } catch (err: any) {
      setError(err?.message ?? 'Unexpected error.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Review Your Information</h2>
        <p className="text-gray-600">Please review all details before creating your facility</p>
      </div>

      {/* Account Information */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h3 className="font-semibold text-gray-900 mb-3">Account Information</h3>
        <div className="space-y-2 text-sm">
          <div><span className="font-medium">Name:</span> {account.fullName}</div>
          <div><span className="font-medium">Email:</span> {account.email}</div>
        </div>
      </div>

      {/* Facility Information */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h3 className="font-semibold text-gray-900 mb-3">Facility Information</h3>
        <div className="space-y-2 text-sm">
          <div><span className="font-medium">Name:</span> {facility.name}</div>
          <div><span className="font-medium">Subdomain:</span> {facility.slug}.{process.env.NEXT_PUBLIC_MAIN_DOMAIN ?? 'teeboxed.com'}</div>
          <div><span className="font-medium">Address:</span> {facility.address}, {facility.city}, {facility.state} {facility.zip}</div>
          <div><span className="font-medium">Time Zone:</span> {facility.timeZone}</div>
        </div>
        <div className="mt-2">
          <span className="text-xs">
            {slugStatus === 'checking' && '🔄 Checking availability…'}
            {slugStatus === 'ok' && '✅ Subdomain available'}
            {slugStatus === 'taken' && '❌ Subdomain taken'}
            {slugStatus === 'invalid' && '❌ Invalid subdomain format'}
          </span>
        </div>
      </div>

      {/* Plan Information */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h3 className="font-semibold text-gray-900 mb-3">Selected Plan</h3>
        <div className="space-y-2 text-sm">
          <div><span className="font-medium">Plan:</span> {plan.id.charAt(0).toUpperCase() + plan.id.slice(1)}</div>
          <div><span className="font-medium">Billing:</span> {plan.billingFrequency.charAt(0).toUpperCase() + plan.billingFrequency.slice(1)}</div>
        </div>
      </div>

      {/* Bay Configuration */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h3 className="font-semibold text-gray-900 mb-3">Bay Configuration</h3>
        <div className="text-sm">
          <div><span className="font-medium">Total Bays:</span> {bays.length}</div>
          <div className="mt-2">
            <span className="font-medium">Bay Names:</span>
            <div className="flex flex-wrap gap-2 mt-1">
              {bays.map((bay, index) => (
                <span key={index} className="bg-white px-2 py-1 rounded text-xs border">
                  {bay.name}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <p className="text-red-600 text-sm">{error}</p>
        </div>
      )}
      
      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
          <p className="text-green-600 text-sm">✅ Facility created successfully! Redirecting to dashboard...</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <button
          type="submit"
          disabled={submitting || slugStatus === 'checking' || slugStatus === 'taken' || slugStatus === 'invalid'}
          className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-semibold py-3 px-4 rounded-lg transition-colors"
        >
          {submitting ? (
            <span className="flex items-center justify-center">
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Creating Facility...
            </span>
          ) : (
            'Create Facility & Complete Registration'
          )}
        </button>
      </form>
    </div>
  );
}
