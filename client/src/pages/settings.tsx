import React from "react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Settings } from "@/types";

export default function SettingsPage() {
  const { toast } = useToast();
  
  const form = useForm<Settings>({
    defaultValues: {
      api4aiKey: "",
      openaiKey: "",
      openaiModel: "gpt-4.1",
      fallbackToMiniModel: true,
      autoSaveResults: false,
      maxFileSize: 10,
    },
  });

  const updateSettingsMutation = useMutation({
    mutationFn: async (data: Settings) => {
      const response = await fetch("/api/settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
        credentials: "include",
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Error al actualizar configuración");
      }
      
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Configuración actualizada",
        description: "La configuración se ha actualizado correctamente",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error al actualizar configuración",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: Settings) => {
    updateSettingsMutation.mutate(data);
  };

  React.useEffect(() => {
    // Load settings from API
    const fetchSettings = async () => {
      try {
        const response = await fetch("/api/settings", {
          credentials: "include",
        });
        
        if (response.ok) {
          const settings = await response.json();
          form.reset(settings);
        }
      } catch (error) {
        console.error("Error fetching settings:", error);
      }
    };
    
    fetchSettings();
  }, [form]);

  return (
    <DashboardLayout
      title="Configuración"
      description="Ajusta la configuración de la aplicación"
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <Card className="mt-6 bg-gray-800 border-gray-700">
            <CardHeader className="border-b border-gray-700">
              <CardTitle className="text-lg font-medium text-white">
                Configuración de API
              </CardTitle>
              <CardDescription className="text-gray-400">
                Configura las claves de API para el OCR y el análisis de inteligencia artificial
              </CardDescription>
            </CardHeader>
            
            <CardContent className="p-6 space-y-6">
              <FormField
                control={form.control}
                name="api4aiKey"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-white">API4AI Key</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="Ingresa tu clave de API4AI"
                        className="bg-gray-700 border-gray-600 text-white"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription className="text-gray-400">
                      Esta clave se utiliza para el procesamiento OCR de los documentos
                    </FormDescription>
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="openaiKey"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-white">OpenAI API Key</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="Ingresa tu clave de OpenAI"
                        className="bg-gray-700 border-gray-600 text-white"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription className="text-gray-400">
                      Se utiliza para el análisis inteligente de los documentos
                    </FormDescription>
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="openaiModel"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-white">Modelo de OpenAI</FormLabel>
                    <FormControl>
                      <select
                        className="w-full bg-gray-700 border-gray-600 text-white rounded-md px-3 py-2"
                        {...field}
                      >
                        <option value="gpt-4.1">GPT-4.1 (Recomendado)</option>
                        <option value="gpt-4o">GPT-4o</option>
                        <option value="gpt-4o-mini">GPT-4o-mini (Más económico)</option>
                      </select>
                    </FormControl>
                    <FormDescription className="text-gray-400">
                      Selecciona el modelo de OpenAI para el análisis
                    </FormDescription>
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="fallbackToMiniModel"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between">
                    <div className="space-y-0.5">
                      <FormLabel className="text-white">Usar modelo de respaldo</FormLabel>
                      <FormDescription className="text-gray-400">
                        Si el modelo principal falla, usar GPT-4o-mini como respaldo
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>
          
          <Card className="mt-6 bg-gray-800 border-gray-700">
            <CardHeader className="border-b border-gray-700">
              <CardTitle className="text-lg font-medium text-white">
                Preferencias generales
              </CardTitle>
              <CardDescription className="text-gray-400">
                Configura el comportamiento general de la aplicación
              </CardDescription>
            </CardHeader>
            
            <CardContent className="p-6 space-y-6">
              <FormField
                control={form.control}
                name="autoSaveResults"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between">
                    <div className="space-y-0.5">
                      <FormLabel className="text-white">Guardar resultados automáticamente</FormLabel>
                      <FormDescription className="text-gray-400">
                        Guarda automáticamente los resultados de las comparaciones
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="maxFileSize"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-white">Tamaño máximo de archivo (MB)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="1"
                        max="50"
                        className="bg-gray-700 border-gray-600 text-white"
                        {...field}
                        onChange={(e) => {
                          const value = e.target.value === "" ? "10" : e.target.value;
                          field.onChange(Number(value));
                        }}
                      />
                    </FormControl>
                    <FormDescription className="text-gray-400">
                      Tamaño máximo permitido para los archivos subidos (1-50 MB)
                    </FormDescription>
                  </FormItem>
                )}
              />
              
              <div className="pt-4 flex justify-end">
                <Button
                  type="submit"
                  disabled={updateSettingsMutation.isPending}
                  className="bg-primary-600 hover:bg-primary-700 text-white"
                >
                  {updateSettingsMutation.isPending ? (
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
                      Guardar configuración
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </form>
      </Form>
    </DashboardLayout>
  );
}
