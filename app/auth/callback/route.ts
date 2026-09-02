import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createPlayerSessionToken, PLAYER_SESSION_COOKIE_OPTIONS } from '@/lib/auth/player-session';
import { cookies } from 'next/headers';
import { isSuperAdminProfile, isApprovedStaff } from '@/lib/auth/roles';

/**
 * Validates the redirectTo query parameter to prevent Open Redirect attacks.
 * Only allows relative paths that start with a single `/`.
 * Rejects protocol-relative URLs (`//`), URLs containing schemas (`http:`, `javascript:`, etc.),
 * or backslashes (`\`).
 * 
 * Default fallback is `/admin`.
 */
export function validateRedirectUrl(target: string | null | undefined, fallback: string = '/admin'): string {
  if (!target || typeof target !== 'string') {
    return fallback;
  }

  const trimmed = target.trim();

  // Must start with exactly one `/` and not followed by another `/` or `\`
  if (!trimmed.startsWith('/') || trimmed.startsWith('//') || trimmed.startsWith('/\\')) {
    return fallback;
  }

  // Must not contain any backslash anywhere
  if (trimmed.includes('\\')) {
    return fallback;
  }

  // Must not contain any URL scheme/protocol (e.g., `javascript:`, `http:`, `data:`) before query/fragment
  const pathPart = trimmed.split(/[?#]/)[0] ?? '';
  if (pathPart.includes(':')) {
    return fallback;
  }

  return trimmed;
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const nextParam = requestUrl.searchParams.get('next') || requestUrl.searchParams.get('redirectTo');

  if (code) {
    const cookieStore = await cookies();
    const supabase = await createClient();
    const { data: { session }, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && session?.user) {
      const userEmail = session.user.email?.toLowerCase();

      // Consultar el perfil por email
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, role, name, nickname, admin_status')
        .eq('email', userEmail)
        .maybeSingle();

      const isSuperAdmin = isSuperAdminProfile({ email: userEmail, role: profile?.role });
      const role = isSuperAdmin ? 'super_admin' : (profile?.role || 'player');

      // Si es jugador, emitir cookie de sesión de jugador
      if (role === 'player' && profile) {
        const token = await createPlayerSessionToken({
          playerId: profile.id,
          email: userEmail!,
        });
        cookieStore.set('tourneymaster_session', token, PLAYER_SESSION_COOKIE_OPTIONS);
      }

      // Redirección inteligente respetando ruta solicitada o por rol
      if (nextParam) {
        const validated = validateRedirectUrl(nextParam, '');
        if (validated && validated !== '/login') {
          return NextResponse.redirect(new URL(validated, requestUrl.origin));
        }
      }

      if (isSuperAdmin || isApprovedStaff(profile)) {
        return NextResponse.redirect(new URL('/admin', requestUrl.origin));
      }

      return NextResponse.redirect(new URL('/me', requestUrl.origin));
    }
  }

  return NextResponse.redirect(new URL('/login?error=auth_failed', requestUrl.origin));
}
