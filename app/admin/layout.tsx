import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { isSuperAdminProfile, isApprovedAdmin } from '@/lib/auth/roles';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user?.email) {
    redirect('/login?redirect=/admin');
  }

  const cleanEmail = user.email.toLowerCase().trim();
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, admin_status')
    .eq('email', cleanEmail)
    .maybeSingle();

  const isSuperAdmin = isSuperAdminProfile({ email: cleanEmail, role: profile?.role });
  const isAdmin = isSuperAdmin || isApprovedAdmin(profile);

  if (!isAdmin) {
    redirect('/?error=unauthorized');
  }

  return <>{children}</>;
}
