import React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ProcessingStatus, FileStatus } from "@/types";

export function ProcessingSection() {
  const { toast } = useToast();

  // Usamos una consulta tipada correctamente
  const { data: processingData, isLoading } = useQuery<ProcessingStatus>({
    queryKey: ["/api/processing/status"],
    // Actualizar cada 2 segundos siempre para asegurar que tenemos datos actualizados
    refetchInterval: 2000,
  });

  const cancelMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/processing/cancel", {
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
        description: "El procesamiento de los documentos ha sido cancelado",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/processing/status"] });
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

  // If there's no active processing or it's completed, don't show this section
  // Si no hay datos o están cargando, no mostrar nada
  if (isLoading || !processingData) {
    return null;
  }
  
  // Si el procesamiento ha terminado (ambos progresos al 100%), no mostrar nada
  if (processingData.ocrProgress === 100 && processingData.aiProgress === 100) {
    return null;
  }
  
  // Solo mostrar si hay un procesamiento activo real (isProcessing debe ser true)
  if (!processingData.isProcessing) {
    return null;
  }
  
  // Solo mostrar si hay archivos en procesamiento
  if (!processingData.files || processingData.files.length === 0) {
    return null;
  }

  return (
    <Card className="mt-6 bg-gray-800 border-gray-700">
      <CardHeader className="border-b border-gray-700">
        <CardTitle className="text-lg font-medium text-white">
          Procesamiento en curso
        </CardTitle>
        <CardDescription className="text-gray-400">
          El sistema está procesando tus documentos
        </CardDescription>
      </CardHeader>
      
      <CardContent className="p-6">
        <div className="space-y-6">
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
      </CardContent>
    </Card>
  );
}
