import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { verifyPlayerSessionToken } from '../auth/player-session';

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    '';

  const isProtectedPlayer =
    request.nextUrl.pathname.startsWith('/player') || request.nextUrl.pathname.startsWith('/me');
  const isProtectedAdmin = request.nextUrl.pathname.startsWith('/admin');

  if (!supabaseUrl || !supabaseKey) {
    if (isProtectedPlayer || isProtectedAdmin) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      url.searchParams.set('redirectTo', request.nextUrl.pathname);
      return NextResponse.redirect(url);
    }
    return supabaseResponse;
  }

  try {
    const supabase = createServerClient(
      supabaseUrl,
      supabaseKey,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) => {
              request.cookies.set(name, value);
            });
            supabaseResponse = NextResponse.next({ request });
            cookiesToSet.forEach(({ name, value, options }) => {
              supabaseResponse.cookies.set(name, value, options);
            });
          },
        },
      }
    );

    // IMPORTANT: Use getUser() NOT getSession() for security
    const { data: { user } } = await supabase.auth.getUser();
    const sessionToken = request.cookies.get('tourneymaster_session')?.value;
    const verifiedPlayerSession = await verifyPlayerSessionToken(sessionToken);

    if (isProtectedAdmin && !user) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      url.searchParams.set('redirectTo', request.nextUrl.pathname);
      return NextResponse.redirect(url);
    }

    if (isProtectedPlayer && !user && !verifiedPlayerSession) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      url.searchParams.set('redirectTo', request.nextUrl.pathname);
      return NextResponse.redirect(url);
    }
  } catch {
    // If auth verification fails in Edge Runtime, protect private routes or fail open on public routes
    if (isProtectedAdmin || isProtectedPlayer) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      url.searchParams.set('redirectTo', request.nextUrl.pathname);
      return NextResponse.redirect(url);
    }
    return NextResponse.next({ request });
  }

  return supabaseResponse;
}
