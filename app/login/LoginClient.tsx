'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { syncLoginSessionAction } from '@/lib/actions/auth';
import Link from 'next/link';

interface LoginClientProps {
  initialRedirect?: string;
  initialError?: string;
}

export default function LoginClient({ initialRedirect, initialError }: LoginClientProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'password' | 'otp'>('password');

  // Password tab state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // OTP tab state
  const [otpEmail, setOtpEmail] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);

  // Format Spanish error message
  const translateAuthError = (msg: string): string => {
    const lower = msg.toLowerCase();
    if (lower.includes('invalid login credentials')) {
      return 'Correo o contraseña incorrectos. Verifica tus credenciales e inténtalo de nuevo.';
    }
    if (lower.includes('email not confirmed')) {
      return 'El correo electrónico no ha sido confirmado. Puedes entrar con Magic Link o confirmarlo en el panel.';
    }
    if (lower.includes('rate limit') || lower.includes('too many requests') || lower.includes('email rate limit exceeded')) {
      return 'Has alcanzado el límite de envío de correos de Supabase (email rate limit exceeded). Por favor, utiliza la pestaña "Iniciar con Contraseña" para entrar al instante sin esperas.';
    }
    return msg;
  };

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordLoading(true);
    setPasswordError(null);

    try {
      const supabase = createClient();
      const cleanEmail = email.trim().toLowerCase();

      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

      if (error) {
        setPasswordError(translateAuthError(error.message));
        setPasswordLoading(false);
        return;
      }

      if (data?.user) {
        // Sync session, role and obtain target destination
        const syncResult = await syncLoginSessionAction(cleanEmail);
        const destination = initialRedirect || syncResult.destination;
        window.location.href = destination;
        return;
      }
    } catch (err: any) {
      setPasswordError(err?.message || 'Error inesperado al iniciar sesión');
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleOtpLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setOtpLoading(true);
    setOtpError(null);

    try {
      const supabase = createClient();
      const cleanEmail = otpEmail.trim().toLowerCase();
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const redirectTarget = initialRedirect ? encodeURIComponent(initialRedirect) : '';

      const { error } = await supabase.auth.signInWithOtp({
        email: cleanEmail,
        options: {
          emailRedirectTo: `${origin}/auth/callback${redirectTarget ? `?next=${redirectTarget}` : ''}`,
        },
      });

      if (error) {
        setOtpError(translateAuthError(error.message));
      } else {
        setOtpSent(true);
      }
    } catch (err: any) {
      setOtpError(err?.message || 'Error al solicitar el Magic Link');
    } finally {
      setOtpLoading(false);
    }
  };

  return (
    <div className="max-w-md w-full animate-slide-up mx-auto p-4 sm:p-0">
      <div className="text-center mb-8">
        <Link href="/" className="inline-block mb-3">
          <h1 className="text-3xl font-black tracking-tight text-white">
            Tourney<span className="text-[var(--primary)]">Master</span>
          </h1>
        </Link>
        <p className="text-sm text-[var(--muted-foreground)]">
          Control de acceso a torneos y portal de jugador
        </p>
      </div>

      {initialError === 'auth_failed' && (
        <div className="mb-6 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-sm flex items-start gap-3">
          <span className="text-lg">⚠️</span>
          <div>
            <p className="font-semibold">El enlace de acceso no pudo verificarse</p>
            <p className="text-xs text-amber-200/80 mt-0.5">
              Puede haber expirado o haberse consumido ya. Inicia sesión directamente con contraseña para entrar al instante.
            </p>
          </div>
        </div>
      )}

      {/* Tabs Selector */}
      <div className="flex rounded-xl bg-surface-card p-1 border border-[var(--border)] mb-6">
        <button
          type="button"
          onClick={() => setActiveTab('password')}
          className={`flex-1 py-2.5 px-3 rounded-lg text-xs sm:text-sm font-semibold transition-all duration-200 flex items-center justify-center gap-2 ${
            activeTab === 'password'
              ? 'bg-[var(--primary)] text-white shadow-md'
              : 'text-[var(--muted-foreground)] hover:text-white'
          }`}
        >
          <span>🔑</span>
          <span>Iniciar con Contraseña</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('otp')}
          className={`flex-1 py-2.5 px-3 rounded-lg text-xs sm:text-sm font-semibold transition-all duration-200 flex items-center justify-center gap-2 ${
            activeTab === 'otp'
              ? 'bg-[var(--primary)] text-white shadow-md'
              : 'text-[var(--muted-foreground)] hover:text-white'
          }`}
        >
          <span>✉️</span>
          <span>Acceso con Magic Link</span>
        </button>
      </div>

      {/* Tab 1: Password Login */}
      {activeTab === 'password' && (
        <form onSubmit={handlePasswordLogin} className="space-y-4">
          <div>
            <label htmlFor="email-password" className="block text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)] mb-2">
              Correo Electrónico (Email)
            </label>
            <input
              id="email-password"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ejemplo@gmail.com"
              required
              autoComplete="email"
              className="w-full px-4 py-3 rounded-xl bg-surface-card border border-[var(--border)] text-white placeholder:text-[var(--muted-foreground)]/60 focus:outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20 transition text-sm"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label htmlFor="password-field" className="block text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                Contraseña
              </label>
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="text-xs text-[var(--muted-foreground)] hover:text-white transition"
              >
                {showPassword ? 'Ocultar' : 'Mostrar'}
              </button>
            </div>
            <div className="relative">
              <input
                id="password-field"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
                className="w-full px-4 py-3 rounded-xl bg-surface-card border border-[var(--border)] text-white placeholder:text-[var(--muted-foreground)]/60 focus:outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20 transition text-sm pr-10"
              />
            </div>
          </div>

          {passwordError && (
            <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm flex items-start gap-2.5">
              <span className="text-base">❌</span>
              <span className="flex-1">{passwordError}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={passwordLoading || !email || !password}
            className="w-full py-3.5 px-4 rounded-xl gradient-primary text-white font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 hover:shadow-lg hover:shadow-[var(--primary)]/20 active:scale-[0.99] flex items-center justify-center gap-2"
          >
            {passwordLoading ? (
              <>
                <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Accediendo...</span>
              </>
            ) : (
              <span>Entrar a mi cuenta</span>
            )}
          </button>

          <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-200 flex items-center gap-2.5">
            <span>💡</span>
            <span>Acceso instantáneo recomendado para Superadmin y Jugadores sin límite de emails.</span>
          </div>
        </form>
      )}

      {/* Tab 2: OTP / Magic Link */}
      {activeTab === 'otp' && (
        <>
          {otpSent ? (
            <div className="text-center py-6 animate-fade-in bg-surface-card p-6 rounded-2xl border border-[var(--border)]">
              <div className="text-5xl mb-4">📬</div>
              <h2 className="text-xl font-bold text-white mb-2">Revisa tu bandeja de entrada</h2>
              <p className="text-sm text-[var(--muted-foreground)] mb-6 leading-relaxed">
                Hemos enviado un enlace de acceso directo a{' '}
                <strong className="text-white font-semibold">{otpEmail}</strong>.
                Pulsa el enlace recibido para iniciar sesión.
              </p>
              <button
                type="button"
                onClick={() => { setOtpSent(false); setOtpEmail(''); }}
                className="text-xs font-semibold text-[var(--primary)] hover:underline"
              >
                ← Usar otro correo o entrar con contraseña
              </button>
            </div>
          ) : (
            <form onSubmit={handleOtpLogin} className="space-y-4">
              <div>
                <label htmlFor="email-otp" className="block text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)] mb-2">
                  Correo Electrónico
                </label>
                <input
                  id="email-otp"
                  type="email"
                  value={otpEmail}
                  onChange={(e) => setOtpEmail(e.target.value)}
                  placeholder="ejemplo@gmail.com"
                  required
                  autoComplete="email"
                  className="w-full px-4 py-3 rounded-xl bg-surface-card border border-[var(--border)] text-white placeholder:text-[var(--muted-foreground)]/60 focus:outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20 transition text-sm"
                />
              </div>

              {otpError && (
                <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm flex items-start gap-2.5">
                  <span className="text-base">❌</span>
                  <span className="flex-1">{otpError}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={otpLoading || !otpEmail}
                className="w-full py-3.5 px-4 rounded-xl gradient-primary text-white font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 hover:shadow-lg hover:shadow-[var(--primary)]/20 active:scale-[0.99] flex items-center justify-center gap-2"
              >
                {otpLoading ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Enviando enlace...</span>
                  </>
                ) : (
                  <span>Enviar Magic Link</span>
                )}
              </button>
            </form>
          )}
        </>
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
