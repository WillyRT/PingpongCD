import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { IdentityResolutionClient } from './IdentityResolutionClient';

export default async function IdentityResolutionPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login?redirectTo=/admin/historical/identity');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'admin') {
    redirect('/player');
  }

  const { data: players } = await supabase
    .from('players')
    .select('*, rating_states (*)')
    .order('canonical_name', { ascending: true });

  const { data: aliases } = await supabase
    .from('player_aliases')
    .select('*')
    .order('created_at', { ascending: false });

  return (
    <IdentityResolutionClient
      players={players ?? []}
      aliases={aliases ?? []}
    />
  );
}
