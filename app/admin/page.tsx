import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { evaluateUserPermissions, isSuperAdminProfile } from '@/lib/auth/roles';
import { AdminUserManagement } from './AdminUserManagement';

export default async function AdminDashboard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) redirect('/login?redirect=/admin');

  const cleanEmail = user.email.toLowerCase().trim();

  // Check admin role
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, email, admin_status')
    .eq('email', cleanEmail)
    .maybeSingle();

  const { isSuperAdmin, isAdmin } = evaluateUserPermissions(profile, cleanEmail);

  if (!isAdmin) {
    redirect('/?error=unauthorized');
  }

  // Fetch tournaments
  const { data: tournaments } = await supabase
    .from('tournaments')
    .select('*')
    .order('created_at', { ascending: false });

  // Fetch managed users if superadmin
  let managedUsers: any[] = [];
  if (isSuperAdmin) {
    const { data: users } = await supabase
      .from('profiles')
      .select('id, name, email, role, admin_status, created_at')
      .order('created_at', { ascending: false });
    managedUsers = (users ?? []).filter((u) => !isSuperAdminProfile(u));
  }

  const statusColors: Record<string, string> = {
    draft: 'bg-gray-500/20 text-gray-400',
    registration: 'bg-blue-500/20 text-blue-400',
    group_stage: 'bg-amber-500/20 text-amber-400',
    bracket_stage: 'bg-purple-500/20 text-purple-400',
    finished: 'bg-green-500/20 text-green-400',
  };

  return (
    <main className="min-h-screen pb-20">
      {/* Header */}
      <header className="glass sticky top-0 z-50 px-4 py-3 border-b border-[var(--border)]">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link href="/" className="font-bold text-lg">
              Tourney<span className="text-[var(--primary)]">Master</span>
              <span className="text-[var(--accent)] text-xs ml-1">ADMIN</span>
            </Link>
            {isSuperAdmin && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                SUPERADMIN
              </span>
            )}
          </div>
          <div className="flex items-center gap-2.5">
            {isAdmin && (
              <Link
                href="/admin/users"
                className="px-3.5 py-2 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-bold hover:bg-amber-500/30 transition flex items-center gap-1.5"
              >
                <span>👥</span>
                <span>Gestión de Staff</span>
              </Link>
            )}
            <Link
              href="/admin/tournaments/new"
              className="px-4 py-2 rounded-lg bg-[var(--primary)] text-white text-sm font-bold shadow transition hover:opacity-90"
            >
              + New Tournament
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-6">
        <h2 className="text-sm font-medium text-[var(--muted-foreground)] mb-4">TOURNAMENTS</h2>

        {(!tournaments || tournaments.length === 0) ? (
          <div className="p-12 rounded-xl bg-[var(--card)] border border-[var(--border)] text-center">
            <div className="text-5xl mb-4">🏓</div>
            <h3 className="text-xl font-bold mb-2">No tournaments yet</h3>
            <p className="text-[var(--muted-foreground)] mb-6">Create your first tournament to get started</p>
            <Link
              href="/admin/tournaments/new"
              className="inline-flex px-6 py-3 rounded-xl gradient-primary text-white font-semibold"
            >
              Create Tournament
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {tournaments.map((t) => (
              <Link
                key={t.id}
                href={`/admin/tournaments/${t.id}`}
                className="block p-5 rounded-xl bg-[var(--card)] border border-[var(--border)] hover:border-[var(--primary)] transition-colors"
              >
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-lg">{t.name}</h3>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColors[t.status] ?? 'bg-gray-500/20 text-gray-400'}`}>
                    {t.status.replace('_', ' ')}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-sm text-[var(--muted-foreground)]">
                  <span>/{t.slug}</span>
                  <span>•</span>
                  <span>{new Date(t.created_at).toLocaleDateString()}</span>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Superadmin RBAC Panel */}
        {isSuperAdmin && (
          <AdminUserManagement initialUsers={managedUsers} />
        )}
      </div>
    </main>
  );
}
