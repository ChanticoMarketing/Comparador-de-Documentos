import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileUpload } from "@/components/ui/file-upload";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export function FileUploadSection() {
  const [invoiceFiles, setInvoiceFiles] = useState<File[]>([]);
  const [deliveryFiles, setDeliveryFiles] = useState<File[]>([]);
  const { toast } = useToast();

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (invoiceFiles.length === 0 || deliveryFiles.length === 0) {
        throw new Error("Debe seleccionar al menos un archivo de factura y un archivo de orden de entrega");
      }

      const formData = new FormData();
      
      invoiceFiles.forEach((file) => {
        formData.append("invoices", file);
      });
      
      deliveryFiles.forEach((file) => {
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
      queryClient.invalidateQueries({ queryKey: ["/api/comparisons"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error al subir los archivos",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleInvoiceFilesSelected = (files: File[]) => {
    setInvoiceFiles(files);
  };

  const handleDeliveryFilesSelected = (files: File[]) => {
    setDeliveryFiles(files);
  };

  const handleUpload = () => {
    uploadMutation.mutate();
  };

  return (
    <Card className="mt-6 bg-gray-800 border-gray-700">
      <CardHeader className="border-b border-gray-700">
        <CardTitle className="text-lg font-medium text-white">
          Subir archivos para comparar
        </CardTitle>
        <CardDescription className="text-gray-400">
          Arrastra y suelta tus facturas y órdenes de entrega en formato PDF
        </CardDescription>
      </CardHeader>
      
      <CardContent className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Invoice Upload */}
          <FileUpload 
            onFilesSelected={handleInvoiceFilesSelected}
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
            onFilesSelected={handleDeliveryFilesSelected}
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
        
        {/* Upload Button */}
        <div className="mt-6 flex justify-end">
          <Button 
            onClick={handleUpload}
            disabled={uploadMutation.isPending || invoiceFiles.length === 0 || deliveryFiles.length === 0}
            className="bg-primary-600 hover:bg-primary-700 text-white"
          >
            {uploadMutation.isPending ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Procesando...
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                Iniciar procesamiento
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
