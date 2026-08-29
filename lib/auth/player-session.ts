import { cookies } from 'next/headers';

export interface PlayerSessionPayload {
  playerId: string;
  email: string;
  tournamentId?: string;
  issuedAt?: number; // Unix timestamp in seconds
  iat?: number;
  exp: number; // Unix timestamp in seconds
}

export const PLAYER_SESSION_COOKIE = 'tourneymaster_session';

export const PLAYER_SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 60 * 60 * 24 * 7, // 7 days
};

let ephemeralSecret: string | null = null;

/**
 * Generates an in-memory ephemeral random secret using Web Crypto API.
 * Edge Runtime and Node.js compatible (does NOT use node:crypto).
 */
export function generateEphemeralSecret(): string {
  if (!ephemeralSecret) {
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    ephemeralSecret = Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  return ephemeralSecret;
}

export function getSigningSecret(): string {
  const secret = process.env.SESSION_SECRET || process.env.HMAC_SECRET;
  if (secret) {
    return secret;
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('SESSION_SECRET is required in production');
  }

  return generateEphemeralSecret();
}

/**
 * Standard Web-API Base64URL string encoder (Edge and Node.js compatible).
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
 * Standard Web-API Base64URL string decoder (Edge and Node.js compatible).
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

/**
 * Converts ArrayBuffer signature to base64url.
 */
function bufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary)
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

/**
 * Converts base64url signature back to ArrayBuffer.
 */
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
 * Imports signing secret into CryptoKey using Web Crypto API.
 */
async function getCryptoKey(secret = getSigningSecret()): Promise<CryptoKey> {
  const enc = new TextEncoder();
  return await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

/**
 * Computes HMAC-SHA256 signature in base64url format using Web Crypto API.
 */
export async function computeSignature(data: string, secret = getSigningSecret()): Promise<string> {
  const key = await getCryptoKey(secret);
  const enc = new TextEncoder();
  const signature = await crypto.subtle.sign('HMAC', key, enc.encode(data));
  return bufferToBase64Url(signature);
}

/**
 * Creates a cryptographically signed session token for a public player.
 * Defaults to 7-day expiration per strict security configuration.
 */
export async function createPlayerSessionToken(
  data: { playerId: string; email: string; tournamentId?: string; issuedAt?: number },
  expiresInSeconds: number = 60 * 60 * 24 * 7 // 7 days
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + expiresInSeconds;
  const issuedAt = data.issuedAt ?? now;
  const payload: PlayerSessionPayload = {
    playerId: data.playerId,
    email: data.email.toLowerCase().trim(),
    tournamentId: data.tournamentId,
    issuedAt,
    iat: issuedAt,
    exp,
  };

  const payloadB64 = base64UrlEncode(JSON.stringify(payload));
  const signature = await computeSignature(payloadB64);
  return `${payloadB64}.${signature}`;
}

/**
 * Verifies a signed session token using Web Crypto HMAC verification.
 * Returns decoded payload if valid and not expired, or null if tampered or invalid.
 */
export async function verifyPlayerSessionToken(
  token: string | undefined | null
): Promise<PlayerSessionPayload | null> {
  if (!token || typeof token !== 'string' || !token.includes('.')) {
    return null;
  }

  const parts = token.split('.');
  if (parts.length !== 2) {
    return null;
  }

  const [payloadB64, signatureB64] = parts;
  if (!payloadB64 || !signatureB64) {
    return null;
  }

  try {
    const key = await getCryptoKey();
    const enc = new TextEncoder();
    const dataBytes = enc.encode(payloadB64);
    const sigBytes = base64UrlToBuffer(signatureB64);

    const isValid = await crypto.subtle.verify('HMAC', key, sigBytes as any, dataBytes);
    if (!isValid) {
      return null;
    }

    const jsonStr = base64UrlDecode(payloadB64);
    const payload = JSON.parse(jsonStr) as PlayerSessionPayload;

    if (!payload.playerId || !payload.exp) {
      return null;
    }

    const now = Math.floor(Date.now() / 1000);
    if (payload.exp < now) {
      return null; // Expired
    }

    return payload;
  } catch {
    return null;
  }
}

/**
 * Sets the signed session cookie in HTTP response headers.
 * Uses strict cookie flags: httpOnly: true, secure in production, sameSite: 'lax', 7-day maxAge.
 */
export async function setPlayerSessionCookie(
  data: { playerId: string; email: string; tournamentId?: string; issuedAt?: number },
  expiresInSeconds: number = 60 * 60 * 24 * 7 // 7 days
): Promise<string> {
  const token = await createPlayerSessionToken(data, expiresInSeconds);
  const cookieStore = await cookies();

  cookieStore.set(PLAYER_SESSION_COOKIE, token, {
    ...PLAYER_SESSION_COOKIE_OPTIONS,
    maxAge: expiresInSeconds,
  });

  return token;
}

/**
 * Reads and verifies the signed player session cookie from request headers.
 */
export async function getPlayerSession(): Promise<PlayerSessionPayload | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(PLAYER_SESSION_COOKIE)?.value;
    return await verifyPlayerSessionToken(token);
  } catch {
    return null;
  }
}

/**
 * Clears the player session cookie.
 */
export async function clearPlayerSessionCookie(): Promise<void> {
  try {
    const cookieStore = await cookies();
    cookieStore.delete(PLAYER_SESSION_COOKIE);
  } catch {
    // Ignore if called outside server context
  }
}
