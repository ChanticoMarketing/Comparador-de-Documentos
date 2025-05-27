import React, { createContext, useContext, useState, useEffect } from 'react';
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient } from '../lib/queryClient';

// Tipos y definiciones
export type User = {
  id: number;
  username: string;
  email: string;
  firstName?: string;
  lastName?: string;
};

export interface RegisterData {
  username: string;
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
}

interface AuthContextProps {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (userData: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
}

// Contexto de autenticación
const AuthContext = createContext<AuthContextProps | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const { toast } = useToast();

  // Consulta para verificar si el usuario está autenticado
  const { isLoading: authCheckLoading, data: userData, refetch } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: async () => {
      try {
        const response = await fetch('/api/auth/me', {
          method: 'GET',
          credentials: 'include', // Incluir cookies en todas las peticiones
          headers: {
            'Content-Type': 'application/json',
          },
        });
        if (!response.ok) {
          if (response.status === 401) {
            return null; // No autenticado, pero no es un error
          }
          throw new Error('Error al verificar la autenticación');
        }
        return response.json();
      } catch (error) {
        console.error('Error al verificar autenticación:', error);
        return null;
      }
    },
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000, // 5 minutos antes de considerar datos obsoletos
    gcTime: 10 * 60 * 1000, // 10 minutos en caché
  });

  // Actualizar el usuario cuando cambia la consulta
  useEffect(() => {
    setUser(userData || null);
  }, [userData]);

  // Mutación para inicio de sesión
  const loginMutation = useMutation({
    mutationFn: async ({ username, password }: { username: string, password: string }) => {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include', // Incluir cookies para persistir la sesión
        body: JSON.stringify({ username, password }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Error en el inicio de sesión');
      }

      return response.json();
    },
    onSuccess: (data) => {
      setUser(data);
      toast({
        title: "¡Inicio de sesión exitoso!",
        description: `Bienvenido de vuelta, ${data.username}`,
      });
      queryClient.invalidateQueries({ queryKey: ['auth'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error al iniciar sesión",
        description: error.message || "Credenciales inválidas",
        variant: "destructive",
      });
    },
  });

  // Mutación para registro
  const registerMutation = useMutation({
    mutationFn: async (userData: RegisterData) => {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include', // Incluir cookies para persistir la sesión
        body: JSON.stringify(userData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Error en el registro');
      }

      return response.json();
    },
    onSuccess: (data) => {
      setUser(data);
      toast({
        title: "¡Registro exitoso!",
        description: `Bienvenido, ${data.username}`,
      });
      queryClient.invalidateQueries({ queryKey: ['auth'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error al registrarse",
        description: error.message || "No se pudo completar el registro",
        variant: "destructive",
      });
    },
  });

  // Mutación para cierre de sesión
  const logoutMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include', // Incluir cookies para el logout
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Error al cerrar sesión');
      }

      return response.json();
    },
    onSuccess: () => {
      setUser(null);
      toast({
        title: "Sesión cerrada",
        description: "Has cerrado sesión correctamente",
      });
      queryClient.invalidateQueries({ queryKey: ['auth'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error al cerrar sesión",
        description: error.message || "No se pudo cerrar la sesión",
        variant: "destructive",
      });
    },
  });

  // Funciones de autenticación
  const login = async (username: string, password: string) => {
    await loginMutation.mutateAsync({ username, password });
  };

  const register = async (userData: RegisterData) => {
    await registerMutation.mutateAsync(userData);
  };

  const logout = async () => {
    await logoutMutation.mutateAsync();
  };

  // Comprobar el estado de autenticación al cargar
  useEffect(() => {
    refetch();
  }, [refetch]);

  const value = {
    user,
    isLoading: authCheckLoading || loginMutation.isPending || registerMutation.isPending || logoutMutation.isPending,
    isAuthenticated: !!user,
    login,
    register,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe usarse dentro de un AuthProvider');
  }
  return context;
}