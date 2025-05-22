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
    onError: (error: Error) => {
      toast({
        title: "Error al cancelar el proceso",
        description: error.message,
        variant: "destructive",
      });
    },
  });

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
  
  // Si el procesamiento ha terminado o no está activo, no mostrar nada
  if ((!processingData.isProcessing) || 
      (processingData.ocrProgress === 100 && processingData.aiProgress === 100) || 
      (!processingData.files || processingData.files.length === 0)) {
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

  return (
    <div className="space-y-6">
      {blockId && (
        <div className="mb-4">
          <Badge variant="outline" className="bg-gray-700 text-white border-gray-600">
            Bloque: {blockId}
          </Badge>
        </div>
      )}
      
      {/* OCR Progress */}
      <div>
        <div className="flex justify-between mb-2">
          <span className="text-sm font-medium text-white">Extracción de datos</span>
          <span className="text-sm font-medium text-white">{processingData.ocrProgress}%</span>
        </div>
        <Progress value={processingData.ocrProgress} variant="default" className="bg-gray-700" />
        <div className="mt-2 text-xs text-gray-400">
          {processingData.currentOcrFile ? `Procesando: ${processingData.currentOcrFile}` : "Esperando..."}
        </div>
      </div>
      
      {/* AI Analysis Progress */}
      <div>
        <div className="flex justify-between mb-2">
          <span className="text-sm font-medium text-white">Análisis Comparativo</span>
          <span className="text-sm font-medium text-white">{processingData.aiProgress}%</span>
        </div>
        <Progress value={processingData.aiProgress} variant="default" className="bg-gray-700" />
        <div className="mt-2 text-xs text-gray-400">
          {processingData.aiProgress > 0 
            ? "Comparando elementos y detectando discrepancias" 
            : "Esperando a que finalice el OCR..."}
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
                  Bloque {blockId.substring(blockId.lastIndexOf('-') + 1, blockId.length).slice(0, 6)}
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
