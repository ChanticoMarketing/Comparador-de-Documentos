import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ProcessingStatus, FileStatus } from "@/types";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

// Componente para mostrar el nombre descriptivo del bloque
function BlockNameDisplay({ blockId }: { blockId: string }) {
  const { data: blockData } = useQuery<ProcessingStatus>({
    queryKey: [`/api/processing/status`, { blockId }],
    refetchInterval: 2000,
  });

  const displayName = blockData?.blockName || `Bloque ${blockId.slice(-6)}`;
  
  // Mostrar solo el nombre del archivo sin la extensión para que sea más limpio
  const cleanName = displayName.includes('.') 
    ? displayName.substring(0, displayName.lastIndexOf('.'))
    : displayName;
  
  // Limitar la longitud para que quepa en la pestaña
  const shortName = cleanName.length > 15 
    ? cleanName.substring(0, 15) + "..."
    : cleanName;
  
  return <span title={displayName}>{shortName}</span>;
}

// Componente para mostrar un único bloque de procesamiento
function ProcessingBlock({ blockId }: { blockId?: string }) {
  const { toast } = useToast();
  const queryKey = blockId 
    ? [`/api/processing/status`, { blockId }] 
    : ["/api/processing/status"];

  // Usamos una consulta tipada correctamente
  const { data: processingData, isLoading } = useQuery<ProcessingStatus>({
    queryKey,
    // Actualizar cada 2 segundos siempre para asegurar que tenemos datos actualizados
    refetchInterval: 2000,
  });

  const cancelMutation = useMutation({
    mutationFn: async () => {
      const url = blockId 
        ? `/api/processing/cancel?blockId=${blockId}` 
        : "/api/processing/cancel";
        
      const response = await fetch(url, {
        method: "POST",
        credentials: "include",
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Error al cancelar el proceso");
      }
      
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Proceso cancelado",
        description: blockId 
          ? `El procesamiento del bloque ${blockId} se ha cancelado correctamente`
          : "El procesamiento de los documentos ha sido cancelado",
      });
      queryClient.invalidateQueries({ queryKey });
    },
    onError: (error: unknown) => {
      const errorMessage = error instanceof Error ? error.message : "Error desconocido";
      toast({
        title: "Error al cancelar el proceso",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  // IMPORTANTE: Todos los hooks deben llamarse incondicionalmente en el nivel superior
  // antes de cualquier return o condicional
  
  // Efecto para detectar la finalización del procesamiento y actualizar resultados automáticamente
  // colocado AQUÍ para cumplir con las reglas de Hooks de React
  useEffect(() => {
    // Solo ejecutar la lógica interna del efecto si tenemos datos
    if (processingData) {
      console.log("DIAGNÓSTICO: Estado de procesamiento actual:", {
        ocrProgress: processingData.ocrProgress,
        aiProgress: processingData.aiProgress,
        isProcessing: processingData.isProcessing,
        blockId: blockId,
        tiempo: new Date().toISOString()
      });
      
      // Si procesamiento completo, actualizar resultados automáticamente
      if (processingData.ocrProgress === 100 && processingData.aiProgress === 100) {
        console.log("DIAGNÓSTICO: ✅ PROCESO COMPLETADO DETECTADO EN FRONTEND. Invalidando queries...");
        
        // Pequeño delay para asegurar que el backend haya terminado de guardar
        // Aumentado de 800ms a 1500ms para dar más tiempo al backend
        const timer = setTimeout(() => {
          console.log("DIAGNÓSTICO: 🔄 Ejecutando invalidación de cache para forzar recarga de resultados");
          
          // Invalidar caches explícitamente para forzar refresh completo
          queryClient.invalidateQueries({ queryKey: ['/api/comparisons/latest'] });
          
          // Si ya no está procesando, también actualizar estado general
          if (!processingData.isProcessing) {
            queryClient.invalidateQueries({ queryKey: ['/api/processing/status'] });
          }
          
          // Scroll a la sección de resultados para mostrarlos automáticamente
          setTimeout(() => {
            const resultsSection = document.getElementById('results-section');
            if (resultsSection) {
              console.log("DIAGNÓSTICO: Scrolling a sección de resultados automáticamente");
              resultsSection.scrollIntoView({ behavior: 'smooth' });
            } else {
              console.log("DIAGNÓSTICO: No se encontró la sección de resultados para hacer scroll");
            }
          }, 500); // Dar tiempo adicional para que se renderice la sección de resultados
          
        }, 1500);
        
        return () => clearTimeout(timer);
      }
    }
    // No hacer nada si no hay datos
    return undefined;
  }, [processingData, queryClient, queryKey]); // Dependencias simplificadas y correctas
  
  const handleCancelProcess = () => {
    cancelMutation.mutate();
  };

  // Si no hay datos o están cargando, mostrar un estado de carga
  if (isLoading || !processingData) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-5 bg-gray-700 rounded w-1/3"></div>
        <div className="h-4 bg-gray-700 rounded w-full"></div>
        <div className="h-4 bg-gray-700 rounded w-full"></div>
      </div>
    );
  }
  
  // Si no hay archivos o procesamiento en curso, no mostrar esta sección
  if (!processingData.isProcessing && (!processingData.files || processingData.files.length === 0)) {
    return (
      <div className="text-center py-8 text-gray-400">
        <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-12 w-12 mb-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="22 12 16 12 14 15 10 15 8 12 2 12"></polyline>
          <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"></path>
        </svg>
        <h3 className="text-lg font-medium text-gray-200 mb-2">No hay procesamiento activo</h3>
        <p>No hay ningún proceso de comparación en ejecución en este momento.</p>
      </div>
    );
  }
  
  // Si el procesamiento ha finalizado, mostrar un mensaje y un botón para ver los resultados
  if (processingData.ocrProgress === 100 && processingData.aiProgress === 100) {
    return (
      <Card className="border-green-500 border-2 mb-8">
        <CardContent className="pt-6">
          <div className="text-center py-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-12 w-12 mb-4 text-green-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            <h3 className="text-xl font-medium mb-2">¡Procesamiento completado!</h3>
            <p className="mb-4">La comparación de documentos ha finalizado correctamente.</p>
            <Button 
              onClick={() => {
                // Forzar actualización de resultados
                queryClient.invalidateQueries({ queryKey: ['/api/comparisons/latest'] });
                // Hacer scroll a la sección de resultados
                document.getElementById('results-section')?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              Ver resultados
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {blockId && (
        <div className="mb-4">
          <Badge variant="outline" className="bg-gray-700 text-white border-gray-600">
            Bloque: {blockId}
          </Badge>
        </div>
      )}
      
      {/* Processing Status Indicators */}
      <div className="space-y-4">
        {/* OCR Status */}
        <div className="bg-gray-700 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-white">Extracción de datos OCR</span>
            <div className="flex items-center">
              {processingData.isProcessing ? (
                <>
                  <div className="mr-2 h-2 w-2 rounded-full bg-amber-400 animate-pulse"></div>
                  <span className="text-amber-300 text-sm">Procesando</span>
                </>
              ) : (
                <>
                  <div className="mr-2 h-2 w-2 rounded-full bg-green-400"></div>
                  <span className="text-green-300 text-sm">Completado</span>
                </>
              )}
            </div>
          </div>
          {processingData.currentOcrFile && (
            <div className="mt-2 text-xs text-gray-400">
              Archivo actual: {processingData.currentOcrFile}
            </div>
          )}
        </div>

        {/* AI Analysis Status */}
        <div className="bg-gray-700 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-white">Análisis Comparativo IA</span>
            <div className="flex items-center">
              {processingData.isProcessing ? (
                <>
                  <div className="mr-2 h-2 w-2 rounded-full bg-blue-400 animate-pulse"></div>
                  <span className="text-blue-300 text-sm">Analizando</span>
                </>
              ) : (
                <>
                  <div className="mr-2 h-2 w-2 rounded-full bg-green-400"></div>
                  <span className="text-green-300 text-sm">Completado</span>
                </>
              )}
            </div>
          </div>
          {processingData.currentAiStage && (
            <div className="mt-2 text-xs text-gray-400">
              {processingData.currentAiStage}
            </div>
          )}
        </div>
      </div>
      
      {/* Files List */}
      {processingData.files && processingData.files.length > 0 && (
        <div className="mt-4">
          <h4 className="text-sm font-medium text-white mb-3">Archivos en procesamiento</h4>
          <div className="bg-gray-900 rounded-md overflow-hidden">
            <div className="divide-y divide-gray-700">
              {processingData.files.map((file, index) => (
                <div key={index} className="flex items-center px-4 py-3">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className={`h-5 w-5 mr-3 ${file.type === "invoice" ? "text-red-400" : "text-blue-400"}`}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">
                      {file.name}
                    </p>
                    <p className="text-xs text-gray-400">
                      {file.type === "invoice" ? "Factura" : "Orden de Entrega"} • {(file.size / 1024).toFixed(0)} KB
                    </p>
                  </div>
                  <div className="ml-4 flex-shrink-0">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        file.status === "completed"
                          ? "bg-green-900 text-green-300"
                          : file.status === "processing"
                          ? "bg-blue-900 text-blue-300"
                          : "bg-gray-700 text-gray-300"
                      }`}
                    >
                      {file.status === "completed"
                        ? "Completado"
                        : file.status === "processing"
                        ? "Procesando"
                        : "Pendiente"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      
      {/* Cancel Button */}
      <div className="mt-6 flex justify-end">
        <Button 
          variant="destructive" 
          onClick={handleCancelProcess}
          disabled={cancelMutation.isPending}
          className="bg-red-600 hover:bg-red-700 text-white"
        >
          {cancelMutation.isPending ? (
            <>
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Cancelando...
            </>
          ) : (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
              Cancelar proceso
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

// Componente principal que gestiona todos los bloques de procesamiento
export function ProcessingSection() {
  const [activeTab, setActiveTab] = useState<string>("main");
  const [blockTabs, setBlockTabs] = useState<string[]>([]);
  
  // Obtener estado global de procesamiento para detectar bloques activos
  const { data: globalStatus } = useQuery<ProcessingStatus>({
    queryKey: ["/api/processing/status"],
    refetchInterval: 2000,
  });

  // Actualizar las pestañas cuando cambie el estado global
  useEffect(() => {
    if (globalStatus?.blockIds && globalStatus.blockIds.length > 0) {
      setBlockTabs(globalStatus.blockIds);
      // Si no hay pestaña activa, seleccionar la primera
      if (activeTab === "main" && globalStatus.activeBlocksCount && globalStatus.activeBlocksCount > 0) {
        setActiveTab(globalStatus.blockIds[0]);
      }
    } else if (blockTabs.length > 0 && (!globalStatus?.blockIds || globalStatus.blockIds.length === 0)) {
      // Si no hay bloques activos pero teníamos pestañas, volver a la principal
      setBlockTabs([]);
      setActiveTab("main");
    }
  }, [globalStatus]);

  // Si no hay procesamiento activo y no hay bloques, no mostrar nada
  if (!globalStatus?.isProcessing && (!globalStatus?.blockIds || globalStatus.blockIds.length === 0)) {
    return null;
  }

  return (
    <Card className="mt-6 bg-gray-800 border-gray-700">
      <CardHeader className="border-b border-gray-700">
        <CardTitle className="text-lg font-medium text-white">
          Procesamiento en curso
          {globalStatus?.activeBlocksCount && globalStatus.activeBlocksCount > 0 && (
            <Badge className="ml-2 bg-primary-600">{globalStatus.activeBlocksCount} activo(s)</Badge>
          )}
        </CardTitle>
        <CardDescription className="text-gray-400">
          El sistema está procesando tus documentos
        </CardDescription>
      </CardHeader>
      
      <CardContent className="p-6">
        {blockTabs.length > 0 ? (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="mb-4 bg-gray-900">
              <TabsTrigger value="main" className="text-gray-300 data-[state=active]:bg-gray-700">
                Principal
              </TabsTrigger>
              {blockTabs.map(blockId => (
                <TabsTrigger 
                  key={blockId} 
                  value={blockId}
                  className="text-gray-300 data-[state=active]:bg-gray-700"
                >
                  <BlockNameDisplay blockId={blockId} />
                </TabsTrigger>
              ))}
            </TabsList>
            
            <TabsContent value="main">
              <ProcessingBlock />
            </TabsContent>
            
            {blockTabs.map(blockId => (
              <TabsContent key={blockId} value={blockId}>
                <ProcessingBlock blockId={blockId} />
              </TabsContent>
            ))}
          </Tabs>
        ) : (
          <ProcessingBlock />
        )}
      </CardContent>
    </Card>
  );
}
