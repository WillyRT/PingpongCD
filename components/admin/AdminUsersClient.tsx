'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { updateUserRoleAction } from '@/lib/actions/admin';

export interface AdminManagedUser {
  id: string;
  name: string;
  nickname?: string | null;
  email: string | null;
  role: 'super_admin' | 'admin' | 'referee' | 'player';
  admin_status?: 'none' | 'pending' | 'approved' | 'rejected' | null;
  rating?: number | null;
  category?: string | null;
  created_at?: string;
}

interface AdminUsersClientProps {
  initialUsers: AdminManagedUser[];
}

export function AdminUsersClient({ initialUsers }: AdminUsersClientProps) {
  const [users, setUsers] = useState<AdminManagedUser[]>(initialUsers);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'staff' | 'player'>('all');
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);

  const handleRoleChange = (userId: string, newRole: 'player' | 'referee' | 'admin') => {
    setUpdatingUserId(userId);
    startTransition(async () => {
      const res = await updateUserRoleAction(userId, newRole);
      if (res.success) {
        setUsers((prev) =>
          prev.map((u) =>
            u.id === userId
              ? {
                  ...u,
                  role: newRole,
                  admin_status: newRole === 'player' ? null : 'approved',
                }
              : u
          )
        );
        const roleLabel =
          newRole === 'admin' ? 'Administrador' : newRole === 'referee' ? 'Árbitro' : 'Jugador';
        setFeedback({
          type: 'success',
          message: `Rol actualizado a ${roleLabel} correctamente.`,
        });
      } else {
        setFeedback({
          type: 'error',
          message: res.error || 'Error al actualizar rol.',
        });
      }
      setUpdatingUserId(null);
      setTimeout(() => setFeedback(null), 4000);
    });
  };

  const filteredUsers = users.filter((u) => {
    const q = search.toLowerCase().trim();
    const matchesSearch =
      !q ||
      u.name.toLowerCase().includes(q) ||
      (u.nickname && u.nickname.toLowerCase().includes(q)) ||
      (u.email && u.email.toLowerCase().includes(q));

    if (!matchesSearch) return false;

    if (roleFilter === 'staff') {
      return u.role === 'super_admin' || u.role === 'admin' || u.role === 'referee';
    }
    if (roleFilter === 'player') {
      return u.role === 'player';
    }
    return true;
  });

  const superAdminCount = users.filter((u) => u.role === 'super_admin').length;
  const adminCount = users.filter((u) => u.role === 'admin').length;
  const refereeCount = users.filter((u) => u.role === 'referee').length;
  const playerCount = users.filter((u) => u.role === 'player').length;

  return (
    <div className="space-y-6">
      {/* Top Header & Breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--border)] pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link
              href="/admin"
              className="text-xs font-bold text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition flex items-center gap-1"
            >
              <span>← Volver al Panel Admin</span>
            </Link>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-[var(--foreground)] tracking-tight flex items-center gap-2.5">
            <span>🛡️</span>
            <span>Gestión de Staff y Árbitros</span>
          </h1>
          <p className="text-xs sm:text-sm text-[var(--muted-foreground)] mt-1">
            Asigna permisos de árbitro o administrador a los vecinos en tiempo real durante el torneo.
          </p>
        </div>

        <Link
          href="/tables"
          className="px-4 py-2 rounded-xl bg-[var(--secondary)] border-2 border-[var(--border)] text-xs font-bold hover:bg-[var(--secondary)]/80 transition flex items-center gap-1.5 self-start sm:self-auto"
        >
          <span>🏓</span>
          <span>Ir a Control de Mesas</span>
        </Link>
      </div>

      {/* Role Summary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-2xl bg-[var(--card)] border-2 border-amber-500/30">
          <div className="text-[11px] font-bold text-amber-400 uppercase tracking-wider">Superadmin</div>
          <div className="text-2xl font-black text-[var(--foreground)] mt-0.5 tabular-nums">
            {superAdminCount}
          </div>
        </div>
        <div className="p-3.5 rounded-2xl bg-[var(--card)] border-2 border-blue-500/30">
          <div className="text-[11px] font-bold text-blue-400 uppercase tracking-wider">Administradores</div>
          <div className="text-2xl font-black text-[var(--foreground)] mt-0.5 tabular-nums">
            {adminCount}
          </div>
        </div>
        <div className="p-3.5 rounded-2xl bg-[var(--card)] border-2 border-yellow-500/30">
          <div className="text-[11px] font-bold text-yellow-400 uppercase tracking-wider">Árbitros de Pista</div>
          <div className="text-2xl font-black text-[var(--foreground)] mt-0.5 tabular-nums">
            {refereeCount}
          </div>
        </div>
        <div className="p-3.5 rounded-2xl bg-[var(--card)] border-2 border-[var(--border)]">
          <div className="text-[11px] font-bold text-[var(--muted-foreground)] uppercase tracking-wider">Jugadores</div>
          <div className="text-2xl font-black text-[var(--foreground)] mt-0.5 tabular-nums">
            {playerCount}
          </div>
        </div>
      </div>

      {/* Feedback Toast */}
      {feedback && (
        <div
          className={`p-3.5 rounded-xl text-xs font-bold border-2 transition animate-slide-up ${
            feedback.type === 'success'
              ? 'bg-green-500/20 text-green-300 border-green-500/40'
              : 'bg-red-500/20 text-red-300 border-red-500/40'
          }`}
        >
          {feedback.type === 'success' ? '✅ ' : '⚠️ '}
          {feedback.message}
        </div>
      )}

      {/* Search and Filters Bar */}
      <div className="p-4 rounded-2xl bg-[var(--card)] border-2 border-[var(--border)] space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-[var(--muted-foreground)]">
              🔍
            </span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nombre, apodo o correo electrónico..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[var(--secondary)] border-2 border-[var(--border)] text-xs text-[var(--foreground)] font-medium placeholder-[var(--muted-foreground)] focus:outline-none focus:border-[var(--primary)]"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              >
                ✕
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 self-start">
            <button
              type="button"
              onClick={() => setRoleFilter('all')}
              className={`px-3 py-2 rounded-xl text-xs font-bold border-2 transition ${
                roleFilter === 'all'
                  ? 'bg-blue-600 text-white border-black shadow-sm'
                  : 'bg-[var(--secondary)] text-[var(--foreground)] border-[var(--border)]'
              }`}
            >
              Todos ({users.length})
            </button>
            <button
              type="button"
              onClick={() => setRoleFilter('staff')}
              className={`px-3 py-2 rounded-xl text-xs font-bold border-2 transition ${
                roleFilter === 'staff'
                  ? 'bg-amber-500 text-black border-black font-black shadow-sm'
                  : 'bg-[var(--secondary)] text-[var(--foreground)] border-[var(--border)]'
              }`}
            >
              Solo Staff ({superAdminCount + adminCount + refereeCount})
            </button>
            <button
              type="button"
              onClick={() => setRoleFilter('player')}
              className={`px-3 py-2 rounded-xl text-xs font-bold border-2 transition ${
                roleFilter === 'player'
                  ? 'bg-blue-600 text-white border-black shadow-sm'
                  : 'bg-[var(--secondary)] text-[var(--foreground)] border-[var(--border)]'
              }`}
            >
              Solo Jugadores ({playerCount})
            </button>
          </div>
        </div>
      </div>

      {/* Users List */}
      <div className="space-y-2.5">
        {filteredUsers.length === 0 ? (
          <div className="p-8 rounded-2xl bg-[var(--card)] border-2 border-[var(--border)] text-center text-xs text-[var(--muted-foreground)]">
            No se encontraron usuarios con el criterio de búsqueda.
          </div>
        ) : (
          filteredUsers.map((u) => {
            const isRootSuperAdmin =
              u.role === 'super_admin' ||
              u.email?.toLowerCase().trim() === 'guillermoriveraterriza@gmail.com';
            const isUpdating = updatingUserId === u.id;

            return (
              <div
                key={u.id}
                className="p-4 rounded-2xl bg-[var(--card)] border-2 border-[var(--border)] flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm hover:border-[var(--primary)]/50 transition"
              >
                {/* User Info */}
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-[var(--secondary)] border-2 border-[var(--border)] font-black text-sm flex items-center justify-center shrink-0">
                    {(u.nickname || u.name || 'J').charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-black text-sm text-[var(--foreground)] truncate">
                        {u.name}
                      </span>
                      {u.nickname && u.nickname !== u.name && (
                        <span className="text-xs text-[var(--muted-foreground)]">
                          ({u.nickname})
                        </span>
                      )}

                      {/* Current Role Badge */}
                      {isRootSuperAdmin ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/40">
                          🛡️ Superadmin
                        </span>
                      ) : u.role === 'admin' ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-blue-500/20 text-blue-300 border border-blue-500/40">
                          👑 Admin
                        </span>
                      ) : u.role === 'referee' ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-yellow-500/20 text-yellow-300 border border-yellow-500/40">
                          ⏱️ Árbitro
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[var(--secondary)] text-[var(--muted-foreground)] border border-[var(--border)]">
                          🏓 Jugador
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 text-xs text-[var(--muted-foreground)] flex-wrap mt-0.5">
                      <span className="font-mono font-medium">{u.email || 'Sin correo registrado'}</span>
                      {u.rating != null && (
                        <>
                          <span>•</span>
                          <span className="font-mono tabular-nums">{Math.round(u.rating)} ELO</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Role Switcher */}
                <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                  {isRootSuperAdmin ? (
                    <span className="text-[11px] font-bold text-[var(--muted-foreground)] italic px-2">
                      Rol raíz protegido
                    </span>
                  ) : (
                    <div className="flex items-center gap-2">
                      <label className="text-xs font-bold text-[var(--muted-foreground)] hidden sm:inline">
                        Asignar rol:
                      </label>
                      <select
                        value={u.role}
                        disabled={isPending || isUpdating}
                        onChange={(e) =>
                          handleRoleChange(
                            u.id,
                            e.target.value as 'player' | 'referee' | 'admin'
                          )
                        }
                        className={`px-3 py-1.5 rounded-xl border-2 text-xs font-black transition cursor-pointer focus:outline-none ${
                          u.role === 'admin'
                            ? 'bg-blue-600 text-white border-black'
                            : u.role === 'referee'
                            ? 'bg-amber-500 text-black border-black'
                            : 'bg-[var(--secondary)] text-[var(--foreground)] border-[var(--border)]'
                        } disabled:opacity-50`}
                      >
                        <option value="player">🏓 Jugador</option>
                        <option value="referee">⏱️ Árbitro</option>
                        <option value="admin">👑 Administrador</option>
                      </select>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
