import React from "react";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import History from "@/pages/history";
import Settings from "@/pages/settings";
import Login from "@/pages/auth/login";
import Register from "@/pages/auth/register";
import ComparisonDetail from "@/pages/comparison-detail";
import { ThemeProvider } from "@/components/ui/theme-provider";
import { AuthProvider, useAuth } from "@/contexts/auth";
import MainLayout from "@/components/layout/MainLayout";

// Componente para redireccionar según autenticación
function RedirectComponent() {
  // Obtener la ubicación actual
  const currentPath = window.location.pathname;
  // Si ya está en una ruta de autenticación, no redirigir
  if (!currentPath.includes('/auth/')) {
    window.location.href = "/auth/login";
  }
  return null;
}

// Componente de rutas protegidas
function AuthenticatedRoutes() {
  const { isAuthenticated, isLoading } = useAuth();

  // Si está cargando la autenticación, mostramos un spinner
  if (isLoading) {
    return <div className="flex justify-center items-center h-screen">Cargando...</div>;
  }

  return (
    <MainLayout>
      <Switch>
        {/* Rutas públicas siempre accesibles */}
        <Route path="/auth/login" component={Login} />
        <Route path="/auth/register" component={Register} />
        
        {/* Rutas protegidas - solo accesibles si está autenticado */}
        {isAuthenticated ? (
          <>
            <Route path="/" component={Dashboard} />
            <Route path="/history" component={History} />
            <Route path="/settings" component={Settings} />
            <Route path="/comparison/:id" component={ComparisonDetail} />
            <Route component={NotFound} />
          </>
        ) : (
          // Redirigir a login si no está autenticado y no está en una ruta pública
          <Route path="*" component={RedirectComponent} />
        )}
      </Switch>
    </MainLayout>
  );
}

// Aplicación principal
function App() {
  return (
    <ThemeProvider defaultTheme="dark">
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <AuthenticatedRoutes />
          <Toaster />
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
