'use server';

import { cookies } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/server';
import { createPlayerSessionToken, PLAYER_SESSION_COOKIE_OPTIONS } from '@/lib/auth/player-session';
import {
  generateVerificationCode,
  createRegistrationChallengeToken,
  verifyRegistrationChallengeToken,
  setRegistrationChallengeCookie,
  getRegistrationChallengeCookie,
  clearRegistrationChallengeCookie,
  type RegistrationChallengeData,
} from '@/lib/auth/verification-code';
import { sendOtpEmail } from '@/lib/email/resend';
import { isSuperAdminProfile, isApprovedStaff } from '@/lib/auth/roles';
import type { ProfileRow } from '@/lib/types/database';

export interface RequestOtpResult {
  success: boolean;
  email?: string;
  devCode?: string;
  error?: string;
}

export interface VerifyOtpResult {
  success: boolean;
  destination: string;
  role?: string;
  error?: string;
}

/**
 * Requests an OTP code for passwordless login, logs it, and dispatches via Resend.
 */
export async function requestLoginOtpAction(email: string): Promise<RequestOtpResult> {
  try {
    const cleanEmail = email.toLowerCase().trim();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      return { success: false, error: 'Introduce un correo electrónico válido' };
    }

    const code = generateVerificationCode();

    // Log para depuración en consola restringido a desarrollo y test
    if (process.env.NODE_ENV !== 'production') {
      console.log('🔑 [OTP GENERADO]:', { email: cleanEmail, code });
    }

    // Enviar correo vía Resend (no bloqueante si sandbox o sin API key)
    try {
      await sendOtpEmail(cleanEmail, code);
    } catch {
      // Ignorado para no bloquear la interfaz
    }

    // Crear token de desafío y almacenarlo en cookie segura
    const challengeData: Omit<RegistrationChallengeData, 'exp'> = {
      email: cleanEmail,
      code,
      tournamentId: 'login',
      playerId: 'login-flow',
      name: cleanEmail.split('@')[0] || 'Usuario',
      category: 'plus14',
      declaredLevel: 5,
      assignedRating: 1500,
    };

    const token = await createRegistrationChallengeToken(challengeData);
    await setRegistrationChallengeCookie(token);

    return {
      success: true,
      email: cleanEmail,
      devCode: process.env.NODE_ENV !== 'production' ? code : undefined,
    };
  } catch (err: unknown) {
    return {
      success: false,
      error: 'Ha ocurrido un problema al enviar el enlace. Espera un momento o solicita un nuevo código.',
    };
  }
}

/**
 * Verifies a 6-digit OTP code (or master code 202600) and establishes session.
 */
export async function verifyLoginOtpAction(formData: {
  email: string;
  code: string;
}): Promise<VerifyOtpResult> {
  try {
    const cleanEmail = formData.email.toLowerCase().trim();
    const cleanCode = formData.code.trim();

    if (!cleanCode) {
      return { success: false, destination: '/login', error: 'Por favor, introduce el código de verificación.' };
    }

    const isMasterCode = process.env.NODE_ENV !== 'production' && cleanCode === '202600';
    let isValid = isMasterCode;

    if (!isValid) {
      const challengeCookie = await getRegistrationChallengeCookie();
      if (challengeCookie) {
        const check = await verifyRegistrationChallengeToken(challengeCookie, cleanCode, cleanEmail, 'login');
        if (check.valid) {
          isValid = true;
        }
      }
    }

    if (!isValid) {
      return {
        success: false,
        destination: '/login',
        error:
          process.env.NODE_ENV !== 'production'
            ? 'Código de verificación incorrecto o expirado. Vuelve a intentarlo o usa el código maestro 202600.'
            : 'Código de verificación incorrecto o expirado. Vuelve a intentarlo.',
      };
    }

    // Clear challenge cookie after successful validation
    await clearRegistrationChallengeCookie();

    const admin = createAdminClient();

    // Query or auto-provision profile
    let { data: profile } = await admin
      .from('profiles')
      .select('id, role, name, nickname, email, admin_status')
      .eq('email', cleanEmail)
      .maybeSingle();

    const isSuperAdmin = isSuperAdminProfile({ email: cleanEmail, role: profile?.role });

    if (!profile) {
      const newId = crypto.randomUUID();
      const fallbackName = cleanEmail.split('@')[0] || 'Jugador';
      const newProfile = {
        id: newId,
        user_id: null,
        name: fallbackName,
        nickname: fallbackName,
        email: cleanEmail,
        role: isSuperAdmin ? 'super_admin' : 'player',
        admin_status: isSuperAdmin ? 'approved' : 'none',
        category: 'plus14',
        rating: 1500,
        rating_deviation: 350,
        volatility: 0.06,
        matches_played: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      await admin.from('profiles').insert(newProfile);
      profile = {
        id: newProfile.id,
        role: newProfile.role,
        name: newProfile.name,
        nickname: newProfile.nickname,
        email: newProfile.email,
        admin_status: newProfile.admin_status,
      };
    }

    const role = isSuperAdmin ? 'super_admin' : (profile?.role || 'player');
    const shouldRouteToStaffArea = isSuperAdmin || isApprovedStaff(profile);

    // Issue cryptographic tourneymaster_session cookie
    if (profile) {
      const token = await createPlayerSessionToken({
        playerId: profile.id,
        email: cleanEmail,
      });
      const cookieStore = await cookies();
      cookieStore.set('tourneymaster_session', token, PLAYER_SESSION_COOKIE_OPTIONS);
    }

    return {
      success: true,
      role,
      destination: shouldRouteToStaffArea ? '/admin' : '/me',
    };
  } catch (err: unknown) {
    return {
      success: false,
      destination: '/login',
      error: err instanceof Error ? err.message : 'Error verificando código de acceso',
    };
  }
}
