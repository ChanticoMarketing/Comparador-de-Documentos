import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import { Express } from 'express';
import { authService } from './auth';
import { db } from '../db';
import { Request, Response, NextFunction } from 'express';
import { User } from '../shared/schema';

const PgSession = connectPgSimple(session);

// Configuración para connect-pg-simple
const pgStoreConfig = {
  conString: process.env.DATABASE_URL, // Usa la URL de conexión directa
  tableName: 'session', // Nombre de la tabla de sesiones (definida en schema.ts)
  createTableIfMissing: true,
  ttl: 7 * 24 * 60 * 60 // 7 días en segundos
};

/**
 * Configuración de la sesión para Express
 * Optimizada para persistencia robusta y mejor manejo de sesiones
 */
const sessionConfig = {
  store: new PgSession(pgStoreConfig),
  secret: process.env.SESSION_SECRET || 'ocr-matcher-secret-key-default',
  // Forzar guardar la sesión para asegurar persistencia
  resave: true,
  // Permite mantener la sesión "viva" con cada petición
  rolling: false,
  // Solo guarda sesiones iniciadas (mejora rendimiento y seguridad)
  saveUninitialized: false,
  name: 'connect.sid', // Nombre estándar de express-session
  cookie: {
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 días para persistencia mayor
    httpOnly: false, // Cambiar a false para permitir acceso desde JavaScript si es necesario
    secure: false, // Deshabilitar en desarrollo para que funcione en localhost
    sameSite: 'lax' as const,
    path: '/', // Asegura que la cookie está disponible en toda la aplicación
    domain: undefined // No especificar dominio para que funcione en cualquier host
  }
};

/**
 * Configura Passport y Express Session para la aplicación
 * @param app Instancia de Express
 */
export function configureAuth(app: Express) {
  // Configurar trust proxy para que las cookies funcionen correctamente
  app.set('trust proxy', 1);
  
  // Configurar la sesión
  app.use(session(sessionConfig));
  
  // Inicializar Passport
  app.use(passport.initialize());
  app.use(passport.session());
  
  // Configurar la estrategia local de Passport
  passport.use(new LocalStrategy(async (username, password, done) => {
    try {
      const user = await authService.loginUser({ username, password });
      return done(null, user);
    } catch (error) {
      return done(error);
    }
  }));
  
  // Serializar el usuario para la sesión
  passport.serializeUser((user: any, done) => {
    done(null, user.id);
  });
  
  // Deserializar el usuario de la sesión
  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await authService.getUserById(id);
      if (!user) {
        return done(null, false); // Usuario no encontrado, sesión inválida
      }
      done(null, user);
    } catch (error) {
      console.error('Error deserializando usuario:', error);
      done(null, false); // En caso de error, invalidar la sesión
    }
  });
}

/**
 * Middleware para verificar si el usuario está autenticado
 */
export function isAuthenticated(req: Request, res: Response, next: NextFunction) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ message: 'Necesita iniciar sesión para acceder a este recurso' });
}

/**
 * Tipo extendido de Request para incluir el usuario
 * Usamos un tipo más flexible para evitar errores de tipo
 */
export interface AuthRequest extends Request {
  user?: any; // Hacemos el tipo más flexible para evitar problemas de compatibilidad
}

/**
 * Helper para obtener el ID del usuario de la solicitud
 */
export function getUserId(req: AuthRequest): number | undefined {
  return req.user?.id;
}