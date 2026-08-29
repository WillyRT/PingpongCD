import { createClient } from '@/lib/supabase/server';
import { getPlayerSession } from '@/lib/auth/player-session';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import LoginClient from './LoginClient';

interface LoginPageProps {
  searchParams: Promise<{
    redirectTo?: string;
    next?: string;
    error?: string;
  }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const targetRedirect = params.next || params.redirectTo;

  // Active Session Detection
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const playerSession = await getPlayerSession();

  if (user || playerSession) {
    const userEmail = (user?.email || playerSession?.email)?.toLowerCase();

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, role, admin_status')
      .eq('email', userEmail)
      .maybeSingle();

    const isSuperAdmin = userEmail === 'guillermoriveraterriza@gmail.com' || profile?.role === 'super_admin';
    const isAdmin = isSuperAdmin || (profile?.role === 'admin' && profile?.admin_status === 'approved') || profile?.role === 'referee';

    if (targetRedirect && targetRedirect.startsWith('/') && !targetRedirect.startsWith('//') && targetRedirect !== '/login') {
      redirect(targetRedirect);
    }

    if (isAdmin) {
      redirect('/admin');
    } else {
      redirect('/me');
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-12">
      <Suspense fallback={<div className="text-white/60 text-sm">Cargando acceso...</div>}>
        <LoginClient initialRedirect={targetRedirect} initialError={params.error} />
      </Suspense>
    </main>
  );
}

