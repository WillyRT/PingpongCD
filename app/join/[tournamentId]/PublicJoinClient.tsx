'use client';

import { useState, useTransition, useRef } from 'react';
import Link from 'next/link';
import { QRCodeSVG } from 'qrcode.react';
import { determineAgeCategory, getCategoryLabel } from '@/lib/engine/categories';
import {
  lookupPlayerByEmailAction,
  searchExistingPlayersAction,
  searchHistoricalPlayersAction,
  publicJoinTournamentAction,
  verifyPlayerRegistrationAction,
  type ExistingPlayerSuggestion,
} from '@/lib/actions/registration';
import { joinTournamentAction } from '@/lib/actions/tournament';
import type { TournamentRow, ProfileRow } from '@/lib/types/database';
import type { AgeCategory } from '@/lib/types/domain';

interface PublicJoinClientProps {
  tournament: TournamentRow;
  participantCount: number;
  currentUser: { id: string; email: string } | null;
  existingProfile: ProfileRow | null;
  isAlreadyRegistered?: boolean;
}

export function PublicJoinClient({
  tournament,
  currentUser,
  existingProfile,
  isAlreadyRegistered = false,
}: PublicJoinClientProps) {
  const [email, setEmail] = useState(currentUser?.email || existingProfile?.email || '');
  const [name, setName] = useState(existingProfile?.nickname || existingProfile?.name || '');
  const [birthDateOrAge, setBirthDateOrAge] = useState<string>(existingProfile?.birth_date || '20');
  const [declaredLevel, setDeclaredLevel] = useState<number>(existingProfile?.declared_level ?? 5.0);
  const [isLockedByHistory, setIsLockedByHistory] = useState(!!existingProfile?.rating);
  const [historicalRating, setHistoricalRating] = useState<number | null>(
    existingProfile?.rating ? Math.round(existingProfile.rating) : null
  );
  const [lookupMessage, setLookupMessage] = useState<string | null>(null);

  // Historical autocomplete state
  const [suggestions, setSuggestions] = useState<ExistingPlayerSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedHistoricalPlayer, setSelectedHistoricalPlayer] = useState<ExistingPlayerSuggestion | null>(null);
  const [isSearchingPlayers, setIsSearchingPlayers] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [category, setCategory] = useState<AgeCategory>(() => {
    return determineAgeCategory(Number(birthDateOrAge) || 20);
  });

  const [showQR, setShowQR] = useState(false);
  const [copied, setCopied] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [showManualForm, setShowManualForm] = useState(false);

  // Verification step state (fallback)
  const [step, setStep] = useState<'form' | 'verify'>('form');
  const [otpCode, setOtpCode] = useState('');
  const [devCode, setDevCode] = useState<string | null>(null);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  // Calculate provisional preview rating
  const provisionalPreview = Math.round(1100 + (declaredLevel / 10) * (2050 - 1100));

  const handleAgeChange = (val: string) => {
    setBirthDateOrAge(val);
    const parsedNum = Number(val);
    if (!isNaN(parsedNum) && parsedNum > 0) {
      try {
        setCategory(determineAgeCategory(parsedNum));
      } catch {
        // partial input
      }
    } else if (val.includes('-')) {
      try {
        setCategory(determineAgeCategory(val));
      } catch {
        // partial input
      }
    }
  };

  const handleNameChange = (val: string) => {
    setName(val);
    if (selectedHistoricalPlayer && val.trim() !== selectedHistoricalPlayer.name) {
      setSelectedHistoricalPlayer(null);
      setIsLockedByHistory(false);
      setHistoricalRating(null);
      setLookupMessage(null);
    }

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (val.trim().length >= 2) {
      setIsSearchingPlayers(true);
      searchTimeoutRef.current = setTimeout(async () => {
        try {
          const res = await searchExistingPlayersAction(val);
          if (res.success && res.data && res.data.length > 0) {
            setSuggestions(res.data);
            setShowSuggestions(true);
          } else {
            setSuggestions([]);
            setShowSuggestions(false);
          }
        } catch {
          setSuggestions([]);
          setShowSuggestions(false);
        } finally {
          setIsSearchingPlayers(false);
        }
      }, 300);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
      setIsSearchingPlayers(false);
    }
  };

  const handleSelectSuggestion = (s: ExistingPlayerSuggestion) => {
    setName(s.name);
    setSelectedHistoricalPlayer(s);
    setHistoricalRating(s.rating);
    setIsLockedByHistory(true);
    setShowSuggestions(false);

    if (s.emailReal && !email) {
      setEmail(s.emailReal);
    }

    if (s.birthDate) {
      setBirthDateOrAge(s.birthDate);
      setCategory(determineAgeCategory(s.birthDate));
    } else if (s.category) {
      setCategory(s.category);
    }

    setLookupMessage(`Vinculado a ${s.name} (ELO Glicko-2: ${s.rating}${s.ratingDeviation ? ` ±${s.ratingDeviation}` : ''})`);
  };

  const handleUnlinkHistorical = () => {
    setSelectedHistoricalPlayer(null);
    setIsLockedByHistory(false);
    setHistoricalRating(null);
    setLookupMessage(null);
  };

  const handleEmailBlur = async () => {
    if (!email || !email.includes('@')) return;

    const res = await lookupPlayerByEmailAction(email);
    if (res.success && res.data?.found) {
      if (res.data.name && !name) setName(res.data.name);
      if (res.data.rating) {
        setHistoricalRating(res.data.rating);
        setIsLockedByHistory(true);
        setLookupMessage(`Jugador reconocido con rating histórico: ${res.data.rating}`);
      }
      if (res.data.category) {
        setCategory(res.data.category);
      }
    }
  };

  const appOrigin = typeof window !== 'undefined' ? window.location.origin : 'https://tourneymaster.app';
  const joinUrl = `${appOrigin}/join/${tournament.id}`;

  const handleCopyLink = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(joinUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // 1-Click Fast Join for Authenticated Users
  const handleQuickJoin = () => {
    setError(null);
    startTransition(async () => {
      const res = await joinTournamentAction(tournament.slug || tournament.id, category);
      if (!res.success) {
        setError(res.error || 'Error al procesar la inscripción');
      } else {
        setSuccess(true);
      }
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email || !name) {
      setError('Por favor, completa tu email y tu nombre');
      return;
    }

    startTransition(async () => {
      const res = await publicJoinTournamentAction({
        tournamentIdOrSlug: tournament.id,
        email,
        name,
        birthDateOrAge: Number(birthDateOrAge) || birthDateOrAge,
        declaredLevel,
        historicalPlayerId: selectedHistoricalPlayer?.id,
        historicalRating: historicalRating ?? undefined,
      });

      if (!res.success) {
        setError(res.error || 'Error al procesar la inscripción');
      } else {
        setSuccess(true);
      }
    });
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setVerifyError(null);
    if (!otpCode || otpCode.trim().length < 6) {
      setVerifyError('Por favor, introduce el código completo de 6 dígitos.');
      return;
    }

    setVerifyLoading(true);
    try {
      const res = await verifyPlayerRegistrationAction({
        email,
        code: otpCode.trim(),
        tournamentId: tournament.id,
      });

      if (!res.success) {
        setVerifyError(res.error || 'Error verificando el código');
      } else {
        setSuccess(true);
      }
    } catch (err: any) {
      setVerifyError(err?.message || 'Error inesperado verificando el código');
    } finally {
      setVerifyLoading(false);
    }
  };

  if (step === 'verify' && !success) {
    return (
      <div className="max-w-md w-full p-8 rounded-2xl bg-[var(--card)] border border-[var(--border)] text-center animate-slide-up shadow-2xl space-y-6">
        <div className="w-16 h-16 rounded-2xl bg-blue-500/15 border border-blue-500/30 text-blue-400 flex items-center justify-center text-3xl mx-auto shadow-inner">
          ✉️
        </div>

        <div>
          <h2 className="text-2xl font-black mb-1">Verifica tu Correo</h2>
          <p className="text-xs text-[var(--muted-foreground)] leading-relaxed">
            Hemos enviado un código de seguridad de 6 dígitos a <strong className="text-white">{email}</strong>.
            Introdúcelo para confirmar la posesión de tu cuenta y activar tu sesión segura.
          </p>
        </div>

        {devCode && (
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-300 flex items-center justify-between">
            <span>⚡ Modo Desarrollo (Código OTP):</span>
            <span className="font-mono font-black text-sm tracking-wider">{devCode}</span>
          </div>
        )}

        {verifyError && (
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-semibold">
            {verifyError}
          </div>
        )}

        <form onSubmit={handleVerifyCode} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-[var(--muted-foreground)] mb-2 uppercase tracking-wider">
              Código de 6 dígitos
            </label>
            <input
              type="text"
              required
              maxLength={6}
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value.replace(/[^0-9]/g, ''))}
              placeholder="000000"
              autoFocus
              autoComplete="one-time-code"
              className="w-full text-center tracking-[0.5em] font-mono text-3xl font-black py-3 px-4 rounded-xl bg-[var(--secondary)] border border-[var(--border)] focus:outline-none focus:border-[var(--primary)] text-white shadow-inner"
            />
          </div>

          <button
            type="submit"
            disabled={verifyLoading || otpCode.trim().length < 6}
            className="w-full py-3.5 rounded-xl gradient-primary text-white font-bold text-sm shadow-lg hover:opacity-95 transition disabled:opacity-50"
          >
            {verifyLoading ? 'Verificando...' : 'Verificar y Confirmar Inscripción'}
          </button>
        </form>

        <div className="pt-2 border-t border-[var(--border)] flex items-center justify-between text-xs">
          <button
            type="button"
            onClick={() => {
              setStep('form');
              setVerifyError(null);
            }}
            className="text-[var(--muted-foreground)] hover:text-white underline"
          >
            ← Cambiar datos / email
          </button>
          <button
            type="button"
            onClick={(e) => handleSubmit(e)}
            className="text-[var(--primary)] hover:underline font-semibold"
          >
            Reenviar código
          </button>
        </div>
      </div>
    );
  }

  // Already Registered Screen
  if (isAlreadyRegistered) {
    return (
      <div className="max-w-md w-full p-8 rounded-2xl bg-[var(--card)] border border-[var(--border)] text-center animate-slide-up shadow-xl space-y-5">
        <div className="text-5xl mb-2">🏓</div>
        <h2 className="text-2xl font-black text-white">¡Ya estás inscrito!</h2>
        <p className="text-sm text-[var(--muted-foreground)]">
          Tu participación en <strong>{tournament.name}</strong> ya se encuentra confirmada.
        </p>

        {existingProfile && (
          <div className="p-4 rounded-xl bg-[var(--secondary)] border border-[var(--border)] text-left space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-[var(--muted-foreground)]">Jugador:</span>
              <span className="font-bold text-white">{existingProfile.name || existingProfile.nickname}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--muted-foreground)]">Correo:</span>
              <span className="text-[var(--foreground)]">{existingProfile.email}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--muted-foreground)]">Categoría:</span>
              <span className="font-bold text-[var(--primary)]">
                {existingProfile.category ? getCategoryLabel(existingProfile.category) : 'General'}
              </span>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-3 pt-2">
          <Link
            href={`/t/${tournament.slug}`}
            className="w-full py-3.5 rounded-xl gradient-primary text-white font-bold text-center shadow-lg hover:opacity-95 transition flex items-center justify-center gap-2 text-sm"
          >
            🏆 Ver el Cuadro del Torneo
          </Link>
          <Link
            href="/me"
            className="w-full py-3 rounded-xl bg-[var(--secondary)] text-[var(--foreground)] font-semibold text-center hover:bg-[var(--secondary)]/80 transition flex items-center justify-center gap-2 border border-[var(--border)] text-sm"
          >
            👤 Mi Portal de Jugador
          </Link>
          <Link
            href="/"
            className="text-xs text-[var(--muted-foreground)] hover:text-white pt-2 text-center"
          >
            ← Volver a la Portada
          </Link>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="max-w-md w-full p-8 rounded-2xl bg-[var(--card)] border border-green-500/30 text-center animate-slide-up shadow-xl">
        <div className="text-6xl mb-4">🎉</div>
        <h2 className="text-2xl font-bold mb-2">¡Inscripción Confirmada!</h2>
        <p className="text-[var(--muted-foreground)] mb-4">
          Has sido registrado correctamente en <strong>{tournament.name}</strong>.
        </p>

        <div className="p-4 rounded-xl bg-[var(--secondary)]/50 border border-[var(--border)] text-left mb-6 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-[var(--muted-foreground)]">Jugador:</span>
            <span className="font-semibold">{name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--muted-foreground)]">Categoría asignada:</span>
            <span className={`font-semibold ${category === 'sub14' ? 'text-amber-400' : 'text-blue-400'}`}>
              {getCategoryLabel(category)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--muted-foreground)]">Rating de partida:</span>
            <span className="font-semibold text-[var(--primary)]">
              {historicalRating ?? provisionalPreview} pts
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <Link
            href="/me"
            className="w-full py-3.5 rounded-xl gradient-primary text-white font-bold text-center shadow-lg hover:opacity-95 transition flex items-center justify-center gap-2"
          >
            👤 Ir a Mi Perfil de Jugador
          </Link>
          <Link
            href={`/t/${tournament.slug}`}
            className="w-full py-3 rounded-xl bg-[var(--secondary)] text-[var(--foreground)] font-semibold text-center hover:bg-[var(--secondary)]/80 transition flex items-center justify-center gap-2 border border-[var(--border)]"
          >
            🏆 Ver el Cuadro del Torneo en Vivo
          </Link>
          <Link
            href="/"
            className="w-full py-2 text-xs text-[var(--muted-foreground)] hover:text-white text-center"
          >
            Volver al Inicio
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-lg w-full">
      {/* Header */}
      <div className="text-center mb-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--secondary)] text-xs font-semibold mb-3">
          <span>🏓</span>
          <span>TourneyMaster AI • Registro Oficial</span>
        </div>
        <h1 className="text-3xl font-extrabold mb-1">{tournament.name}</h1>
      </div>

      {/* Share / QR Buttons */}
      <div className="flex items-center justify-center gap-3 mb-6">
        <button
          type="button"
          onClick={handleCopyLink}
          className="px-4 py-2 rounded-xl bg-[var(--secondary)] hover:bg-[var(--secondary)]/80 text-xs font-medium flex items-center gap-2 transition-colors"
        >
          {copied ? '✓ Enlace Copiado' : '🔗 Copiar Enlace de Invitación'}
        </button>

        <button
          type="button"
          onClick={() => setShowQR(!showQR)}
          className="px-4 py-2 rounded-xl bg-[var(--secondary)] hover:bg-[var(--secondary)]/80 text-xs font-medium flex items-center gap-2 transition-colors"
        >
          <span>📱</span>
          <span>{showQR ? 'Ocultar QR' : 'Mostrar QR'}</span>
        </button>
      </div>

      {/* QR Code Card */}
      {showQR && (
        <div className="mb-6 p-6 rounded-2xl bg-[var(--card)] border border-[var(--border)] text-center animate-slide-up flex flex-col items-center">
          <div className="p-4 bg-white rounded-2xl shadow-lg inline-block">
            <QRCodeSVG
              value={joinUrl}
              size={200}
              level="H"
              includeMargin
            />
          </div>
          <p className="text-xs text-[var(--muted-foreground)] mt-3">
            Escanea este código para inscribirte directamente desde tu teléfono móvil.
          </p>
        </div>
      )}

      {/* CASE A: Active Session 1-Click Join */}
      {existingProfile && !showManualForm ? (
        <div className="p-6 md:p-8 rounded-2xl bg-[var(--card)] border border-[var(--border)] shadow-xl space-y-6 animate-slide-up">
          <div className="flex items-center gap-3 p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-200">
            <span className="text-2xl">⚡</span>
            <div>
              <p className="font-bold text-sm text-white">Sesión activa detectada</p>
              <p className="text-xs text-[var(--muted-foreground)]">
                Inscripción rápida para <strong className="text-white">{existingProfile.name || existingProfile.nickname}</strong> ({existingProfile.email})
              </p>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-[var(--secondary)] border border-[var(--border)] space-y-2.5 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-[var(--muted-foreground)]">Jugador:</span>
              <span className="font-bold text-white">{existingProfile.name || existingProfile.nickname}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[var(--muted-foreground)]">Categoría:</span>
              <span className={`font-bold px-2 py-0.5 rounded text-xs ${
                category === 'sub14' ? 'bg-amber-500/20 text-amber-400' : 'bg-blue-500/20 text-blue-400'
              }`}>
                {getCategoryLabel(category)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[var(--muted-foreground)]">Rating Glicko-2:</span>
              <span className="font-mono font-bold text-[var(--primary)]">
                {Math.round(existingProfile.rating || 1500)} pts
              </span>
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
              {error}
            </div>
          )}

          <button
            type="button"
            onClick={handleQuickJoin}
            disabled={isPending}
            className="w-full py-4 rounded-xl gradient-primary text-white font-bold text-base shadow-lg hover:opacity-95 transition flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isPending ? (
              <>
                <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Confirmando inscripción...</span>
              </>
            ) : (
              <span>Confirmar mi Inscripción</span>
            )}
          </button>

          <div className="text-center pt-1">
            <button
              type="button"
              onClick={() => setShowManualForm(true)}
              className="text-xs text-[var(--muted-foreground)] hover:text-white underline"
            >
              ¿Deseas inscribirte con otro nombre o correo? Modificar datos
            </button>
          </div>
        </div>
      ) : (
        /* Registration Form Card */
        <div className="p-6 md:p-8 rounded-2xl bg-[var(--card)] border border-[var(--border)] shadow-xl">
          <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Email */}
          <div>
            <label className="block text-xs font-semibold text-[var(--muted-foreground)] mb-1 uppercase tracking-wider">
              Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={handleEmailBlur}
              placeholder="tu@email.com"
              className="w-full px-4 py-3 rounded-xl bg-[var(--secondary)] border border-[var(--border)] focus:outline-none focus:border-[var(--primary)] text-sm"
            />
            {lookupMessage && (
              <div className="mt-1 flex items-center justify-between text-xs text-amber-400 font-medium">
                <span>⭐ {lookupMessage}</span>
                {isLockedByHistory && (
                  <button
                    type="button"
                    onClick={handleUnlinkHistorical}
                    className="text-[11px] underline text-[var(--muted-foreground)] hover:text-white ml-2"
                  >
                    (Desvincular)
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Nickname / Name with Autocomplete */}
          <div className="relative">
            <label className="block text-xs font-semibold text-[var(--muted-foreground)] mb-1 uppercase tracking-wider">
              Nombre / Nickname
            </label>
            <div className="relative">
              <input
                type="text"
                required
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                onFocus={() => {
                  if (suggestions.length > 0) setShowSuggestions(true);
                }}
                placeholder="Ej. Richy o Carlos Ross"
                autoComplete="off"
                className="w-full px-4 py-3 rounded-xl bg-[var(--secondary)] border border-[var(--border)] focus:outline-none focus:border-[var(--primary)] text-sm"
              />
              {isSearchingPlayers && (
                <div className="absolute right-3 top-3 text-xs text-[var(--muted-foreground)] animate-pulse">
                  Buscando...
                </div>
              )}
            </div>

            {/* Suggestions Dropdown */}
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute z-30 w-full mt-1 bg-[var(--card)] border border-[var(--border)] rounded-xl shadow-2xl overflow-hidden divide-y divide-[var(--border)]">
                <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)] bg-[var(--secondary)] flex items-center justify-between">
                  <span>Jugadores Encontrados ({suggestions.length})</span>
                  <button
                    type="button"
                    onClick={() => setShowSuggestions(false)}
                    className="text-[10px] text-[var(--muted-foreground)] hover:text-white"
                  >
                    ✕ Cerrar
                  </button>
                </div>
                {suggestions.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => handleSelectSuggestion(s)}
                    className="w-full px-4 py-3 text-left hover:bg-[var(--secondary)] flex items-center justify-between gap-3 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-full gradient-primary flex items-center justify-center text-white text-xs font-extrabold shrink-0 shadow">
                        {s.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-sm text-[var(--foreground)] flex items-center gap-1.5 truncate">
                          <span>{s.name}</span>
                          {s.category && (
                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                              s.category === 'sub14' ? 'bg-amber-500/20 text-amber-400' : 'bg-blue-500/20 text-blue-400'
                            }`}>
                              {s.category === 'sub14' ? 'Sub-14' : '+14'}
                            </span>
                          )}
                        </div>
                        {s.emailMasked ? (
                          <div className="text-xs text-[var(--muted-foreground)] truncate">
                            {s.emailMasked}
                          </div>
                        ) : s.canonicalName && s.canonicalName !== s.name ? (
                          <div className="text-xs text-[var(--muted-foreground)] truncate">
                            Alias de {s.canonicalName}
                          </div>
                        ) : (
                          <div className="text-xs text-[var(--muted-foreground)]">
                            {s.source === 'profile' ? 'Perfil Registrado' : 'Archivo Histórico'}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="px-2.5 py-1 rounded-full text-xs font-mono font-extrabold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                        ELO {s.rating}
                      </span>
                      <div className="text-[10px] text-[var(--muted-foreground)] mt-0.5">
                        {s.matchesPlayed} partidos
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Age or Birthdate */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">
                Edad o Fecha de Nacimiento
              </label>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                category === 'sub14' ? 'bg-amber-500/20 text-amber-400' : 'bg-blue-500/20 text-blue-400'
              }`}>
                {getCategoryLabel(category)}
              </span>
            </div>
            <input
              type="text"
              required
              value={birthDateOrAge}
              onChange={(e) => handleAgeChange(e.target.value)}
              placeholder="Ej. 13 ó 2012-05-14"
              className="w-full px-4 py-3 rounded-xl bg-[var(--secondary)] border border-[var(--border)] focus:outline-none focus:border-[var(--primary)] text-sm"
            />
            <p className="mt-1 text-xs text-[var(--muted-foreground)]">
              {category === 'sub14' ? '≤ 14 años: Asignado automáticamente a Junior' : '> 14 años: Asignado automáticamente a Absoluta'}
            </p>
          </div>

          {/* Level Slider (0.0 to 10.0) or Verified Glicko-2 Card */}
          <div>
            {isLockedByHistory ? (
              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between shadow-inner">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-amber-400 font-bold text-sm">⭐ Rating Oficial Glicko-2</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300">
                      Verificado
                    </span>
                  </div>
                  <div className="text-xs text-[var(--muted-foreground)] mt-0.5">
                    Nivel fijado por histórico de competición • {selectedHistoricalPlayer?.matchesPlayed ?? 0} partidos
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-extrabold font-mono text-amber-400">
                    {historicalRating ?? 1500} pts
                  </div>
                  <button
                    type="button"
                    onClick={handleUnlinkHistorical}
                    className="text-xs text-[var(--muted-foreground)] hover:text-white underline mt-0.5"
                  >
                    Desvincular
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">
                    Nivel Autodeclarado (0 a 10)
                  </label>
                  <span className="font-bold text-sm text-[var(--primary)]">
                    {declaredLevel.toFixed(1)} / 10
                  </span>
                </div>

                <input
                  type="range"
                  min="0"
                  max="10"
                  step="0.5"
                  value={declaredLevel}
                  onChange={(e) => setDeclaredLevel(parseFloat(e.target.value))}
                  className="w-full accent-[var(--primary)] h-2 bg-[var(--secondary)] rounded-lg cursor-pointer"
                />

                <div className="flex justify-between text-[10px] text-[var(--muted-foreground)] mt-1">
                  <span>0 = Principiante</span>
                  <span>5 = Intermedio</span>
                  <span>10 = Máximo Nivel</span>
                </div>

                <p className="mt-2 text-xs text-[var(--muted-foreground)]">
                  Rating estimado inicial: <strong className="text-[var(--foreground)]">{provisionalPreview} pts</strong>
                </p>
              </div>
            )}
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isPending}
            className="w-full py-4 rounded-xl gradient-primary text-white font-bold text-base shadow-lg hover:opacity-95 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isPending ? (
              <>
                <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Inscribiendo...</span>
              </>
            ) : (
              <span>Confirmar mi Inscripción</span>
            )}
          </button>

          {existingProfile && (
            <div className="text-center pt-1">
              <button
                type="button"
                onClick={() => setShowManualForm(false)}
                className="text-xs text-[var(--muted-foreground)] hover:text-white underline"
              >
                ← Volver a inscripción en 1 clic con mi cuenta
              </button>
            </div>
          )}
        </form>
      </div>
      )}
    </div>
  );
}
