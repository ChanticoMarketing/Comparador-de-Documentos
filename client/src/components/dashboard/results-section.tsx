import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery, useMutation, UseQueryOptions } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ComparisonResult, ResultItem, MetadataItem, ResultTab } from "@/types";

interface ResultsSectionProps {
  comparisonId?: string;
}

export function ResultsSection({ comparisonId }: ResultsSectionProps) {
  const [activeTab, setActiveTab] = useState<ResultTab>("products");
  const { toast } = useToast();

  // Opciones de consulta mejoradas para React Query
  const queryOptions: UseQueryOptions<ComparisonResult, Error, ComparisonResult> = {
    queryKey: comparisonId 
      ? [`/api/comparisons/${comparisonId}`]
      : ["/api/comparisons/latest"],
    enabled: true, // Siempre activado para detectar automáticamente nuevos resultados
    refetchOnWindowFocus: true, // Actualizar cuando la ventana recupere el foco
    staleTime: 5000, // Consideramos datos "frescos" por 5 segundos (reducido de Infinity por defecto)
    refetchInterval: 10000, // Refrescar cada 10s para asegurar datos actualizados
  };
  
  // Consulta con opciones tipadas correctamente
  const { data, isLoading, error, isSuccess, isFetching } = useQuery<ComparisonResult, Error, ComparisonResult>(queryOptions);
  
  // Efecto para detectar y registrar actualizaciones de datos
  useEffect(() => {
    if (data) {
      console.log("DIAGNÓSTICO: ResultsSection recibió datos actualizados:", { 
        id: data.id,
        time: new Date().toISOString()
      });
    }
  }, [data]);

  const saveResultsMutation = useMutation({
    mutationFn: async () => {
      if (!data) return null;
      
      const response = await fetch("/api/comparisons/save", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ comparisonId: data.id }),
        credentials: "include",
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Error al guardar los resultados");
      }
      
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Resultados guardados",
        description: "Los resultados de la comparación han sido guardados exitosamente",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/comparisons"] });
    },
    onError: (error: unknown) => {
      const errorMessage = error instanceof Error ? error.message : "Error desconocido";
      toast({
        title: "Error al guardar los resultados",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const exportMutation = useMutation({
    mutationFn: async (format: "pdf" | "excel") => {
      if (!data) return null;
      
      const response = await fetch(`/api/comparisons/${data.id}/export?format=${format}`, {
        method: "GET",
        credentials: "include",
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || `Error al exportar a ${format.toUpperCase()}`);
      }
      
      // Handle file download
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = `comparison-${data.id}.${format === "pdf" ? "pdf" : "xlsx"}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(downloadUrl);
      
      return true;
    },
    onError: (error: unknown) => {
      const errorMessage = error instanceof Error ? error.message : "Error desconocido";
      toast({
        title: "Error al exportar",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const handleExportPDF = () => {
    exportMutation.mutate("pdf");
  };

  const handleExportExcel = () => {
    exportMutation.mutate("excel");
  };

  const handleSaveResults = () => {
    saveResultsMutation.mutate();
  };

  // If there's no result data, don't show this section
  if (isLoading) {
    return (
      <Card className="mt-6 bg-gray-800 border-gray-700">
        <CardHeader className="border-b border-gray-700">
          <CardTitle className="text-lg font-medium text-white">
            Cargando resultados...
          </CardTitle>
          <CardDescription className="text-gray-400">
            Obteniendo detalles de la comparación
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6 flex justify-center">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
        </CardContent>
      </Card>
    );
  }
  
  if (error || !data) {
    return (
      <Card className="mt-6 bg-gray-800 border-gray-700">
        <CardHeader className="border-b border-gray-700">
          <CardTitle className="text-lg font-medium text-white">
            Error al cargar resultados
          </CardTitle>
          <CardDescription className="text-gray-400">
            No se pudieron obtener los detalles de la comparación
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          <div className="bg-red-900 bg-opacity-20 border border-red-800 rounded-lg p-6">
            <h3 className="text-lg font-medium text-red-300 mb-2">Error</h3>
            <p className="text-red-200">
              {error instanceof Error ? error.message : "Error desconocido al cargar los resultados de comparación."}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Function to get status class for highlighting differences
  const getHighlightClass = (status: string) => {
    switch (status) {
      case "warning":
        return "bg-yellow-900 bg-opacity-30";
      case "error":
        return "bg-red-900 bg-opacity-30";
      default:
        return "";
    }
  };

  // Function to render status badge
  const renderStatusBadge = (status: string) => {
    switch (status) {
      case "match":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-900 text-green-300">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            Coincidente
          </span>
        );
      case "warning":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-900 text-yellow-300">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
              <line x1="12" y1="9" x2="12" y2="13"></line>
              <line x1="12" y1="17" x2="12.01" y2="17"></line>
            </svg>
            Advertencia
          </span>
        );
      case "error":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-900 text-red-300">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
            Discrepancia
          </span>
        );
      default:
        return null;
    }
  };

  // Preparar los datos para visualización
  // Asegurarnos de que tenemos ítems y metadata aunque vengan en formato diferente
  const items = data.items || [];
  
  // Preparar el resumen
  let summary = data.summary;
  
  // Si no hay summary pero tenemos datos en matchCount, warningCount y errorCount, crear un resumen
  if (!summary && data.matchCount !== undefined) {
    summary = {
      matches: data.matchCount,
      warnings: data.warningCount,
      errors: data.errorCount
    };
  }
  
  // Si aún no hay summary, intentar extraerlo del rawData
  if (!summary && data.rawData) {
    try {
      const rawData = typeof data.rawData === 'string' 
        ? JSON.parse(data.rawData) 
        : data.rawData;
        
      if (rawData.summary) {
        summary = rawData.summary;
      }
    } catch (e) {
      console.error('Error parsing rawData summary:', e);
    }
  }
  
  // Si todavía no hay summary, crear uno por defecto
  if (!summary) {
    summary = {
      matches: 0,
      warnings: 0,
      errors: 0
    };
  }
  
  // Si los datos vienen del raw_data, intentar extraer metadata
  let metadata = data.metadata || [];
  if (metadata.length === 0 && data.rawData && typeof data.rawData === 'object') {
    // Intentar extraer metadata del rawData si está disponible
    try {
      const rawData = typeof data.rawData === 'string' 
        ? JSON.parse(data.rawData) 
        : data.rawData;
        
      if (rawData.metadata) {
        metadata = rawData.metadata;
      }
    } catch (e) {
      console.error('Error parsing rawData:', e);
    }
  }

  // Si no hay items pero hay rawData, intentar extraerlos de ahí
  if (items.length === 0 && data.rawData) {
    try {
      const rawData = typeof data.rawData === 'string' 
        ? JSON.parse(data.rawData) 
        : data.rawData;
        
      if (rawData.items) {
        items.push(...rawData.items);
      }
    } catch (e) {
      console.error('Error parsing rawData items:', e);
    }
  }

  return (
    <Card id="results-section" className="mt-6 bg-gray-800 border-gray-700">
      <CardHeader className="border-b border-gray-700">
        <CardTitle className="text-lg font-medium text-white">
          Resultados de la comparación
        </CardTitle>
        <CardDescription className="text-gray-400">
          {data.invoiceFilename ? `${data.invoiceFilename} vs ${data.deliveryOrderFilename}` : "Última comparación"}
        </CardDescription>
      </CardHeader>
      
      <CardContent className="p-6">
        {/* Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-gray-700 rounded-lg p-4">
            <div className="flex items-center">
              <div className="flex-shrink-0 p-2 rounded-md bg-green-900">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-300">Coincidencias</p>
                <p className="text-xl font-semibold text-white">{summary.matches}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-gray-700 rounded-lg p-4">
            <div className="flex items-center">
              <div className="flex-shrink-0 p-2 rounded-md bg-yellow-900">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-yellow-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                  <line x1="12" y1="9" x2="12" y2="13"></line>
                  <line x1="12" y1="17" x2="12.01" y2="17"></line>
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-300">Advertencias</p>
                <p className="text-xl font-semibold text-white">{summary.warnings}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-gray-700 rounded-lg p-4">
            <div className="flex items-center">
              <div className="flex-shrink-0 p-2 rounded-md bg-red-900">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-300">Discrepancias</p>
                <p className="text-xl font-semibold text-white">{summary.errors}</p>
              </div>
            </div>
          </div>
        </div>
        
        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as ResultTab)}>
          <div className="border-b border-gray-700">
            <TabsList className="bg-transparent border-b-0">
              <TabsTrigger 
                value="products" 
                className={`border-b-2 rounded-none px-1 py-3 text-sm font-medium ${
                  activeTab === "products" 
                    ? "border-primary-500 text-primary-400" 
                    : "border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-500"
                }`}
              >
                Productos
              </TabsTrigger>
              <TabsTrigger 
                value="metadata" 
                className={`border-b-2 rounded-none px-1 py-3 text-sm font-medium ${
                  activeTab === "metadata" 
                    ? "border-primary-500 text-primary-400" 
                    : "border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-500"
                }`}
              >
                Metadatos
              </TabsTrigger>
              <TabsTrigger 
                value="json" 
                className={`border-b-2 rounded-none px-1 py-3 text-sm font-medium ${
                  activeTab === "json" 
                    ? "border-primary-500 text-primary-400" 
                    : "border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-500"
                }`}
              >
                JSON
              </TabsTrigger>
            </TabsList>
          </div>
          
          <TabsContent value="products" className="pt-6">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-700">
                <thead className="bg-gray-700">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                      Producto
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                      Factura
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                      Orden Entrega
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                      Estado
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                      Nota
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-gray-800 divide-y divide-gray-700">
                  {items.map((item: any, index: number) => (
                    <tr key={index}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">
                        {item.productName}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                        <span className={getHighlightClass(item.status)}>
                          {item.invoiceValue}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                        <span className={getHighlightClass(item.status)}>
                          {item.deliveryOrderValue}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {renderStatusBadge(item.status)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-300">
                        {item.note || "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TabsContent>
          
          <TabsContent value="metadata" className="pt-6">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-700">
                <thead className="bg-gray-700">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                      Campo
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                      Factura
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                      Orden Entrega
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                      Estado
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-gray-800 divide-y divide-gray-700">
                  {metadata.map((meta: any, index: number) => (
                    <tr key={index}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">
                        {meta.field}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                        <span className={getHighlightClass(meta.status)}>
                          {meta.invoiceValue || "-"}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                        <span className={getHighlightClass(meta.status)}>
                          {meta.deliveryOrderValue || "-"}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {renderStatusBadge(meta.status)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TabsContent>
          
          <TabsContent value="json" className="pt-6">
            <div className="bg-gray-900 rounded-lg p-4 overflow-auto max-h-96">
              <pre className="text-xs text-gray-300 font-mono">
                {JSON.stringify(data, null, 2)}
              </pre>
            </div>
          </TabsContent>
        </Tabs>
        
        {/* Action Buttons */}
        <div className="mt-6 flex justify-between">
          <div>
            <Button
              variant="outline"
              onClick={handleExportPDF}
              disabled={exportMutation.isPending}
              className="bg-gray-600 hover:bg-gray-700 text-white"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
              </svg>
              Exportar PDF
            </Button>
            <Button
              variant="outline"
              onClick={handleExportExcel}
              disabled={exportMutation.isPending}
              className="ml-3 bg-gray-600 hover:bg-gray-700 text-white"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
                <polyline points="10 9 9 9 8 9"></polyline>
              </svg>
              Exportar Excel
            </Button>
          </div>
          <div>
            <Button
              onClick={handleSaveResults}
              disabled={saveResultsMutation.isPending}
              className="bg-primary-600 hover:bg-primary-700 text-white"
            >
              {saveResultsMutation.isPending ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Guardando...
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                    <polyline points="17 21 17 13 7 13 7 21"></polyline>
                    <polyline points="7 3 7 8 15 8"></polyline>
                  </svg>
                  Guardar resultados
                </>
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
