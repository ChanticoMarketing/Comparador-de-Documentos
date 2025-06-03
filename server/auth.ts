import bcrypt from 'bcrypt';
import { db } from '../db';
import { users, insertUserSchema, loginUserSchema } from '../shared/schema';
import { eq } from 'drizzle-orm';
import { InsertUser, User, LoginUser } from '../shared/schema';
import { z } from 'zod';

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
}

// Instancia global del servicio de autenticación
export const authService = new AuthService();