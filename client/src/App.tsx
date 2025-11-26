import React from "react";
import { Switch, Route, Redirect } from "wouter";
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
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import MainLayout from "@/components/layout/MainLayout";

// Componente para rutas privadas
function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="text-lg">Cargando...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Redirect to="/login" replace />;
  }

  return <>{children}</>;
}

// Componente para rutas públicas
function PublicRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="text-lg">Cargando...</div>
      </div>
    );
  }

  if (isAuthenticated) {
    return <Redirect to="/" replace />;
  }

  return <>{children}</>;
}

// Layout del Dashboard
function DashboardLayout() {
  return (
    <MainLayout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/history" component={History} />
        <Route path="/settings" component={Settings} />
        <Route path="/comparison/:id" component={ComparisonDetail} />
        <Route component={NotFound} />
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
          <Switch>
            {/* Rutas públicas */}
            <Route path="/login">
              <PublicRoute>
                <Login />
              </PublicRoute>
            </Route>
            
            <Route path="/register">
              <PublicRoute>
                <Register />
              </PublicRoute>
            </Route>

            {/* Rutas privadas */}
            <Route path="/" nest>
              <PrivateRoute>
                <DashboardLayout />
              </PrivateRoute>
            </Route>
          </Switch>
          <Toaster />
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;