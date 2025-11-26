import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { db } from '../db';
import { users, insertUserSchema, loginUserSchema } from '../shared/schema';
import { eq } from 'drizzle-orm';
import { InsertUser, User, LoginUser } from '../shared/schema';
import { z } from 'zod';
import { storage } from './storage';
import { emailService } from './email-service';

const SALT_ROUNDS = 10;

/**
 * Servicio de autenticación para la aplicación
 */
export class AuthService {
  /**
   * Registra un nuevo usuario en el sistema
   * @param userData Datos del usuario a registrar
   * @returns El usuario creado sin la contraseña
   */
  async registerUser(userData: InsertUser): Promise<Omit<User, 'password'>> {
    try {
      // Validar los datos de entrada
      const validatedData = insertUserSchema.parse(userData);
      // Comprobar si el usuario ya existe
      const existingUser = await db.query.users.findFirst({
        where: eq(users.username, validatedData.username)
      });

      if (existingUser) {
        throw new Error('El nombre de usuario ya está en uso');
      }

      // Comprobar si el email ya existe
      const existingEmail = await db.query.users.findFirst({
        where: eq(users.email, validatedData.email)
      });

      if (existingEmail) {
        throw new Error('El email ya está en uso');
      }

      // Hashear la contraseña
      const hashedPassword = await bcrypt.hash(validatedData.password, SALT_ROUNDS);

      // Insertar el nuevo usuario
      const [newUser] = await db.insert(users).values({
        ...validatedData,
        password: hashedPassword
      }).returning({
        id: users.id,
        username: users.username,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt
      });
      return newUser;
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new Error(`Error de validación: ${error.errors.map(e => e.message).join(', ')}`);
      }
      throw error;
    }
  }
  /**
   * Autentica a un usuario en el sistema
   * @param loginData Datos de inicio de sesión
   * @returns El usuario autenticado sin la contraseña
   */
  async loginUser(loginData: LoginUser): Promise<Omit<User, 'password'>> {
    try {
      // Validar los datos de entrada
      const validatedData = loginUserSchema.parse(loginData);
      // Buscar el usuario por nombre de usuario
      const user = await db.query.users.findFirst({
        where: eq(users.username, validatedData.username)
      });

      if (!user) {
        throw new Error('Nombre de usuario o contraseña incorrectos');
      }

      // Verificar la contraseña
      const passwordMatch = await bcrypt.compare(validatedData.password, user.password);

      if (!passwordMatch) {
        throw new Error('Nombre de usuario o contraseña incorrectos');
      }

      // Devolver el usuario sin la contraseña
      const { password, ...userWithoutPassword } = user;
      return userWithoutPassword;
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new Error(`Error de validación: ${error.errors.map(e => e.message).join(', ')}`);
      }
      throw error;
    }
  }
  /**
   * Obtiene un usuario por su ID
   * @param userId ID del usuario
   * @returns El usuario sin la contraseña
   */
  async getUserById(userId: number): Promise<Omit<User, 'password'> | null> {
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId)
    });

    if (!user) {
      return null;
    }

    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  // ===========================
  // Email Verification
  // ===========================

  /**
   * Request email verification and send verification email
   */
  async requestEmailVerification(userId: number): Promise<void> {
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId)
    });

    if (!user) {
      throw new Error('Usuario no encontrado');
    }

    if (user.emailVerified) {
      throw new Error('El email ya está verificado');
    }

    // Generate unique token
    const token = crypto.randomBytes(32).toString('hex');

    // Token expires in 24 hours
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    // Save token to database
    await storage.createEmailVerificationToken(userId, token, expiresAt);

    // Send verification email
    await emailService.sendVerificationEmail(user.email, token, user.username);
  }

  /**
   * Verify email with token
   */
  async verifyEmail(token: string): Promise<void> {
    const verificationToken = await storage.getEmailVerificationToken(token);

    if (!verificationToken) {
      throw new Error('Token de verificación inválido');
    }

    // Check if token has expired
    if (new Date() > verificationToken.expiresAt) {
      await storage.deleteEmailVerificationToken(verificationToken.id);
      throw new Error('El token de verificación ha expirado');
    }

    // Mark email as verified
    await db.update(users)
      .set({ emailVerified: true })
      .where(eq(users.id, verificationToken.userId));

    // Delete used token
    await storage.deleteEmailVerificationToken(verificationToken.id);
  }

  // ===========================
  // Password Reset
  // ===========================

  /**
   * Request password reset and send reset email
   */
  async requestPasswordReset(email: string): Promise<void> {
    const user = await db.query.users.findFirst({
      where: eq(users.email, email)
    });

    if (!user) {
      // Don't reveal if email exists for security
      return;
    }

    // Generate unique token
    const token = crypto.randomBytes(32).toString('hex');

    // Token expires in 1 hour
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1);

    // Save token to database
    await storage.createPasswordResetToken(user.id, token, expiresAt);

    // Send password reset email
    await emailService.sendPasswordResetEmail(user.email, token, user.username);
  }

  /**
   * Reset password with token
   */
  async resetPassword(token: string, newPassword: string): Promise<void> {
    const resetToken = await storage.getPasswordResetToken(token);

    if (!resetToken) {
      throw new Error('Token de recuperación inválido o ya usado');
    }

    // Check if token has expired
    if (new Date() > resetToken.expiresAt) {
      throw new Error('El token de recuperación ha expirado');
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);

    // Update password
    await db.update(users)
      .set({ password: hashedPassword })
      .where(eq(users.id, resetToken.userId));

    // Mark token as used
    await storage.markPasswordResetTokenAsUsed(resetToken.id);
  }

  // ===========================
  // Two-Factor Authentication (2FA)
  // ===========================

  /**
   * Enable 2FA for a user
   */
  async enable2FA(userId: number): Promise<void> {
    await db.update(users)
      .set({ twoFactorEnabled: true })
      .where(eq(users.id, userId));
  }

  /**
   * Disable 2FA for a user
   */
  async disable2FA(userId: number): Promise<void> {
    await db.update(users)
      .set({ twoFactorEnabled: false, twoFactorSecret: null })
      .where(eq(users.id, userId));
  }

  /**
   * Generate and send 2FA code
   */
  async generate2FACode(userId: number): Promise<void> {
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId)
    });

    if (!user) {
      throw new Error('Usuario no encontrado');
    }

    if (!user.twoFactorEnabled) {
      throw new Error('2FA no está habilitado para este usuario');
    }

    // Generate 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    // Code expires in 5 minutes
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 5);

    // Save code to database
    await storage.create2FACode(userId, code, expiresAt);

    // Send code via email
    await emailService.send2FACode(user.email, code, user.username);
  }

  /**
   * Verify 2FA code
   */
  async verify2FACode(userId: number, code: string): Promise<boolean> {
    const twoFactorCode = await storage.get2FACode(userId, code);

    if (!twoFactorCode) {
      return false;
    }

    // Check if code has expired
    if (new Date() > twoFactorCode.expiresAt) {
      await storage.mark2FACodeAsUsed(twoFactorCode.id);
      return false;
    }

    // Mark code as used
    await storage.mark2FACodeAsUsed(twoFactorCode.id);

    return true;
  }
}

// Instancia global del servicio de autenticación
export const authService = new AuthService();