import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

async function handleSignOut(request: Request) {
  const cookieStore = await cookies();
  const supabase = await createClient();

  try {
    await supabase.auth.signOut();
  } catch {
    // Graceful fallback if no active Supabase auth session
  }

  cookieStore.delete('tourneymaster_session');
  cookieStore.delete('tm_registration_challenge');

  const requestUrl = new URL(request.url);
  return NextResponse.redirect(new URL('/login', requestUrl.origin), {
    status: 302,
  });
}

export async function POST(request: Request) {
  return handleSignOut(request);
}

export async function GET(request: Request) {
  return handleSignOut(request);
}
