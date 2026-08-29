'use client';

import { useState, useTransition, useRef } from 'react';
import Link from 'next/link';
import { QRCodeSVG } from 'qrcode.react';
import { determineAgeCategory, getCategoryLabel } from '@/lib/engine/categories';
import {
  lookupPlayerByEmailAction,
  searchHistoricalPlayersAction,
  publicJoinTournamentAction,
  type HistoricalPlayerSuggestion,
} from '@/lib/actions/registration';
import type { TournamentRow, ProfileRow } from '@/lib/types/database';
import type { AgeCategory } from '@/lib/types/domain';

interface PublicJoinClientProps {
  tournament: TournamentRow;
  participantCount: number;
  currentUser: { id: string; email: string } | null;
  existingProfile: ProfileRow | null;
}

export function PublicJoinClient({
  tournament,
  currentUser,
  existingProfile,
}: PublicJoinClientProps) {
  const [email, setEmail] = useState(currentUser?.email || existingProfile?.email || '');
  const [name, setName] = useState(existingProfile?.name || '');
  const [birthDateOrAge, setBirthDateOrAge] = useState<string>('20');
  const [declaredLevel, setDeclaredLevel] = useState<number>(existingProfile?.declared_level ?? 5.0);
  const [isLockedByHistory, setIsLockedByHistory] = useState(!!existingProfile?.rating);
  const [historicalRating, setHistoricalRating] = useState<number | null>(
    existingProfile?.rating ? Math.round(existingProfile.rating) : null
  );
  const [lookupMessage, setLookupMessage] = useState<string | null>(null);

  // Historical autocomplete state
  const [suggestions, setSuggestions] = useState<HistoricalPlayerSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedHistoricalPlayer, setSelectedHistoricalPlayer] = useState<HistoricalPlayerSuggestion | null>(null);
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

  // Calculate provisional preview rating
  const provisionalPreview = Math.round(1100 + (declaredLevel / 10) * (2050 - 1100));

  const handleAgeChange = (val: string) => {
    setBirthDateOrAge(val);
    const parsedNum = Number(val);
    if (!isNaN(parsedNum) && parsedNum > 0) {
      setCategory(determineAgeCategory(parsedNum));
    } else if (val.includes('-')) {
      setCategory(determineAgeCategory(val));
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
          const res = await searchHistoricalPlayersAction(val);
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

  const handleSelectSuggestion = (s: HistoricalPlayerSuggestion) => {
    setName(s.name);
    setSelectedHistoricalPlayer(s);
    setHistoricalRating(s.rating);
    setIsLockedByHistory(true);
    setShowSuggestions(false);

    if (s.category) {
      setCategory(s.category);
    }

    setLookupMessage(`Vinculado a ${s.name} (ELO histórico: ${s.rating})`);
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
            href="/player"
            className="w-full py-3 rounded-xl gradient-primary text-white font-semibold text-center shadow-lg hover:opacity-95 transition"
          >
            🏓 Ir a Mi Panel de Jugador
          </Link>
          <Link
            href={`/t/${tournament.slug}`}
            className="w-full py-3 rounded-xl bg-[var(--secondary)] text-[var(--foreground)] font-medium text-center hover:bg-[var(--secondary)]/80 transition"
          >
            Ver Cuadro del Torneo
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

      {/* Registration Form Card */}
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
                <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)] bg-[var(--secondary)]">
                  Jugadores Históricos Sugeridos
                </div>
                {suggestions.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => handleSelectSuggestion(s)}
                    className="w-full px-4 py-2.5 text-left hover:bg-[var(--secondary)] flex items-center justify-between transition-colors"
                  >
                    <div>
                      <span className="font-semibold text-sm text-[var(--foreground)]">
                        ¿Eres {s.name}?
                      </span>
                      {s.matchedAlias && (
                        <span className="text-xs text-[var(--muted-foreground)] ml-1">
                          ({s.canonicalName})
                        </span>
                      )}
                      {s.emailMasked && (
                        <div className="text-xs text-[var(--muted-foreground)]">
                          {s.emailMasked}
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      <span className="px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-amber-500/20 text-amber-400">
                        ELO: {s.rating}
                      </span>
                      <div className="text-[10px] text-[var(--muted-foreground)]">
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

          {/* Level Slider (0.0 to 10.0) */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">
                Nivel Autodeclarado (0 a 10)
              </label>
              <span className="font-bold text-sm text-[var(--primary)]">
                {isLockedByHistory ? `${historicalRating} pts (Histórico)` : `${declaredLevel.toFixed(1)} / 10`}
              </span>
            </div>

            <input
              type="range"
              min="0"
              max="10"
              step="0.5"
              disabled={isLockedByHistory}
              value={declaredLevel}
              onChange={(e) => setDeclaredLevel(parseFloat(e.target.value))}
              className="w-full accent-[var(--primary)] h-2 bg-[var(--secondary)] rounded-lg cursor-pointer disabled:opacity-50"
            />

            <div className="flex justify-between text-[10px] text-[var(--muted-foreground)] mt-1">
              <span>0 = Principiante</span>
              <span>5 = Intermedio</span>
              <span>10 = Máximo Nivel</span>
            </div>

            {isLockedByHistory ? (
              <div className="mt-2 p-2.5 rounded-lg bg-green-500/10 border border-green-500/20 text-xs text-green-400 flex items-center justify-between">
                <span>⭐ Rating Glicko-2 histórico vinculado ({historicalRating} pts)</span>
                <button
                  type="button"
                  onClick={handleUnlinkHistorical}
                  className="underline hover:text-white"
                >
                  Cambiar
                </button>
              </div>
            ) : (
              <p className="mt-2 text-xs text-[var(--muted-foreground)]">
                Rating estimado inicial: <strong className="text-[var(--foreground)]">{provisionalPreview} pts</strong>
              </p>
            )}
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isPending}
            className="w-full py-4 rounded-xl gradient-primary text-white font-bold text-base shadow-lg hover:opacity-95 transition-opacity disabled:opacity-50"
          >
            {isPending ? 'Inscribiendo...' : 'Completar Registro'}
          </button>
        </form>
      </div>
    </div>
  );
}
