import React from 'react';
import { Link } from 'wouter';
import UserMenu from '@/components/auth/UserMenu';
import { FileTextIcon, Sun, Moon } from 'lucide-react';
import { useTheme } from '@/components/ui/theme-provider';
import { Button } from '@/components/ui/button';

const Navbar = () => {
  const { theme, setTheme } = useTheme();
  
  // Función para alternar entre tema claro y oscuro
  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };
  
  return (
    <nav className="border-b bg-background">
      <div className="container flex h-16 items-center justify-between px-4">
        <div className="flex items-center gap-6">
          <Link href="/">
            <div className="flex items-center gap-2 font-bold text-lg cursor-pointer">
              <FileTextIcon className="h-6 w-6 text-primary" />
              <span>OCR Intelligence</span>
            </div>
          </Link>
          
          <div className="hidden md:flex items-center gap-6">
            <Link href="/">
              <span className="text-sm font-medium hover:text-primary transition-colors cursor-pointer">
                Dashboard
              </span>
            </Link>
            <Link href="/history">
              <span className="text-sm font-medium hover:text-primary transition-colors cursor-pointer">
                Historial
              </span>
            </Link>
            <Link href="/settings">
              <span className="text-sm font-medium hover:text-primary transition-colors cursor-pointer">
                Configuración
              </span>
            </Link>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={toggleTheme}>
            {theme === 'dark' ? (
              <Sun className="h-5 w-5" />
            ) : (
              <Moon className="h-5 w-5" />
            )}
            <span className="sr-only">Cambiar tema</span>
          </Button>
          <UserMenu />
        </div>
      </div>
    </nav>
  );
};

export default Navbar;