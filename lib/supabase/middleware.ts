import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { verifyPlayerSessionToken } from '../auth/player-session';

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const pathname = request.nextUrl.pathname;

  // 1. Always allow public routes without any circular redirections
  const isPublicRoute =
    pathname === '/' ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/auth') ||
    pathname.startsWith('/ranking') ||
    pathname.startsWith('/leaderboard') ||
    pathname.startsWith('/historico') ||
    pathname.startsWith('/historical') ||
    pathname.startsWith('/t/') ||
    pathname.startsWith('/join/') ||
    (pathname.startsWith('/player/') && !pathname.startsWith('/player/report'));

  if (isPublicRoute && !pathname.startsWith('/admin')) {
    // If the request is already on /login or another public route, never redirect
    if (pathname.startsWith('/login')) {
      return supabaseResponse;
    }
  }

  const isProtectedAdmin = pathname.startsWith('/admin');
  const isProtectedPlayer =
    pathname === '/player' || pathname.startsWith('/player/report') || pathname.startsWith('/me');

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    '';

  if (!supabaseUrl || !supabaseKey) {
    if (isProtectedAdmin && pathname !== '/login') {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      url.search = '';
      url.searchParams.set('redirect', '/admin');
      return NextResponse.redirect(url);
    }
    if (isProtectedPlayer && pathname !== '/login') {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      url.search = '';
      url.searchParams.set('redirect', pathname);
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
      if (pathname !== '/login') {
        const url = request.nextUrl.clone();
        url.pathname = '/login';
        url.search = '';
        url.searchParams.set('redirect', '/admin');
        return NextResponse.redirect(url);
      }
    }

    if (isProtectedPlayer && !user && !verifiedPlayerSession) {
      if (pathname !== '/login') {
        const url = request.nextUrl.clone();
        url.pathname = '/login';
        url.search = '';
        url.searchParams.set('redirect', pathname);
        return NextResponse.redirect(url);
      }
    }
  } catch {
    // If auth verification fails in Edge Runtime, protect private routes or fail open on public routes
    if (isProtectedAdmin && pathname !== '/login') {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      url.search = '';
      url.searchParams.set('redirect', '/admin');
      return NextResponse.redirect(url);
    }
    if (isProtectedPlayer && pathname !== '/login') {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      url.search = '';
      url.searchParams.set('redirect', pathname);
      return NextResponse.redirect(url);
    }
    return NextResponse.next({ request });
  }

  return supabaseResponse;
}

