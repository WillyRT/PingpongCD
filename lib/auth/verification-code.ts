import { cookies } from 'next/headers';
import { getSigningSecret, computeSignature } from './player-session';

export const REGISTRATION_CHALLENGE_COOKIE = 'tm_registration_challenge';

export interface RegistrationChallengeData {
  email: string;
  code: string;
  tournamentId: string;
  playerId: string;
  name: string;
  category: string;
  declaredLevel: number;
  assignedRating: number;
  exp: number;
  attempts?: number;
}

/**
 * Standard Web-API Base64URL encoder.
 */
function base64UrlEncode(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary)
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

/**
 * Standard Web-API Base64URL decoder.
 */
function base64UrlDecode(str: string): string {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

function base64UrlToBuffer(str: string): Uint8Array {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Generates a cryptographically secure 6-digit verification code.
 */
export function generateVerificationCode(): string {
  const buffer = new Uint32Array(1);
  crypto.getRandomValues(buffer);
  const val = buffer[0]!;
  // Range from 100000 to 999999
  const code = (100000 + (val % 900000)).toString();
  return code;
}

/**
 * Creates a cryptographically signed registration challenge token.
 */
export async function createRegistrationChallengeToken(
  data: Omit<RegistrationChallengeData, 'exp'>,
  expiresInSeconds: number = 15 * 60 // 15 minutes
): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + expiresInSeconds;
  const payload: RegistrationChallengeData = {
    ...data,
    email: data.email.toLowerCase().trim(),
    exp,
  };

  const payloadB64 = base64UrlEncode(JSON.stringify(payload));
  const signature = await computeSignature(payloadB64);
  return `${payloadB64}.${signature}`;
}

/**
 * Verifies a registration challenge token with the user-provided 6-digit code.
 */
export async function verifyRegistrationChallengeToken(
  token: string | undefined | null,
  code: string,
  email: string,
  tournamentId: string
): Promise<{ valid: boolean; data?: RegistrationChallengeData; reason?: string }> {
  if (!token || typeof token !== 'string' || !token.includes('.')) {
    return { valid: false, reason: 'Token de verificación no encontrado' };
  }

  const parts = token.split('.');
  if (parts.length !== 2) {
    return { valid: false, reason: 'Formato de token inválido' };
  }

  const [payloadB64, signatureB64] = parts;
  if (!payloadB64 || !signatureB64) {
    return { valid: false, reason: 'Token incompleto' };
  }

  try {
    const secret = getSigningSecret();
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      enc.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const dataBytes = enc.encode(payloadB64);
    const sigBytes = base64UrlToBuffer(signatureB64);

    const isValidSig = await crypto.subtle.verify('HMAC', key, sigBytes as any, dataBytes);
    if (!isValidSig) {
      return { valid: false, reason: 'Firma criptográfica inválida (token manipulado)' };
    }

    const payload = JSON.parse(base64UrlDecode(payloadB64)) as RegistrationChallengeData;

    const now = Math.floor(Date.now() / 1000);
    if (payload.exp < now) {
      return { valid: false, reason: 'El código de verificación ha expirado' };
    }

    if (payload.email.toLowerCase().trim() !== email.toLowerCase().trim()) {
      return { valid: false, reason: 'El email no coincide con la solicitud de registro' };
    }

    if (payload.attempts && payload.attempts >= 5) {
      return { valid: false, reason: 'Has superado el límite de 5 intentos fallidos. El token ha sido invalidado.' };
    }

    if (payload.code.trim() !== code.trim()) {
      const currentAttempts = (payload.attempts || 0) + 1;
      const isExceeded = currentAttempts >= 5;
      return {
        valid: false,
        reason: isExceeded
          ? 'Has superado el límite de 5 intentos fallidos. El código ha sido invalidado por seguridad.'
          : `Código de verificación incorrecto (intento ${currentAttempts} de 5)`,
      };
    }

    return { valid: true, data: payload };
  } catch (err: unknown) {
    return { valid: false, reason: err instanceof Error ? err.message : 'Error verificando token' };
  }
}

/**
 * Sets the registration challenge cookie.
 */
export async function setRegistrationChallengeCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(REGISTRATION_CHALLENGE_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 15 * 60, // 15 minutes
  });
}

/**
 * Reads the registration challenge cookie.
 */
export async function getRegistrationChallengeCookie(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get(REGISTRATION_CHALLENGE_COOKIE)?.value;
}

/**
 * Clears the registration challenge cookie.
 */
export async function clearRegistrationChallengeCookie(): Promise<void> {
  try {
    const cookieStore = await cookies();
    cookieStore.delete(REGISTRATION_CHALLENGE_COOKIE);
  } catch {
    // Ignore outside active HTTP context
  }
}
