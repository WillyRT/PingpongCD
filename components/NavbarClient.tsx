'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export interface NavbarUser {
  id: string;
  name: string;
  nickname: string;
  email: string | null;
  role: 'super_admin' | 'admin' | 'referee' | 'player';
  rating: number;
}

interface NavbarClientProps {
  user: NavbarUser | null;
}

export function NavbarClient({ user }: NavbarClientProps) {
  const pathname = usePathname();

  const initials = user
    ? (user.nickname || user.name || 'J')
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : 'U';

  const isPrivileged = user?.role === 'super_admin' || user?.role === 'admin' || user?.role === 'referee';

  return (
    <>
      {/* Persistent Top Header */}
      <header className="sticky top-0 z-40 w-full bg-[var(--background)]/85 backdrop-blur-md border-b border-[var(--border)] transition-colors">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center text-white shadow-md group-hover:scale-105 transition-transform">
              <span className="text-xl">🏓</span>
            </div>
            <div className="flex flex-col">
              <span className="text-base sm:text-lg font-black tracking-tight leading-none text-white">
                Tourney<span className="text-[var(--primary)]">Master</span>
                <span className="text-[var(--accent)] text-xs ml-1 font-bold">AI</span>
              </span>
              <span className="text-[10px] text-[var(--muted-foreground)] tracking-wide">
                Table Tennis Circuit
              </span>
            </div>
          </Link>

          {/* Desktop Nav Links */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-semibold">
            <Link
              href="/"
              className={`transition hover:text-white ${
                pathname === '/' ? 'text-white' : 'text-[var(--muted-foreground)]'
              }`}
            >
              Inicio
            </Link>
            <Link
              href="/admin"
              className={`transition hover:text-white flex items-center gap-1.5 ${
                pathname.startsWith('/admin') ? 'text-white' : 'text-[var(--muted-foreground)]'
              }`}
            >
              🏆 Torneos
            </Link>
            <Link
              href="/leaderboard"
              className={`transition hover:text-white flex items-center gap-1.5 ${
                pathname === '/leaderboard' ? 'text-white' : 'text-[var(--muted-foreground)]'
              }`}
            >
              📊 Ranking
            </Link>
            {isPrivileged && (
              <Link
                href="/admin"
                className="px-2.5 py-1 rounded-lg bg-purple-500/20 text-purple-300 border border-purple-500/30 text-xs font-bold hover:bg-purple-500/30 transition"
              >
                Panel {user?.role === 'referee' ? 'Árbitro' : 'Admin'}
              </Link>
            )}
          </nav>

          {/* User Auth Action Button */}
          <div className="flex items-center gap-3">
            {user ? (
              <div className="flex items-center gap-2.5">
                <Link
                  href="/me"
                  className="flex items-center gap-2 p-1.5 sm:px-3 sm:py-1.5 rounded-xl bg-[var(--card)] hover:bg-[var(--secondary)] border border-[var(--border)] transition shadow-sm"
                >
                  <div className="w-8 h-8 rounded-lg gradient-primary text-white font-black text-xs flex items-center justify-center shadow">
                    {initials}
                  </div>
                  <div className="hidden sm:flex flex-col text-left">
                    <span className="text-xs font-bold leading-tight truncate max-w-[110px]">
                      {user.nickname || user.name}
                    </span>
                    <span className="text-[10px] text-[var(--primary)] font-mono font-bold">
                      {Math.round(user.rating)} pts
                    </span>
                  </div>
                </Link>

                <form action="/auth/signout" method="post" className="flex items-center">
                  <button
                    type="submit"
                    title="Cerrar sesión"
                    className="py-1.5 px-2.5 rounded-xl text-red-400/90 hover:text-red-300 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition text-xs font-semibold flex items-center gap-1"
                  >
                    <span>🚪</span>
                    <span className="hidden sm:inline">Cerrar Sesión</span>
                  </button>
                </form>
              </div>
            ) : (
              <Link
                href="/login"
                className="px-4 py-2 rounded-xl gradient-primary text-white text-xs sm:text-sm font-bold shadow hover:opacity-95 transition flex items-center gap-1.5"
              >
                <span>👤</span>
                <span>Entrar / Registro</span>
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Fixed Bottom Mobile Navigation Bar */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[var(--background)]/95 backdrop-blur-lg border-t border-[var(--border)] py-2 px-6 flex items-center justify-around shadow-2xl">
        <Link
          href="/"
          className={`flex flex-col items-center gap-0.5 text-[11px] font-bold transition ${
            pathname === '/' ? 'text-[var(--primary)]' : 'text-[var(--muted-foreground)]'
          }`}
        >
          <span className="text-lg">🏠</span>
          <span>Inicio</span>
        </Link>
        <Link
          href="/admin"
          className={`flex flex-col items-center gap-0.5 text-[11px] font-bold transition ${
            pathname.startsWith('/admin') || pathname.startsWith('/t/')
              ? 'text-[var(--primary)]'
              : 'text-[var(--muted-foreground)]'
          }`}
        >
          <span className="text-lg">🏆</span>
          <span>Torneos</span>
        </Link>
        <Link
          href="/me"
          className={`flex flex-col items-center gap-0.5 text-[11px] font-bold transition ${
            pathname.startsWith('/me') || pathname.startsWith('/player')
              ? 'text-[var(--primary)]'
              : 'text-[var(--muted-foreground)]'
          }`}
        >
          <span className="text-lg">👤</span>
          <span>Mi Perfil</span>
        </Link>
      </div>
    </>
  );
}
