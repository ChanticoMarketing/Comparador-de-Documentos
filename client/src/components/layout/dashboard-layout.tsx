import React, { useState } from "react";
import { Sidebar } from "./sidebar";
import { Button } from "@/components/ui/button";
import { Menu } from "lucide-react";

interface DashboardLayoutProps {
  children: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function DashboardLayout({ 
  children, 
  title, 
  description, 
  action
}: DashboardLayoutProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <Sidebar isOpen={isSidebarOpen} onToggle={toggleSidebar} />
      
      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile header */}
        <header className="flex h-16 items-center justify-between border-b bg-background px-4 lg:hidden">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleSidebar}
          >
            <Menu className="h-5 w-5" />
          </Button>
          <h1 className="font-semibold">OCR Intelligence</h1>
          <div></div>
        </header>

        {/* Page content */}
        <main className="flex-1 flex flex-col overflow-hidden">
          <div className="py-6 px-4 sm:px-6 lg:px-8 flex flex-col flex-1 min-h-0">
            {/* Header - fijo, no debe scrollear */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-6 border-b">
              <div>
                <h1 className="text-2xl font-bold">
                  {title}
                </h1>
                {description && (
                  <p className="mt-1 text-sm text-muted-foreground">
                    {description}
                  </p>
                )}
              </div>
              {action && (
                <div className="mt-4 sm:mt-0">
                  {action}
                </div>
              )}
            </div>
            
            {/* Contenedor scrolleable para el contenido de la página */}
            <div className="flex-1 min-h-0 overflow-y-auto mt-6">
              {/* Contenedor para los resultados */}
              <div id="results-section">
                {children}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
