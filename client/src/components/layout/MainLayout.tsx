import React from 'react';
import Navbar from './Navbar';
import { useAuth } from '@/contexts/auth';

interface MainLayoutProps {
  children: React.ReactNode;
}

const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  
  // En páginas de autenticación no mostramos la barra de navegación
  const isAuthPage = window.location.pathname.includes('/auth/');
  
  return (
    <div className="flex flex-col min-h-screen">
      {!isAuthPage && <Navbar />}
      <main className="flex-1">
        {children}
      </main>
    </div>
  );
};

export default MainLayout;