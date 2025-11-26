import React, { useState } from "react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { FileUploadSection } from "@/components/dashboard/file-upload-section";
import { ProcessingSection } from "@/components/dashboard/processing-section";
import { ResultsSection } from "@/components/dashboard/results-section";
import { RecentSessionsSection } from "@/components/dashboard/recent-sessions-section";
import { DebugPanel } from "@/components/debug/DebugPanel";
import { Button } from "@/components/ui/button";

export default function Dashboard() {
  const [showNewComparisonForm, setShowNewComparisonForm] = useState(false);

  const toggleNewComparison = () => {
    setShowNewComparisonForm(!showNewComparisonForm);
  };

  return (
    <DashboardLayout
      title="Dashboard"
      description="Compara facturas y órdenes de entrega con OCR + GPT-4.1"
      action={
        <Button
          onClick={toggleNewComparison}
          className="bg-primary-600 hover:bg-primary-700 text-white"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4 mr-2"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          {showNewComparisonForm ? "Cancelar" : "Nueva comparación"}
        </Button>
      }
    >
      {showNewComparisonForm && <FileUploadSection />}
      <ProcessingSection />
      <ResultsSection />
      <RecentSessionsSection />
      
      {/* Debug panel for development debugging */}
      {process.env.NODE_ENV === 'development' && <DebugPanel />}
    </DashboardLayout>
  );
}
