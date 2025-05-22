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
  pool: db.$pool, // Usa el pool de conexiones de Drizzle
  tableName: 'session', // Nombre de la tabla de sesiones (definida en schema.ts)
  createTableIfMissing: true
};

/**
 * Configuración de la sesión para Express
 */
const sessionConfig = {
  store: new PgSession(pgStoreConfig),
  secret: process.env.SESSION_SECRET || 'ocr-matcher-secret-key',
  resave: true,
  rolling: true,
  saveUninitialized: true,
  cookie: {
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 días
    httpOnly: true,
    secure: false, // Cambiar a true en producción
    sameSite: 'lax' as const
  }
};

/**
 * Configura Passport y Express Session para la aplicación
 * @param app Instancia de Express
 */
export function configureAuth(app: Express) {
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
      done(null, user);
    } catch (error) {
      done(error);
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
 */
export interface AuthRequest extends Request {
  user?: Omit<User, 'password'>;
}

/**
 * Helper para obtener el ID del usuario de la solicitud
 */
export function getUserId(req: AuthRequest): number | undefined {
  return req.user?.id;
}