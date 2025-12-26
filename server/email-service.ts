import { Resend } from 'resend';

// Initialize Resend with API key from environment
const resend = new Resend(process.env.RESEND_API_KEY);

// Email configuration
const EMAIL_FROM = process.env.EMAIL_FROM || 'Comparador de Documentos <onboarding@resend.dev>';
const APP_URL = process.env.APP_URL || 'http://localhost';
const APP_PORT = process.env.APP_PORT || 3000;

/**
 * Email Service for sending authentication and notification emails
 */
export class EmailService {
    /**
     * Send email verification link
     */
    async sendVerificationEmail(email: string, token: string, username: string): Promise<void> {
        const verificationUrl = `${APP_URL}:${APP_PORT}/auth/verify-email?token=${token}`;

        try {
            await resend.emails.send({
                from: EMAIL_FROM,
                to: email,
                subject: '✅ Verifica tu cuenta - Comparador de Documentos',
                html: this.getVerificationEmailTemplate(username, verificationUrl),
            });

            console.log(`✓ Email de verificación enviado a ${email}`);
        } catch (error) {
            console.error('Error enviando email de verificación:', error);
            throw new Error('No se pudo enviar el email de verificación');
        }
    }

    /**
     * Send password reset email
     */
    async sendPasswordResetEmail(email: string, token: string, username: string): Promise<void> {
        const resetUrl = `${APP_URL}:${APP_PORT}/auth/reset-password/${token}`;

        // Check if Resend is configured
        if (!process.env.RESEND_API_KEY) {
            const errorMsg = 'RESEND_API_KEY no está configurado';
            console.error(`❌ ${errorMsg}`);
            throw new Error(errorMsg);
        }

        try {
            const result = await resend.emails.send({
                from: EMAIL_FROM,
                to: email,
                subject: '🔐 Recuperación de contraseña - Comparador de Documentos',
                html: this.getPasswordResetTemplate(username, resetUrl),
            });

            console.log(`✓ Email de recuperación de contraseña enviado a ${email}`);
            if (process.env.NODE_ENV !== 'production') {
                console.log('Resend response:', result);
            }
        } catch (error: any) {
            console.error('❌ Error enviando email de recuperación:', error);
            if (error.message) {
                console.error('Error message:', error.message);
            }
            if (error.response) {
                console.error('Resend API response:', error.response);
            }
            throw new Error(`No se pudo enviar el email de recuperación: ${error.message || 'Error desconocido'}`);
        }
    }

    /**
     * Send 2FA code via email
     */
    async send2FACode(email: string, code: string, username: string): Promise<void> {
        try {
            await resend.emails.send({
                from: EMAIL_FROM,
                to: email,
                subject: '🔒 Código de verificación - Comparador de Documentos',
                html: this.get2FACodeTemplate(username, code),
            });

            console.log(`✓ Código 2FA enviado a ${email}`);
        } catch (error) {
            console.error('Error enviando código 2FA:', error);
            throw new Error('No se pudo enviar el código de verificación');
        }
    }

    /**
     * Send general notification
     */
    async sendNotification(email: string, subject: string, message: string): Promise<void> {
        try {
            await resend.emails.send({
                from: EMAIL_FROM,
                to: email,
                subject: subject,
                html: this.getNotificationTemplate(message),
            });

            console.log(`✓ Notificación enviada a ${email}`);
        } catch (error) {
            console.error('Error enviando notificación:', error);
            throw new Error('No se pudo enviar la notificación');
        }
    }

    /**
     * HTML Template for verification email
     */
    private getVerificationEmailTemplate(username: string, verificationUrl: string): string {
        return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Verifica tu cuenta</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 28px;">¡Bienvenido!</h1>
        </div>
        <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
          <p style="font-size: 16px; margin-bottom: 20px;">Hola <strong>${username}</strong>,</p>
          <p style="font-size: 16px; margin-bottom: 20px;">Gracias por registrarte en Comparador de Documentos. Para completar tu registro y verificar tu cuenta, haz clic en el botón de abajo:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${verificationUrl}" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 14px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">Verificar mi cuenta</a>
          </div>
          <p style="font-size: 14px; color: #666; margin-top: 30px;">Si no creaste esta cuenta, puedes ignorar este email.</p>
          <p style="font-size: 14px; color: #666; margin-top: 10px;">Este enlace expirará en <strong>24 horas</strong>.</p>
          <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
          <p style="font-size: 12px; color: #999; text-align: center;">Comparador de Documentos © ${new Date().getFullYear()}</p>
        </div>
      </body>
      </html>
    `;
    }

    /**
     * HTML Template for password reset email
     */
    private getPasswordResetTemplate(username: string, resetUrl: string): string {
        return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Recupera tu contraseña</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 28px;">🔐 Recuperación de Contraseña</h1>
        </div>
        <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
          <p style="font-size: 16px; margin-bottom: 20px;">Hola <strong>${username}</strong>,</p>
          <p style="font-size: 16px; margin-bottom: 20px;">Recibimos una solicitud para restablecer tu contraseña. Haz clic en el botón de abajo para crear una nueva contraseña:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; padding: 14px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">Restablecer contraseña</a>
          </div>
          <p style="font-size: 14px; color: #666; margin-top: 30px;">Si no solicitaste este cambio, puedes ignorar este email de forma segura.</p>
          <p style="font-size: 14px; color: #666; margin-top: 10px;">Este enlace expirará en <strong>1 hora</strong> por seguridad.</p>
          <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
          <p style="font-size: 12px; color: #999; text-align: center;">Comparador de Documentos © ${new Date().getFullYear()}</p>
        </div>
      </body>
      </html>
    `;
    }

    /**
     * HTML Template for 2FA code email
     */
    private get2FACodeTemplate(username: string, code: string): string {
        return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Código de verificación</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 28px;">🔒 Código de Verificación</h1>
        </div>
        <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
          <p style="font-size: 16px; margin-bottom: 20px;">Hola <strong>${username}</strong>,</p>
          <p style="font-size: 16px; margin-bottom: 20px;">Tu código de autenticación de dos factores es:</p>
          <div style="text-align: center; margin: 30px 0; background: white; padding: 20px; border-radius: 10px; border: 2px dashed #4facfe;">
            <span style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #4facfe; font-family: 'Courier New', monospace;">${code}</span>
          </div>
          <p style="font-size: 14px; color: #666; margin-top: 30px;">Ingresa este código en la página de verificación para continuar.</p>
          <p style="font-size: 14px; color: #666; margin-top: 10px;">Este código expirará en <strong>5 minutos</strong>.</p>
          <p style="font-size: 14px; color: #e74c3c; margin-top: 20px; font-weight: bold;">⚠️ Si no intentaste iniciar sesión, ignora este email y tu cuenta permanecerá segura.</p>
          <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
          <p style="font-size: 12px; color: #999; text-align: center;">Comparador de Documentos © ${new Date().getFullYear()}</p>
        </div>
      </body>
      </html>
    `;
    }

    /**
     * HTML Template for general notifications
     */
    private getNotificationTemplate(message: string): string {
        return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Notificación</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 28px;">📧 Notificación</h1>
        </div>
        <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
          <div style="font-size: 16px; margin-bottom: 20px;">
            ${message}
          </div>
          <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
          <p style="font-size: 12px; color: #999; text-align: center;">Comparador de Documentos © ${new Date().getFullYear()}</p>
        </div>
      </body>
      </html>
    `;
    }
}

// Export singleton instance
export const emailService = new EmailService();
