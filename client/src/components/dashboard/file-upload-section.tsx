import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileUpload } from "@/components/ui/file-upload";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Separator } from "@/components/ui/separator";

// Estructura para un bloque de comparación
interface ComparisonBlock {
  id: string;
  invoiceFiles: File[];
  deliveryFiles: File[];
}

export function FileUploadSection() {
  // Utilizamos un array de bloques de comparación en lugar de archivos individuales
  const [blocks, setBlocks] = useState<ComparisonBlock[]>([
    {
      id: "block-" + Date.now(),
      invoiceFiles: [],
      deliveryFiles: []
    }
  ]);
  
  // Estado para forzar el reseteo de componentes FileUpload
  const [fileUploadKey, setFileUploadKey] = useState(Date.now());
  
  const { toast } = useToast();

  // Mutación para subir un bloque específico
  const uploadMutation = useMutation({
    mutationFn: async (blockId: string) => {
      const block = blocks.find(b => b.id === blockId);
      
      if (!block) {
        throw new Error("Bloque no encontrado");
      }
      
      if (block.invoiceFiles.length === 0 || block.deliveryFiles.length === 0) {
        throw new Error("Debe seleccionar al menos un archivo de factura y un archivo de orden de entrega");
      }

      const formData = new FormData();
      
      // Añadimos identificador de bloque para futura referencia
      formData.append("blockId", blockId);
      
      block.invoiceFiles.forEach((file) => {
        formData.append("invoices", file);
      });
      
      block.deliveryFiles.forEach((file) => {
        formData.append("deliveryOrders", file);
      });
      
      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Error al subir los archivos");
      }
      
      return await response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Archivos subidos correctamente",
        description: "Se ha iniciado el procesamiento de los documentos",
      });
      
      // Invalidación más completa para asegurar actualización automática
      // Invalidar todas las consultas relacionadas con comparaciones y procesamiento
      queryClient.invalidateQueries({ queryKey: ["/api/comparisons"] });
      queryClient.invalidateQueries({ queryKey: ["/api/comparisons/latest"] });
      queryClient.invalidateQueries({ queryKey: ["/api/comparisons/recent"] });
      queryClient.invalidateQueries({ queryKey: ["/api/processing/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sessions"] });
      
      // Limpiar todos los bloques y crear uno nuevo vacío
      setBlocks([
        {
          id: "block-" + Date.now(),
          invoiceFiles: [],
          deliveryFiles: []
        }
      ]);
      
      // Cambiar la key de los componentes FileUpload para forzar su reseteo visual
      setFileUploadKey(Date.now());
      
      console.log("Comparación iniciada, archivos limpiados y consultas invalidadas", data);
    },
    onError: (error: Error) => {
      toast({
        title: "Error al subir los archivos",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Manejadores para actualizar los archivos en un bloque específico
  const handleInvoiceFilesSelected = (blockId: string, files: File[]) => {
    setBlocks(prev => 
      prev.map(block => 
        block.id === blockId 
          ? { ...block, invoiceFiles: files } 
          : block
      )
    );
  };

  const handleDeliveryFilesSelected = (blockId: string, files: File[]) => {
    setBlocks(prev => 
      prev.map(block => 
        block.id === blockId 
          ? { ...block, deliveryFiles: files } 
          : block
      )
    );
  };

  // Función para iniciar el procesamiento de un bloque específico
  const handleUpload = (blockId: string) => {
    uploadMutation.mutate(blockId);
  };

  // Mutación separada para procesar múltiples bloques
  const uploadAllMutation = useMutation({
    mutationFn: async () => {
      const validBlocks = blocks.filter(block => 
        block.invoiceFiles.length > 0 && block.deliveryFiles.length > 0
      );
      
      if (validBlocks.length === 0) {
        throw new Error("No hay bloques válidos para procesar");
      }

      console.log(`Iniciando procesamiento de ${validBlocks.length} bloques válidos`);
      
      // Procesar todos los bloques secuencialmente con espera completa
      const processedResults = [];
      
      for (let i = 0; i < validBlocks.length; i++) {
        const block = validBlocks[i];
        console.log(`Iniciando procesamiento del bloque ${i + 1}/${validBlocks.length}: ${block.id}`);
        
        try {
          // Crear FormData para este bloque específico
          const formData = new FormData();
          formData.append("blockId", block.id);
          
          // Agregar archivos de facturas
          block.invoiceFiles.forEach(file => {
            formData.append("invoices", file);
          });
          
          // Agregar archivos de órdenes de entrega
          block.deliveryFiles.forEach(file => {
            formData.append("deliveryOrders", file);
          });
          
          // Enviar este bloque al servidor y esperar respuesta completa
          const response = await fetch("/api/upload", {
            method: "POST",
            body: formData,
            credentials: "include",
          });
          
          if (!response.ok) {
            const errorText = await response.text();
            console.error(`Error en bloque ${block.id}: ${errorText}`);
            throw new Error(`Error en bloque ${block.id}: ${errorText}`);
          }
          
          const result = await response.json();
          processedResults.push({
            blockId: block.id,
            sessionId: result.sessionId,
            success: true
          });
          
          console.log(`Bloque ${block.id} enviado exitosamente. SessionId: ${result.sessionId}`);
          
          // Espera entre bloques para evitar saturación del servidor
          if (i < validBlocks.length - 1) {
            console.log(`Esperando antes de procesar el siguiente bloque...`);
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
          
        } catch (error) {
          console.error(`Falló el procesamiento del bloque ${block.id}:`, error);
          processedResults.push({
            blockId: block.id,
            success: false,
            error: error instanceof Error ? error.message : String(error)
          });
          // Continuar con el siguiente bloque incluso si uno falla
        }
      }
      
      return { processedBlocks: validBlocks.length };
    },
    onSuccess: (data) => {
      toast({
        title: "Procesamiento iniciado",
        description: `Se han enviado ${data.processedBlocks} bloques para procesamiento`,
      });
      
      // Invalidar consultas para actualización automática
      queryClient.invalidateQueries({ queryKey: ["/api/comparisons"] });
      queryClient.invalidateQueries({ queryKey: ["/api/comparisons/latest"] });
      queryClient.invalidateQueries({ queryKey: ["/api/processing/status"] });
      
      console.log(`Procesamiento de ${data.processedBlocks} bloques iniciado exitosamente`);
    },
    onError: (error: Error) => {
      toast({
        title: "Error al procesar bloques",
        description: error.message,
        variant: "destructive",
      });
      console.error("Error en procesamiento múltiple:", error);
    },
  });

  // Función para procesar todos los bloques válidos de una vez
  const handleUploadAll = () => {
    const validBlocks = blocks.filter(block => 
      block.invoiceFiles.length > 0 && block.deliveryFiles.length > 0
    );
    
    if (validBlocks.length === 0) {
      toast({
        title: "No hay bloques válidos",
        description: "Cada bloque debe tener al menos una factura y una orden de entrega",
        variant: "destructive",
      });
      return;
    }

    uploadAllMutation.mutate();
  };

  // Función para añadir un nuevo bloque de comparación
  const addNewBlock = () => {
    setBlocks(prev => [
      ...prev, 
      {
        id: "block-" + Date.now(),
        invoiceFiles: [],
        deliveryFiles: []
      }
    ]);
  };

  // Función para eliminar un bloque
  const removeBlock = (blockId: string) => {
    // No permitir eliminar si solo queda un bloque
    if (blocks.length <= 1) return;
    
    setBlocks(prev => prev.filter(block => block.id !== blockId));
  };

  return (
    <Card className="mt-6 bg-gray-800 border-gray-700">
      <CardHeader className="border-b border-gray-700">
        <CardTitle className="text-lg font-medium text-white">
          Subir archivos para comparar
        </CardTitle>
        <CardDescription className="text-gray-400">
          Arrastra y suelta tus facturas y órdenes de entrega en formato PDF. Puedes crear múltiples bloques para comparaciones simultáneas.
        </CardDescription>
      </CardHeader>
      
      <CardContent className="p-6 space-y-8">
        {blocks.map((block, index) => (
          <div key={block.id} className="space-y-4">
            {index > 0 && <Separator className="my-6 bg-gray-700" />}
            
            <div className="flex justify-between items-center">
              <h3 className="text-md font-medium text-white">
                {block.invoiceFiles.length > 0 
                  ? `${block.invoiceFiles[0].name.replace(/\.[^/.]+$/, "")}` // Mostrar nombre de factura sin extensión
                  : `Bloque de comparación ${index + 1}`
                }
              </h3>
              {blocks.length > 1 && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => removeBlock(block.id)}
                  className="text-red-500 border-red-500 hover:bg-red-950"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                  Eliminar
                </Button>
              )}
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Invoice Upload */}
              <FileUpload 
                key={`invoice-${block.id}-${fileUploadKey}`}
                onFilesSelected={(files) => handleInvoiceFilesSelected(block.id, files)}
                label="Facturas"
                description="PDF, JPG o PNG (máx. 10MB)"
                icon={
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-full w-full" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                    <line x1="10" y1="9" x2="8" y2="9" />
                  </svg>
                }
                buttonText="Seleccionar archivos"
              />
              
              {/* Delivery Order Upload */}
              <FileUpload 
                key={`delivery-${block.id}-${fileUploadKey}`}
                onFilesSelected={(files) => handleDeliveryFilesSelected(block.id, files)}
                label="Órdenes de Entrega"
                description="PDF, JPG o PNG (máx. 10MB)"
                icon={
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-full w-full" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <path d="M16 13H8" />
                    <path d="M16 17H8" />
                    <path d="M10 9H8" />
                  </svg>
                }
                buttonText="Seleccionar archivos"
              />
            </div>
            

          </div>
        ))}
        
        {/* Add New Block Button */}
        <div className="flex justify-center mt-6">
          <Button 
            variant="outline" 
            onClick={addNewBlock}
            className="border-dashed border-gray-600 text-gray-400 hover:text-white hover:bg-gray-700"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            Añadir nuevo bloque de comparación
          </Button>
        </div>

        {/* Single Upload Button for All Blocks */}
        <div className="flex justify-center mt-8 pt-6 border-t border-gray-700">
          <Button 
            onClick={handleUploadAll}
            disabled={uploadAllMutation.isPending || blocks.every(block => block.invoiceFiles.length === 0 || block.deliveryFiles.length === 0)}
            className="bg-primary-600 hover:bg-primary-700 text-white px-8 py-3 text-lg font-medium"
            size="lg"
          >
            {uploadAllMutation.isPending ? (
              <>
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Procesando comparaciones...
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                Iniciar todas las comparaciones
                {blocks.filter(block => block.invoiceFiles.length > 0 && block.deliveryFiles.length > 0).length > 0 && 
                  ` (${blocks.filter(block => block.invoiceFiles.length > 0 && block.deliveryFiles.length > 0).length} bloques)`
                }
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
