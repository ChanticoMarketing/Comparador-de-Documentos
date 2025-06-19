import React, { useEffect } from "react";
import { useRoute } from "wouter";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { useQuery, UseQueryOptions } from "@tanstack/react-query";
import { ComparisonResult } from "@/types";
import { ResultsSection } from "@/components/dashboard/results-section";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";

export default function ComparisonDetail() {
  // Obtener el ID de la comparación de la URL
  const [, params] = useRoute<{ id: string }>("/comparison/:id");
  const comparisonId = params?.id;

  // Configuración para la consulta
  const queryOptions: UseQueryOptions<ComparisonResult, Error, ComparisonResult> = {
    queryKey: [`/api/comparisons/${comparisonId}`],
    retry: 2, // Aumentamos a dos intentos si falla
    refetchOnWindowFocus: false, // No es necesario refrescar cuando la ventana recupera el foco
    enabled: !!comparisonId // Solo ejecutar la consulta si tenemos un ID válido
  };

  // Consultar los detalles de la comparación con manejo mejorado de errores
  const { data: comparison, isLoading, error } = useQuery<ComparisonResult, Error, ComparisonResult>(queryOptions);
  
  // Registrar errores para diagnóstico
  useEffect(() => {
    if (error) {
      console.error(`Error al cargar la comparación ${comparisonId}:`, error);
    }
  }, [error, comparisonId]);

  // Manejar estado de carga
  if (isLoading) {
    return (
      <DashboardLayout 
        title="Detalles de Comparación" 
        description="Cargando detalles..."
        action={
          <Link href="/history">
            <Button variant="outline" className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              Volver al historial
            </Button>
          </Link>
        }
      >
        <div className="flex justify-center items-center h-48">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
        </div>
      </DashboardLayout>
    );
  }

  // Manejar errores
  if (error || !comparison) {
    return (
      <DashboardLayout 
        title="Error" 
        description="No se pudieron cargar los detalles de la comparación"
        action={
          <Link href="/history">
            <Button variant="outline" className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              Volver al historial
            </Button>
          </Link>
        }
      >
        <div className="bg-red-900 bg-opacity-20 border border-red-800 rounded-lg p-6 mt-6">
          <h3 className="text-lg font-medium text-red-300 mb-2">Error al cargar la comparación</h3>
          <p className="text-red-200 mb-4">
            {error instanceof Error 
              ? error.message 
              : "No se pudo encontrar la comparación solicitada o no tienes permiso para acceder a ella."}
          </p>
          <Link href="/history">
            <Button variant="outline" className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              Volver al historial
            </Button>
          </Link>
        </div>
      </DashboardLayout>
    );
  }

  // Mostrar los resultados de la comparación
  return (
    <DashboardLayout 
      title={`Comparación #${comparisonId}`}
      description={`${comparison.invoiceFilename} vs ${comparison.deliveryOrderFilename}`}
      action={
        <div className="flex gap-2">
          <Link href="/history">
            <Button variant="outline" className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              Volver al historial
            </Button>
          </Link>

          <Button 
            variant="outline" 
            className="bg-blue-700 hover:bg-blue-800 border-blue-900 text-white"
            onClick={() => window.open(`/api/comparisons/${comparisonId}/export?format=pdf`, '_blank')}
          >
            <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Exportar PDF
          </Button>

          <Button
            variant="outline"
            className="bg-green-700 hover:bg-green-800 border-green-900 text-white"
            onClick={() => window.open(`/api/comparisons/${comparisonId}/export?format=excel`, '_blank')}
          >
            <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Exportar Excel
          </Button>
        </div>
      }
    >
      {/* Información del documento */}
      <div className="bg-gray-800 rounded-lg mb-6 p-6 border border-gray-700">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="text-lg font-medium text-white mb-4">Información de la Factura</h3>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-400">Nombre del archivo</p>
                <p className="text-white">{comparison.invoiceFilename}</p>
              </div>
              <div>
                <p className="text-sm text-gray-400">Fecha de procesamiento</p>
                <p className="text-white">{new Date(comparison.createdAt).toLocaleString('es-ES')}</p>
              </div>
            </div>
          </div>
          <div>
            <h3 className="text-lg font-medium text-white mb-4">Información de la Orden de Entrega</h3>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-400">Nombre del archivo</p>
                <p className="text-white">{comparison.deliveryOrderFilename}</p>
              </div>
              <div>
                <p className="text-sm text-gray-400">Estado</p>
                <div className="flex items-center space-x-2">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-900 text-green-300">
                    {comparison.matchCount} ✓
                  </span>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-900 text-yellow-300">
                    {comparison.warningCount} ⚠️
                  </span>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-900 text-red-300">
                    {comparison.errorCount} ✗
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Usar el componente ResultsSection existente con el ID de la comparación */}
      <ResultsSection comparisonId={comparisonId} />
    </DashboardLayout>
  );
}