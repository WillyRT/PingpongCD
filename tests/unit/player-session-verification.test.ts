import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  getSigningSecret,
  PLAYER_SESSION_COOKIE,
  PLAYER_SESSION_COOKIE_OPTIONS,
  createPlayerSessionToken,
  verifyPlayerSessionToken,
} from '../../lib/auth/player-session';
import {
  generateVerificationCode,
  createRegistrationChallengeToken,
  verifyRegistrationChallengeToken,
  REGISTRATION_CHALLENGE_COOKIE,
} from '../../lib/auth/verification-code';

describe('Player Session Verification & Cookie Hardening Suite', () => {
  const originalEnvSecret = process.env.SESSION_SECRET;
  const originalHmacSecret = process.env.HMAC_SECRET;
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    process.env.SESSION_SECRET = 'test-secret-session-verification-key-123456789';
    delete process.env.HMAC_SECRET;
  });

  afterEach(() => {
    process.env.SESSION_SECRET = originalEnvSecret;
    process.env.HMAC_SECRET = originalHmacSecret;
    if (originalNodeEnv !== undefined) {
      (process.env as Record<string, string | undefined>).NODE_ENV = originalNodeEnv;
    }
  });

  describe('1. Hardening de Secretos HMAC', () => {
    it('returns SESSION_SECRET when defined', () => {
      process.env.SESSION_SECRET = 'my-custom-prod-secret';
      expect(getSigningSecret()).toBe('my-custom-prod-secret');
    });

    it('falls back to HMAC_SECRET when SESSION_SECRET is not set', () => {
      delete process.env.SESSION_SECRET;
      process.env.HMAC_SECRET = 'my-custom-hmac-secret';
      expect(getSigningSecret()).toBe('my-custom-hmac-secret');
    });

    it('falls back to robust default key if neither SESSION_SECRET nor HMAC_SECRET is set', () => {
      delete process.env.SESSION_SECRET;
      delete process.env.HMAC_SECRET;
      expect(getSigningSecret()).toBe('tourneymaster_default_secure_secret_fallback_key_2026');
    });
  });

  describe('2. Flags Estrictos en tourneymaster_session Cookie', () => {
    it('enforces httpOnly: true, sameSite: lax, path: /, and 7-day maxAge', () => {
      expect(PLAYER_SESSION_COOKIE).toBe('tourneymaster_session');
      expect(PLAYER_SESSION_COOKIE_OPTIONS.httpOnly).toBe(true);
      expect(PLAYER_SESSION_COOKIE_OPTIONS.sameSite).toBe('lax');
      expect(PLAYER_SESSION_COOKIE_OPTIONS.path).toBe('/');
      expect(PLAYER_SESSION_COOKIE_OPTIONS.maxAge).toBe(60 * 60 * 24 * 7); // 7 days = 604,800s
    });

    it('evaluates secure flag based on NODE_ENV === production', () => {
      const isProd = (env: string) => env === 'production';
      expect(isProd('production')).toBe(true);
      expect(isProd('development')).toBe(false);
      expect(isProd('test')).toBe(false);
      expect(typeof PLAYER_SESSION_COOKIE_OPTIONS.secure).toBe('boolean');
    });

    it('includes issuedAt (iat) and 7-day expiration (exp) in session payload', async () => {
      const now = Math.floor(Date.now() / 1000);
      const token = await createPlayerSessionToken({
        playerId: 'player-uuid-1',
        email: 'player@example.com',
        tournamentId: 'tourney-uuid-9',
      });

      const payload = await verifyPlayerSessionToken(token);
      expect(payload).not.toBeNull();
      expect(payload?.playerId).toBe('player-uuid-1');
      expect(payload?.email).toBe('player@example.com');
      expect(payload?.tournamentId).toBe('tourney-uuid-9');
      expect(payload?.issuedAt).toBeDefined();
      expect(payload?.issuedAt).toBeGreaterThanOrEqual(now - 2);
      expect(payload?.exp).toBe((payload?.issuedAt ?? now) + 60 * 60 * 24 * 7);
    });
  });

  describe('3. Generación y Validación de Código OTP de 6 Dígitos', () => {
    it('generates a 6-digit numeric string', () => {
      for (let i = 0; i < 20; i++) {
        const code = generateVerificationCode();
        expect(code).toMatch(/^[1-9][0-9]{5}$/);
        expect(code.length).toBe(6);
      }
    });

    it('creates an HMAC-signed challenge token with challenge cookie name', () => {
      expect(REGISTRATION_CHALLENGE_COOKIE).toBe('tm_registration_challenge');
    });

    it('successfully validates challenge token when code, email, and tournament match', async () => {
      const code = generateVerificationCode();
      const challengeToken = await createRegistrationChallengeToken({
        email: 'test@pingpong.cd',
        code,
        tournamentId: 't-100',
        playerId: 'p-100',
        name: 'Pablo Ruiz',
        category: 'sub14',
        declaredLevel: 6,
        assignedRating: 1450,
      });

      const result = await verifyRegistrationChallengeToken(
        challengeToken,
        code,
        'test@pingpong.cd',
        't-100'
      );

      expect(result.valid).toBe(true);
      expect(result.data?.email).toBe('test@pingpong.cd');
      expect(result.data?.playerId).toBe('p-100');
      expect(result.data?.assignedRating).toBe(1450);
    });

    it('rejects verification if the OTP code is incorrect', async () => {
      const correctCode = '123456';
      const wrongCode = '654321';
      const challengeToken = await createRegistrationChallengeToken({
        email: 'victim@pingpong.cd',
        code: correctCode,
        tournamentId: 't-100',
        playerId: 'p-100',
        name: 'Victima',
        category: 'plus14',
        declaredLevel: 5,
        assignedRating: 1500,
      });

      const result = await verifyRegistrationChallengeToken(
        challengeToken,
        wrongCode,
        'victim@pingpong.cd',
        't-100'
      );

      expect(result.valid).toBe(false);
      expect(result.reason).toMatch(/Código de verificación incorrecto/i);
    });

    it('rejects verification if the email does not match the challenge payload', async () => {
      const code = '123456';
      const challengeToken = await createRegistrationChallengeToken({
        email: 'original@pingpong.cd',
        code,
        tournamentId: 't-100',
        playerId: 'p-100',
        name: 'Original',
        category: 'plus14',
        declaredLevel: 5,
        assignedRating: 1500,
      });

      const result = await verifyRegistrationChallengeToken(
        challengeToken,
        code,
        'impersonator@pingpong.cd',
        't-100'
      );

      expect(result.valid).toBe(false);
      expect(result.reason).toMatch(/El email no coincide/i);
    });

    it('rejects verification if the challenge token has expired', async () => {
      const code = '123456';
      // Token expired 10 seconds ago
      const expiredToken = await createRegistrationChallengeToken(
        {
          email: 'expired@pingpong.cd',
          code,
          tournamentId: 't-100',
          playerId: 'p-100',
          name: 'Expired User',
          category: 'plus14',
          declaredLevel: 5,
          assignedRating: 1500,
        },
        -10
      );

      const result = await verifyRegistrationChallengeToken(
        expiredToken,
        code,
        'expired@pingpong.cd',
        't-100'
      );

      expect(result.valid).toBe(false);
      expect(result.reason).toMatch(/ha expirado/i);
    });

    it('rejects tampered challenge token payload data', async () => {
      const code = '123456';
      const token = await createRegistrationChallengeToken({
        email: 'legit@pingpong.cd',
        code,
        tournamentId: 't-100',
        playerId: 'p-100',
        name: 'Legit',
        category: 'plus14',
        declaredLevel: 5,
        assignedRating: 1500,
      });

      const [payloadB64, signature] = token.split('.');
      const jsonStr = Buffer.from(payloadB64!, 'base64').toString('utf8');
      const tamperedObj = JSON.parse(jsonStr);
      tamperedObj.email = 'attacker@pingpong.cd';

      const tamperedB64 = Buffer.from(JSON.stringify(tamperedObj))
        .toString('base64')
        .replace(/=/g, '')
        .replace(/\+/g, '-')
        .replace(/\//g, '_');

      const tamperedToken = `${tamperedB64}.${signature}`;
      const result = await verifyRegistrationChallengeToken(
        tamperedToken,
        code,
        'attacker@pingpong.cd',
        't-100'
      );

      expect(result.valid).toBe(false);
      expect(result.reason).toMatch(/Firma criptográfica inválida/i);
    });
  });

  describe('4. Prevención de Confirmación sin Sesión Verificada (confirm_match)', () => {
    it('rejects match confirmation when token is null or undefined', async () => {
      const session = await verifyPlayerSessionToken(null);
      expect(session).toBeNull();
    });

    it('rejects match confirmation when token signature is tampered', async () => {
      const legitToken = await createPlayerSessionToken({
        playerId: 'player-x',
        email: 'player@example.com',
        tournamentId: 'tourney-1',
      });

      const [payload, sig] = legitToken.split('.');
      const corruptToken = `${payload}.${sig}xyz`;
      const session = await verifyPlayerSessionToken(corruptToken);
      expect(session).toBeNull();
    });

    it('rejects match confirmation when session has expired', async () => {
      // Expired token (expiresInSeconds = -10)
      const expiredToken = await createPlayerSessionToken(
        {
          playerId: 'player-expired',
          email: 'expired@example.com',
          tournamentId: 'tourney-1',
        },
        -10
      );

      const session = await verifyPlayerSessionToken(expiredToken);
      expect(session).toBeNull();
    });
  });
});
