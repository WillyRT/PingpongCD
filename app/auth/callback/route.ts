import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

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
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const rawRedirect = searchParams.get('redirectTo');
  const safeRedirect = validateRedirectUrl(rawRedirect, '/admin');

  if (code) {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          },
        },
      }
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const { data: { user } } = await supabase.auth.getUser();
      let roleDefault = '/me';

      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role, admin_status')
          .or(`id.eq.${user.id},user_id.eq.${user.id}`)
          .maybeSingle();

        const isSuperAdmin =
          user.email?.toLowerCase() === 'guillermoriveraterriza@gmail.com' ||
          profile?.role === 'super_admin';
        const isAdmin = isSuperAdmin || (profile?.role === 'admin' && profile?.admin_status === 'approved');

        roleDefault = isAdmin ? '/admin' : '/me';
      }

      const targetPath = rawRedirect ? validateRedirectUrl(rawRedirect, roleDefault) : roleDefault;
      return NextResponse.redirect(`${origin}${targetPath}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth-failed`);
}
