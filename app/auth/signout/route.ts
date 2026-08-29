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

  // Delete app session and challenge cookies
  cookieStore.delete('tourneymaster_session');
  cookieStore.delete('tm_registration_challenge');

  // Delete all Supabase auth cookies
  cookieStore.getAll().forEach((c) => {
    if (c.name.startsWith('sb-') || c.name.includes('tourneymaster') || c.name.includes('auth')) {
      cookieStore.delete(c.name);
    }
  });

  const requestUrl = new URL(request.url);
  const response = NextResponse.redirect(new URL('/login', requestUrl.origin), {
    status: 302,
  });

  // Explicitly prevent caching so /login renders fresh
  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  response.headers.set('Pragma', 'no-cache');
  response.headers.set('Expires', '0');

  return response;
}

export async function POST(request: Request) {
  return handleSignOut(request);
}

export async function GET(request: Request) {
  return handleSignOut(request);
}
