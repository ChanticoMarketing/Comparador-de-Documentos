import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Accordion, 
  AccordionContent, 
  AccordionItem, 
  AccordionTrigger 
} from "@/components/ui/accordion";
import { useQuery, useMutation, UseQueryOptions } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ComparisonResult, ResultItem, MetadataItem, ResultTab } from "@/types";

interface ResultsSectionProps {
  comparisonId?: string;
}

type ComparisonWithSession = ComparisonResult & {
  sessionInfo?: {
    id: number;
    name: string;
    createdAt: string;
    status: string;
  };
};

export function ResultsSection({ comparisonId }: ResultsSectionProps) {
  const [activeTab, setActiveTab] = useState<ResultTab>("products");
  const [currentBlockIndex, setCurrentBlockIndex] = useState(0);
  const { toast } = useToast();

  // Query para una comparación específica
  const singleComparisonQuery = useQuery<ComparisonResult, Error, ComparisonResult>({
    queryKey: [`/api/comparisons/${comparisonId}`],
    enabled: !!comparisonId,
    refetchOnWindowFocus: true,
    staleTime: 2000,
  });

  // Query para múltiples comparaciones recientes
  const multipleComparisonsQuery = useQuery<ComparisonWithSession[], Error, ComparisonWithSession[]>({
    queryKey: ["/api/comparisons/recent"],
    enabled: !comparisonId,
    refetchOnWindowFocus: true,
    staleTime: 2000,
    refetchInterval: 5000,
  });

  // Determinar qué datos usar
  const allComparisons = comparisonId ? (singleComparisonQuery.data ? [singleComparisonQuery.data] : []) : multipleComparisonsQuery.data || [];
  const data = comparisonId ? singleComparisonQuery.data : allComparisons[currentBlockIndex];
  const isLoading = comparisonId ? singleComparisonQuery.isLoading : multipleComparisonsQuery.isLoading;
  const error = comparisonId ? singleComparisonQuery.error : multipleComparisonsQuery.error;
  
  // Funciones de navegación entre bloques
  const goToNextBlock = () => {
    if (currentBlockIndex < allComparisons.length - 1) {
      setCurrentBlockIndex(currentBlockIndex + 1);
    }
  };
  
  const goToPrevBlock = () => {
    if (currentBlockIndex > 0) {
      setCurrentBlockIndex(currentBlockIndex - 1);
    }
  };
  
  const goToBlock = (index: number) => {
    if (index >= 0 && index < allComparisons.length) {
      setCurrentBlockIndex(index);
    }
  };
  
  // Enhanced debugging and error tracking
  useEffect(() => {
    const debugInfo = {
      comparisonId,
      isLoading,
      error: error?.message,
      allComparisons: allComparisons.length,
      currentData: data?.id,
      currentBlockIndex,
      time: new Date().toISOString(),
      // Additional debugging info
      queryStatus: {
        single: comparisonId ? {
          isLoading: singleComparisonQuery.isLoading,
          isError: singleComparisonQuery.isError,
          error: singleComparisonQuery.error?.message,
          dataExists: !!singleComparisonQuery.data,
        } : null,
        multiple: !comparisonId ? {
          isLoading: multipleComparisonsQuery.isLoading,
          isError: multipleComparisonsQuery.isError,
          error: multipleComparisonsQuery.error?.message,
          dataCount: multipleComparisonsQuery.data?.length || 0,
        } : null
      },
      networkStatus: navigator.onLine ? 'online' : 'offline'
    };
    
    console.log("DIAGNÓSTICO: ResultsSection - datos actualizados:", debugInfo);
    
    // Log errors in detail
    if (error) {
      console.error("=== RESULTS SECTION ERROR ===");
      console.error("Error:", error);
      console.error("Error message:", error.message);
      console.error("Error stack:", error.stack);
      console.error("Query state:", debugInfo.queryStatus);
      console.error("=============================");
    }
  }, [data, allComparisons, currentBlockIndex, isLoading, error, singleComparisonQuery, multipleComparisonsQuery, comparisonId]);

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
        throw new Error(`Error ${response.status}: ${errorText}`);
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Resultados guardados",
        description: "Los resultados de la comparación se han guardado correctamente.",
      });
    },
    onError: (error) => {
      console.error("Error saving results:", error);
      toast({
        title: "Error al guardar",
        description: "No se pudieron guardar los resultados. Inténtalo de nuevo.",
        variant: "destructive",
      });
    },
  });

  const exportMutation = useMutation({
    mutationFn: async (format: "pdf" | "excel") => {
      if (!data) throw new Error("No hay datos para exportar");
      
      const response = await fetch(`/api/comparisons/${data.id}/export?format=${format}`, {
        method: 'GET',
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error(`Error al exportar ${format}: ${response.statusText}`);
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `comparacion-${data.id}.${format === 'pdf' ? 'pdf' : 'xlsx'}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    },
    onError: (error) => {
      toast({
        title: "Error al exportar",
        description: error.message,
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
  
  // Show error state with retry option instead of hiding the section
  if (error && !data) {
    return (
      <Card className="mt-6 bg-gray-800 border-gray-700">
        <CardHeader className="border-b border-gray-700">
          <CardTitle className="text-lg font-medium text-red-400">
            Error de conexión
          </CardTitle>
          <CardDescription className="text-gray-400">
            No se pudieron cargar los resultados de la comparación
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          <div className="bg-red-900/20 border border-red-900/30 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <svg className="h-5 w-5 text-red-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="flex-1">
                <h3 className="text-sm font-medium text-red-200 mb-2">
                  Problema de conexión detectado
                </h3>
                <p className="text-sm text-red-300 mb-3">
                  {error.message.includes('502') 
                    ? 'El servidor está temporalmente no disponible. Esto puede deberse a un reinicio del sistema o problemas de conectividad.'
                    : `Error: ${error.message}`
                  }
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (comparisonId) {
                        singleComparisonQuery.refetch();
                      } else {
                        multipleComparisonsQuery.refetch();
                      }
                    }}
                    className="bg-red-800 hover:bg-red-700 border-red-700 text-white"
                  >
                    Reintentar
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.location.reload()}
                    className="bg-gray-700 hover:bg-gray-600 border-gray-600 text-white"
                  >
                    Recargar página
                  </Button>
                </div>
              </div>
            </div>
          </div>
          
          <div className="mt-4 text-xs text-gray-500">
            <p>Consejos para resolver el problema:</p>
            <ul className="list-disc list-inside mt-1 space-y-1">
              <li>Verifica tu conexión a internet</li>
              <li>El servidor puede estar reiniciándose, intenta en unos momentos</li>
              <li>Si el problema persiste, contacta al administrador</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Don't show section if no data but no error (just loading finished)
  if (!data) {
    return null;
  }

  // Function to get status class for highlighting differences
  const getHighlightClass = (status: string) => {
    switch (status) {
      case "match":
        return "text-green-300";
      case "warning":
        return "text-yellow-300";
      case "error":
        return "text-red-300";
      default:
        return "";
    }
  };

  // Function to render status badge
  const renderStatusBadge = (status: string) => {
    switch (status) {
      case "match":
        return (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-900 text-green-300">
            Coincidente
          </span>
        );
      case "warning":
        return (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-900 text-yellow-300">
            Advertencia
          </span>
        );
      case "error":
        return (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-900 text-red-300">
            Discrepancia
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-900 text-gray-300">
            Desconocido
          </span>
        );
    }
  };

  // Parse results data
  let items: ResultItem[] = [];
  let metadata: MetadataItem[] = [];
  
  // Parse items from rawData
  if (data.rawData) {
    try {
      const parsedData = typeof data.rawData === 'string' ? JSON.parse(data.rawData) : data.rawData;
      if (parsedData.items && Array.isArray(parsedData.items)) {
        items = parsedData.items;
      }
      if (parsedData.metadata && Array.isArray(parsedData.metadata)) {
        metadata = parsedData.metadata;
      }
    } catch (e) {
      console.error('Error parsing rawData items:', e);
    }
  }

  // Calculate summary
  const summary = {
    matches: items.filter(item => item.status === "match").length,
    warnings: items.filter(item => item.status === "warning").length,
    errors: items.filter(item => item.status === "error").length,
  };

  // Group items by product name
  const groupedItems = items.reduce((acc: Record<string, any[]>, item: any) => {
    const productName = item.productName || "Producto sin nombre";
    if (!acc[productName]) {
      acc[productName] = [];
    }
    acc[productName].push(item);
    return acc;
  }, {});

  return (
    <Card id="results-section" className="mt-6 bg-gray-800 border-gray-700">
      <CardHeader className="border-b border-gray-700">
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-lg font-medium text-white">
              Resultados de la comparación
              {!comparisonId && allComparisons.length > 1 && (
                <span className="ml-2 text-sm font-normal text-blue-400">
                  Bloque {currentBlockIndex + 1} de {allComparisons.length}
                </span>
              )}
            </CardTitle>
            <CardDescription className="text-gray-400">
              {data.invoiceFilename ? `${data.invoiceFilename} vs ${data.deliveryOrderFilename}` : "Última comparación"}
            </CardDescription>
          </div>
          
          {/* Navegación entre bloques */}
          {!comparisonId && allComparisons.length > 1 && (
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={goToPrevBlock}
                  disabled={currentBlockIndex === 0}
                  className="h-8 w-8 p-0"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </Button>
                
                {/* Indicadores de página */}
                <div className="flex space-x-1">
                  {allComparisons.map((_, index) => (
                    <button
                      key={index}
                      onClick={() => goToBlock(index)}
                      className={`w-8 h-8 rounded text-xs font-medium transition-colors ${
                        index === currentBlockIndex
                          ? "bg-primary-600 text-white"
                          : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                      }`}
                    >
                      {index + 1}
                    </button>
                  ))}
                </div>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={goToNextBlock}
                  disabled={currentBlockIndex === allComparisons.length - 1}
                  className="h-8 w-8 p-0"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Button>
              </div>
              
              <div className="flex space-x-2">
                <Button
                  variant="outline"
                  className="bg-blue-700 hover:bg-blue-800 border-blue-900 text-white text-xs"
                  onClick={() => window.open(`/api/comparisons/${data.id}/export?format=pdf`, '_blank')}
                  disabled={!data?.id}
                  size="sm"
                >
                  <svg className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  PDF
                </Button>
                <Button
                  variant="outline"
                  className="bg-green-700 hover:bg-green-800 border-green-900 text-white text-xs"
                  onClick={() => window.open(`/api/comparisons/${data.id}/export?format=excel`, '_blank')}
                  disabled={!data?.id}
                  size="sm"
                >
                  <svg className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Excel
                </Button>
              </div>
            </div>
          )}
          
          {/* Botones de exportación para vista de comparación única */}
          {comparisonId && (
            <div className="flex space-x-2">
              <Button
                variant="outline"
                className="bg-blue-700 hover:bg-blue-800 border-blue-900 text-white text-xs"
                onClick={() => window.open(`/api/comparisons/${data.id}/export?format=pdf`, '_blank')}
                disabled={!data.id}
                size="sm"
              >
                <svg className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                PDF
              </Button>
              <Button
                variant="outline"
                className="bg-green-700 hover:bg-green-800 border-green-900 text-white text-xs"
                onClick={() => window.open(`/api/comparisons/${data.id}/export?format=excel`, '_blank')}
                disabled={!data.id}
                size="sm"
              >
                <svg className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Excel
              </Button>
            </div>
          )}
        </div>
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
            <Accordion type="single" collapsible className="w-full space-y-3">
              {Object.entries(groupedItems).map(([productName, productItems], groupIndex) => {
                // Determinar el estado global del grupo
                const groupStatus = productItems.some(item => item.status === "error") 
                  ? "error" 
                  : productItems.some(item => item.status === "warning") 
                    ? "warning" 
                    : "match";
                
                return (
                  <AccordionItem 
                    key={groupIndex} 
                    value={`item-${groupIndex}`}
                    className={`border border-gray-700 rounded-md overflow-hidden ${
                      groupStatus === "error" 
                        ? "bg-red-900/10 border-red-900/30" 
                        : groupStatus === "warning" 
                          ? "bg-yellow-900/10 border-yellow-900/30" 
                          : "bg-green-900/10 border-green-900/30"
                    }`}
                  >
                    <AccordionTrigger className="px-4 py-3 hover:no-underline">
                      <div className="flex items-center justify-between w-full">
                        <span className="font-medium text-white">{productName}</span>
                        <div className="flex items-center space-x-3">
                          {renderStatusBadge(groupStatus)}
                          <span className="text-sm text-gray-400">
                            ({productItems.length} variante{productItems.length !== 1 ? 's' : ''})
                          </span>
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="px-4 pb-4 overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-700">
                          <thead className="bg-gray-800/60">
                            <tr>
                              <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                                Factura
                              </th>
                              <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                                Orden Entrega
                              </th>
                              <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                                Estado
                              </th>
                              <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                                Nota
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-700/50">
                            {productItems.map((item: any, index: number) => (
                              <tr key={index} className={`${getHighlightClass(item.status)}`}>
                                <td className="px-4 py-3 text-sm text-gray-300">
                                  <span className="font-medium">
                                    {item.invoiceValue}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-300">
                                  <span className="font-medium">
                                    {item.deliveryOrderValue}
                                  </span>
                                </td>
                                <td className="px-4 py-3">
                                  {renderStatusBadge(item.status)}
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-300">
                                  {item.note || "-"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
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