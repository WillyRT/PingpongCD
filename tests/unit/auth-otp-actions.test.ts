import { describe, it, expect, vi, beforeEach } from 'vitest';
import { requestLoginOtpAction, verifyLoginOtpAction } from '@/lib/actions/auth';

vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: vi.fn(),
  createClient: vi.fn(),
}));

vi.mock('@/lib/email/resend', () => ({
  sendOtpEmail: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
  }),
}));

describe('Passwordless OTP & Resend Auth Actions (lib/actions/auth.ts)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('requestLoginOtpAction logs OTP and sends email via Resend without throwing', async () => {
    const consoleSpy = vi.spyOn(console, 'log');
    const res = await requestLoginOtpAction('test@example.com');

    expect(res.success).toBe(true);
    expect(res.email).toBe('test@example.com');
    expect(consoleSpy).toHaveBeenCalledWith(
      '🔑 [OTP GENERADO]:',
      expect.objectContaining({ email: 'test@example.com', code: expect.any(String) })
    );
    consoleSpy.mockRestore();
  });

  it('does not log OTP in production environment', async () => {
    const originalEnv = process.env.NODE_ENV;
    (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
    const consoleSpy = vi.spyOn(console, 'log');

    await requestLoginOtpAction('test@example.com');

    expect(consoleSpy).not.toHaveBeenCalledWith(
      '🔑 [OTP GENERADO]:',
      expect.anything()
    );

    consoleSpy.mockRestore();
    (process.env as Record<string, string | undefined>).NODE_ENV = originalEnv;
  });

  it('verifyLoginOtpAction logs in successfully using master code 202600 for superadmin', async () => {
    const { createAdminClient } = await import('@/lib/supabase/server');
    (createAdminClient as any).mockReturnValue({
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: {
                id: 'superadmin-id',
                email: 'guillermoriveraterriza@gmail.com',
                role: 'super_admin',
                admin_status: 'approved',
              },
            }),
          }),
        }),
      }),
    });

    const res = await verifyLoginOtpAction({
      email: 'guillermoriveraterriza@gmail.com',
      code: '202600',
    });

    expect(res.success).toBe(true);
    expect(res.destination).toBe('/admin');
    expect(res.role).toBe('super_admin');
  });

  it('verifyLoginOtpAction logs in successfully using master code 202600 for regular player', async () => {
    const { createAdminClient } = await import('@/lib/supabase/server');
    (createAdminClient as any).mockReturnValue({
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: {
                id: 'player-id',
                email: 'wriveraterriza@gmail.com',
                role: 'player',
                admin_status: 'none',
              },
            }),
          }),
        }),
      }),
    });

    const res = await verifyLoginOtpAction({
      email: 'wriveraterriza@gmail.com',
      code: '202600',
    });

    expect(res.success).toBe(true);
    expect(res.destination).toBe('/me');
    expect(res.role).toBe('player');
  });

  it('verifyLoginOtpAction rejects invalid code that is not master code', async () => {
    const res = await verifyLoginOtpAction({
      email: 'player@example.com',
      code: '000111',
    });

    expect(res.success).toBe(false);
    expect(res.error).toMatch(/Código de verificación incorrecto o expirado/i);
  });
});
