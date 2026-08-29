import { Resend } from 'resend';

const resendApiKey = process.env.RESEND_API_KEY;

export const resend = resendApiKey ? new Resend(resendApiKey) : null;

export const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';

export async function sendOtpEmail(email: string, code: string): Promise<{ success: boolean; error?: string }> {
  console.log('🔑 [OTP GENERADO]:', { email, code });

  if (!resend) {
    console.warn('[Resend] RESEND_API_KEY no configurada. Se continúa con código en consola o código comodín 202600.');
    return { success: true };
  }

  try {
    const { data, error } = await resend.emails.send({
      from: RESEND_FROM_EMAIL,
      to: email,
      subject: `🏓 PingPongCD - Tu código de acceso: ${code}`,
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; background: #0f172a; color: #ffffff; border-radius: 16px;">
          <h2 style="color: #38bdf8; margin-top: 0;">PingPongCD</h2>
          <p style="font-size: 15px; color: #94a3b8;">Circuito oficial de Tenis de Mesa Ciudad Ducal</p>
          <div style="background: #1e293b; padding: 20px; border-radius: 12px; text-align: center; margin: 24px 0;">
            <span style="font-size: 32px; font-weight: 900; letter-spacing: 6px; color: #38bdf8;">${code}</span>
          </div>
          <p style="font-size: 13px; color: #64748b; line-height: 1.5;">
            Introduce este código en la aplicación para verificar tu identidad y acceder a tu cuenta.
            Este código expira en 15 minutos.
          </p>
        </div>
      `,
    });

    if (error) {
      console.error('❌ [Resend Error]:', error.message);
      // Si es error de sandbox (solo enviar a tu propio correo), indicarlo en consola:
      if (error.message.includes('own email address')) {
        console.warn('⚠️ [Resend Sandbox]: Solo se pueden enviar correos al email titular de la cuenta de Resend hasta verificar un dominio propio.');
      }
      return { success: false, error: error.message };
    } else {
      console.log('✅ [Resend Success]: Correo entregado a Resend con ID:', data?.id);
      return { success: true };
    }
  } catch (err: any) {
    console.error('❌ [Resend Exception]:', err?.message || err);
    return { success: false, error: err?.message };
  }
}
