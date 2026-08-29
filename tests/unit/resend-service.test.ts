import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('Resend Diagnostics Service (lib/email/resend.ts)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('handles sandbox error and logs warning without throwing', async () => {
    vi.resetModules();
    process.env.RESEND_API_KEY = 'test_key';

    vi.doMock('resend', () => {
      return {
        Resend: class {
          emails = {
            send: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'You can only send testing emails to your own email address' },
            }),
          };
        },
      };
    });

    const warnSpy = vi.spyOn(console, 'warn');
    const errSpy = vi.spyOn(console, 'error');

    const { sendOtpEmail } = await import('@/lib/email/resend');
    const res = await sendOtpEmail('other@example.com', '123456');

    expect(res.success).toBe(false);
    expect(res.error).toMatch(/own email address/i);
    expect(errSpy).toHaveBeenCalledWith('❌ [Resend Error]:', expect.stringMatching(/own email address/i));
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('⚠️ [Resend Sandbox]'));

    warnSpy.mockRestore();
    errSpy.mockRestore();
  });

  it('logs success when Resend sends email successfully', async () => {
    vi.resetModules();
    process.env.RESEND_API_KEY = 'test_key';

    vi.doMock('resend', () => {
      return {
        Resend: class {
          emails = {
            send: vi.fn().mockResolvedValue({
              data: { id: 'email_msg_123' },
              error: null,
            }),
          };
        },
      };
    });

    const logSpy = vi.spyOn(console, 'log');

    const { sendOtpEmail } = await import('@/lib/email/resend');
    const res = await sendOtpEmail('guillermo@example.com', '654321');

    expect(res.success).toBe(true);
    expect(logSpy).toHaveBeenCalledWith('✅ [Resend Success]: Correo entregado a Resend con ID:', 'email_msg_123');

    logSpy.mockRestore();
  });
});
