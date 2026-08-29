'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { requestLoginOtpAction, verifyLoginOtpAction } from '@/lib/actions/auth';
import Link from 'next/link';

interface LoginClientProps {
  initialRedirect?: string;
  initialError?: string;
}

export default function LoginClient({ initialRedirect, initialError }: LoginClientProps) {
  const router = useRouter();

  // Form state
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // OTP Verification state (after sending link)
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  // Translate errors into clear Spanish without password mentions
  const translateAuthError = (msg: string): string => {
    const lower = msg.toLowerCase();
    if (lower.includes('invalid login credentials')) {
      return 'Credenciales inválidas. Verifica tu correo electrónico e inténtalo de nuevo.';
    }
    if (lower.includes('rate limit') || lower.includes('too many requests') || lower.includes('email rate limit exceeded')) {
      return 'Ha ocurrido un problema al enviar el enlace. Espera un momento o solicita un nuevo código.';
    }
    if (lower.includes('network') || lower.includes('fetch')) {
      return 'Error de conexión. Comprueba tu conexión a Internet e inténtalo de nuevo.';
    }
    return 'Ha ocurrido un problema al enviar el enlace. Espera un momento o solicita un nuevo código.';
  };

  const handleSendLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setError('Por favor, introduce un correo electrónico válido.');
      setLoading(false);
      return;
    }

    try {
      const supabase = createClient();
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const redirectTarget = initialRedirect ? encodeURIComponent(initialRedirect) : '';

      // 1. Trigger Supabase Magic Link
      const { error: supabaseError } = await supabase.auth.signInWithOtp({
        email: cleanEmail,
        options: {
          emailRedirectTo: `${origin}/auth/callback${redirectTarget ? `?next=${redirectTarget}` : ''}`,
        },
      });

      // 2. Trigger Server Action to dispatch Resend OTP code & console log
      await requestLoginOtpAction(cleanEmail);

      if (supabaseError) {
        console.warn('Supabase OTP response:', supabaseError.message);
        if (supabaseError.message.toLowerCase().includes('rate limit')) {
          // Permite continuar para usar el código maestro 202600 o el código de Resend
          setOtpSent(true);
          return;
        }
        setError(translateAuthError(supabaseError.message));
      } else {
        setOtpSent(true);
      }
    } catch (err: any) {
      setError(translateAuthError(err?.message || ''));
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setVerifying(true);
    setVerifyError(null);

    const cleanEmail = email.trim().toLowerCase();
    const cleanCode = otpCode.trim();

    try {
      const res = await verifyLoginOtpAction({ email: cleanEmail, code: cleanCode });
      if (!res.success) {
        setVerifyError(res.error || 'Código incorrecto. Vuelve a intentarlo.');
        setVerifying(false);
      } else {
        const dest = initialRedirect || res.destination;
        window.location.href = dest;
      }
    } catch (err: any) {
      setVerifyError(err?.message || 'Error verificando código.');
      setVerifying(false);
    }
  };

  return (
    <div className="max-w-md w-full animate-slide-up mx-auto p-4 sm:p-0">
      {/* Branding Header */}
      <div className="text-center mb-8">
        <Link href="/" className="inline-block mb-2">
          <h1 className="text-3xl font-black tracking-tight text-white">
            PingPong<span className="text-[var(--primary)]">CD</span>
          </h1>
        </Link>
        <p className="text-xs text-[var(--muted-foreground)] font-medium">
          Circuito oficial de Tenis de Mesa Ciudad Ducal
        </p>
      </div>

      {initialError === 'auth_failed' && (
        <div className="mb-6 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-sm flex items-start gap-3">
          <span className="text-lg">⚠️</span>
          <div>
            <p className="font-semibold">El enlace de acceso ha expirado</p>
            <p className="text-xs text-amber-200/80 mt-0.5">
              Introduce tu correo a continuación para recibir un nuevo enlace o código de acceso.
            </p>
          </div>
        </div>
      )}

      {otpSent ? (
        /* Confirmation & 6-Digit OTP Code Verification */
        <div className="animate-fade-in bg-surface-card p-6 sm:p-7 rounded-2xl border border-[var(--border)] shadow-xl text-center space-y-5">
          <div className="text-4xl">📬</div>
          <div>
            <h2 className="text-xl font-black text-white">Revisa tu correo</h2>
            <p className="text-xs text-[var(--muted-foreground)] mt-1.5 leading-relaxed">
              Hemos enviado un enlace de acceso directo a{' '}
              <strong className="text-white font-semibold">{email}</strong>.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-200 text-left leading-relaxed">
            <span>ℹ️ Puedes pulsar el enlace recibido en tu bandeja de entrada o introducir a continuación el código de 6 dígitos:</span>
          </div>

          <form onSubmit={handleVerifyOtp} className="space-y-4 pt-1">
            <div>
              <label htmlFor="otp-input" className="block text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)] mb-2">
                Código de Verificación (6 dígitos)
              </label>
              <input
                id="otp-input"
                type="text"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                maxLength={6}
                autoFocus
                className="w-full text-center tracking-[8px] font-mono text-2xl py-3 rounded-xl bg-[var(--secondary)] border border-[var(--border)] text-white placeholder:text-[var(--muted-foreground)]/40 focus:outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20"
              />
            </div>

            {verifyError && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-center justify-center gap-2">
                <span>❌</span>
                <span>{verifyError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={verifying || otpCode.length < 6}
              className="w-full py-3.5 px-4 rounded-xl gradient-primary text-white font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 hover:shadow-lg hover:shadow-[var(--primary)]/20 active:scale-[0.99]"
            >
              {verifying ? 'Verificando...' : 'Verificar y Entrar'}
            </button>
          </form>

          <div className="pt-2 border-t border-[var(--border)] flex justify-between items-center text-xs">
            <button
              type="button"
              onClick={() => { setOtpSent(false); setOtpCode(''); }}
              className="text-[var(--muted-foreground)] hover:text-white transition underline"
            >
              ← Usar otro correo
            </button>
            <span className="text-[10px] font-mono text-[var(--muted-foreground)]/60">
              Dev code: 202600
            </span>
          </div>
        </div>
      ) : (
        /* Single Email Form: Passwordless */
        <form onSubmit={handleSendLink} className="space-y-4 bg-surface-card p-6 sm:p-7 rounded-2xl border border-[var(--border)] shadow-xl">
          <div>
            <label htmlFor="login-email" className="block text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)] mb-2">
              Correo Electrónico (Email)
            </label>
            <input
              id="login-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ejemplo@gmail.com"
              required
              autoFocus
              autoComplete="email"
              className="w-full px-4 py-3 rounded-xl bg-[var(--secondary)] border border-[var(--border)] text-white placeholder:text-[var(--muted-foreground)]/60 focus:outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20 transition text-sm"
            />
          </div>

          {error && (
            <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm flex items-start gap-2.5">
              <span className="text-base">❌</span>
              <span className="flex-1">{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !email.trim()}
            className="w-full py-3.5 px-4 rounded-xl gradient-primary text-white font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 hover:shadow-lg hover:shadow-[var(--primary)]/20 active:scale-[0.99] flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Enviando enlace...</span>
              </>
            ) : (
              <span>Enviar Enlace Mágico / Acceder</span>
            )}
          </button>

          <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-200 flex items-center gap-2.5">
            <span>✨</span>
            <span>Acceso 100% sin contraseña. Recibirás un enlace directo y un código seguro en tu correo.</span>
          </div>
        </form>
      )}

      <div className="mt-8 pt-6 border-t border-[var(--border)] text-center text-xs text-[var(--muted-foreground)]">
        <span>¿No estás inscrito aún? </span>
        <Link href="/" className="text-[var(--primary)] font-medium hover:underline">
          Ver torneos activos
        </Link>
      </div>
    </div>
  );
}
