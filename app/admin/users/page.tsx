import { createClient, createAdminClient } from '@/lib/supabase/server';
import { getPlayerSession } from '@/lib/auth/player-session';
import { redirect } from 'next/navigation';
import { isSuperAdminProfile, isApprovedAdmin } from '@/lib/auth/roles';
import { AdminUsersClient, type AdminManagedUser } from '@/components/admin/AdminUsersClient';

export const dynamic = 'force-dynamic';

export default async function AdminUsersPage() {
  const supabase = await createClient();
  const admin = createAdminClient();

  // 1. Session verification
  const { data: { user } } = await supabase.auth.getUser();
  const playerSession = await getPlayerSession();
  const callerEmail = user?.email || playerSession?.email;
  const callerId = user?.id || playerSession?.playerId;

  if (!callerEmail && !callerId) {
    redirect('/login?redirectTo=/admin/users');
  }

  const cleanEmail = callerEmail?.toLowerCase().trim();
  let callerProfile: any = null;

  if (cleanEmail) {
    const { data: profile } = await admin
      .from('profiles')
      .select('id, role, email, admin_status')
      .eq('email', cleanEmail)
      .maybeSingle();
    callerProfile = profile;
  } else if (callerId) {
    const { data: profile } = await admin
      .from('profiles')
      .select('id, role, email, admin_status')
      .eq('id', callerId)
      .maybeSingle();
    callerProfile = profile;
  }

  const isSuperAdmin = isSuperAdminProfile(callerProfile || { email: cleanEmail, role: undefined });
  const isApproved = isApprovedAdmin(callerProfile);

  // 2. Strict Superadmin & Approved Admin Access Protection
  if (!isSuperAdmin && !isApproved) {
    redirect('/?error=unauthorized');
  }

  // 3. Fetch all registered profiles
  const { data: rawUsers } = await admin
    .from('profiles')
    .select('id, name, nickname, email, role, admin_status, rating, category, created_at')
    .order('created_at', { ascending: false });

  const initialUsers: AdminManagedUser[] = (rawUsers ?? []).map((u: any) => ({
    id: u.id,
    name: u.name || 'Sin Nombre',
    nickname: u.nickname,
    email: u.email,
    role: (u.role as any) || 'player',
    admin_status: u.admin_status,
    rating: u.rating,
    category: u.category,
    created_at: u.created_at,
  }));

  return (
    <main className="min-h-screen bg-[var(--background)] px-4 py-8 md:py-12">
      <div className="max-w-4xl mx-auto">
        <AdminUsersClient
          initialUsers={initialUsers}
          isSuperAdmin={isSuperAdmin}
        />
      </div>
    </main>
  );
}

