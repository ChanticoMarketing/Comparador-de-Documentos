import React, { useState } from "react";
import { Sidebar } from "./sidebar";
import { MobileMenu } from "./mobile-menu";
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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-gray-900 text-gray-200">
      {/* Sidebar for desktop */}
      <Sidebar className="hidden md:flex md:flex-col md:w-64" />
      
      {/* Mobile menu button */}
      <div className="md:hidden absolute top-4 left-4 z-10">
        <Button 
          variant="ghost" 
          size="icon"
          className="text-gray-300 hover:text-white"
          onClick={() => setIsMobileMenuOpen(true)}
        >
          <Menu className="h-6 w-6" />
        </Button>
      </div>
      
      {/* Mobile menu */}
      <MobileMenu 
        isOpen={isMobileMenuOpen} 
        onClose={() => setIsMobileMenuOpen(false)} 
      />
      
      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <div className="py-6 px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-6 border-b border-gray-700">
            <div>
              <h1 className="text-2xl font-bold text-white">
                {title}
              </h1>
              {description && (
                <p className="mt-1 text-sm text-gray-400">
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
          
          {/* Page content */}
          {children}
        </div>
      </main>
    </div>
  );
}
