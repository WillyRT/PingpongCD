import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

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

  const isAdmin =
    cleanEmail === 'guillermoriveraterriza@gmail.com' ||
    profile?.role === 'super_admin' ||
    (profile?.role === 'admin' && profile?.admin_status === 'approved');

  if (!isAdmin) {
    redirect('/?error=unauthorized');
  }

  return <>{children}</>;
}
