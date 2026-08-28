'use client';

import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';

function LoginForm() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirectTo') || '/player';

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?redirectTo=${encodeURIComponent(redirectTo)}`,
      },
    });

    if (error) {
      setError(error.message);
    } else {
      setSent(true);
    }
    setLoading(false);
  };

  if (sent) {
    return (
      <div className="max-w-md w-full text-center animate-slide-up">
        <div className="text-6xl mb-6">📧</div>
        <h1 className="text-2xl font-bold mb-4">Check your email</h1>
        <p className="text-[var(--muted-foreground)] mb-6">
          We sent a magic link to <strong className="text-[var(--foreground)]">{email}</strong>.
          Click the link in the email to sign in.
        </p>
        <button
          onClick={() => { setSent(false); setEmail(''); }}
          className="text-[var(--primary)] hover:underline"
        >
          Use a different email
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-md w-full animate-slide-up">
      <div className="text-center mb-8">
        <Link href="/" className="inline-block mb-6">
          <h1 className="text-3xl font-extrabold">
            Tourney<span className="text-[var(--primary)]">Master</span>
          </h1>
        </Link>
        <p className="text-[var(--muted-foreground)]">
          Sign in to manage or join tournaments
        </p>
      </div>

      <form onSubmit={handleLogin} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium mb-2">
            Email address
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            className="w-full px-4 py-3 rounded-xl bg-[var(--secondary)] border border-[var(--border)] text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20 transition"
          />
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-[var(--destructive)]/10 border border-[var(--destructive)]/20 text-[var(--destructive)] text-sm">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !email}
          className="w-full px-4 py-3 rounded-xl gradient-primary text-white font-semibold text-lg disabled:opacity-50 disabled:cursor-not-allowed transition-transform hover:scale-[1.02] active:scale-[0.98]"
        >
          {loading ? 'Sending...' : 'Send Magic Link'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-[var(--muted-foreground)]">
        No account needed — we'll create one automatically.
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <Suspense fallback={<div className="text-center">Loading...</div>}>
        <LoginForm />
      </Suspense>
    </main>
  );
}
