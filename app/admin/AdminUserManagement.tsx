'use client';

import { useState, useTransition } from 'react';
import { approveAdminAction, revokeAdminAction } from '@/lib/actions/admin';

interface ManagedUser {
  id: string;
  name: string;
  email: string | null;
  role: 'super_admin' | 'admin' | 'player';
  admin_status: 'none' | 'pending' | 'approved' | 'rejected';
  created_at: string;
}

export function AdminUserManagement({ initialUsers }: { initialUsers: ManagedUser[] }) {
  const [users, setUsers] = useState(initialUsers);
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<string | null>(null);

  const handleApprove = (userId: string) => {
    startTransition(async () => {
      const res = await approveAdminAction(userId);
      if (res.success) {
        setUsers((prev) =>
          prev.map((u) => (u.id === userId ? { ...u, role: 'admin', admin_status: 'approved' } : u))
        );
        setFeedback('Usuario promovido a Administrador exitosamente.');
      } else {
        setFeedback(`Error: ${res.error}`);
      }
      setTimeout(() => setFeedback(null), 4000);
    });
  };

  const handleRevoke = (userId: string) => {
    startTransition(async () => {
      const res = await revokeAdminAction(userId);
      if (res.success) {
        setUsers((prev) =>
          prev.map((u) => (u.id === userId ? { ...u, role: 'player', admin_status: 'rejected' } : u))
        );
        setFeedback('Permisos de Administrador revocados.');
      } else {
        setFeedback(`Error: ${res.error}`);
      }
      setTimeout(() => setFeedback(null), 4000);
    });
  };

  const pendingUsers = users.filter((u) => u.admin_status === 'pending');
  const activeAdmins = users.filter((u) => u.role === 'admin');

  return (
    <div className="mt-8 p-6 rounded-2xl bg-[var(--card)] border border-amber-500/30 shadow-lg">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xl">👑</span>
            <h2 className="text-lg font-bold text-amber-400">Control de Acceso y Administradores (RBAC)</h2>
          </div>
          <p className="text-xs text-[var(--muted-foreground)]">
            Panel exclusivo del Superadministrador principal.
          </p>
        </div>
      </div>

      {feedback && (
        <div className="mb-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-medium">
          {feedback}
        </div>
      )}

      {/* Pending Requests */}
      <div className="mb-6">
        <h3 className="text-xs font-bold text-[var(--muted-foreground)] uppercase tracking-wider mb-3">
          Solicitudes Pendientes ({pendingUsers.length})
        </h3>
        {pendingUsers.length === 0 ? (
          <p className="text-xs text-[var(--muted-foreground)] italic">No hay solicitudes de administración pendientes.</p>
        ) : (
          <div className="space-y-2">
            {pendingUsers.map((u) => (
              <div
                key={u.id}
                className="p-3 rounded-xl bg-[var(--secondary)] flex items-center justify-between border border-amber-500/20 text-sm"
              >
                <div>
                  <div className="font-semibold">{u.name}</div>
                  <div className="text-xs text-[var(--muted-foreground)]">{u.email}</div>
                </div>
                <button
                  onClick={() => handleApprove(u.id)}
                  disabled={isPending}
                  className="px-3 py-1.5 rounded-lg bg-green-500 hover:bg-green-600 text-white text-xs font-bold transition-colors disabled:opacity-50"
                >
                  Aprobar como Admin
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Active Admins */}
      <div>
        <h3 className="text-xs font-bold text-[var(--muted-foreground)] uppercase tracking-wider mb-3">
          Administradores Activos ({activeAdmins.length})
        </h3>
        {activeAdmins.length === 0 ? (
          <p className="text-xs text-[var(--muted-foreground)] italic">No hay otros administradores adicionales activos.</p>
        ) : (
          <div className="space-y-2">
            {activeAdmins.map((u) => (
              <div
                key={u.id}
                className="p-3 rounded-xl bg-[var(--secondary)] flex items-center justify-between border border-[var(--border)] text-sm"
              >
                <div>
                  <div className="font-semibold flex items-center gap-2">
                    {u.name}
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-400">
                      ADMIN
                    </span>
                  </div>
                  <div className="text-xs text-[var(--muted-foreground)]">{u.email}</div>
                </div>
                <button
                  onClick={() => handleRevoke(u.id)}
                  disabled={isPending}
                  className="px-3 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 text-xs font-bold transition-colors disabled:opacity-50"
                >
                  Revocar Admin
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
