import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ConnectionStatus } from './ConnectionStatus';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ChevronDown, ChevronUp, Bug, Network, Database, Server } from 'lucide-react';

interface LogEntry {
  timestamp: Date;
  level: 'info' | 'warn' | 'error';
  message: string;
  data?: any;
}

export function DebugPanel() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);

  // Capture console logs
  React.useEffect(() => {
    const originalConsoleLog = console.log;
    const originalConsoleError = console.error;
    const originalConsoleWarn = console.warn;

    console.log = (...args) => {
      originalConsoleLog(...args);
      if (args[0] && typeof args[0] === 'string' && args[0].includes('DIAGNÓSTICO')) {
        setLogs(prev => [...prev.slice(-49), {
          timestamp: new Date(),
          level: 'info',
          message: args[0],
          data: args[1]
        }]);
      }
    };

    console.error = (...args) => {
      originalConsoleError(...args);
      setLogs(prev => [...prev.slice(-49), {
        timestamp: new Date(),
        level: 'error',
        message: args.join(' '),
        data: args[1]
      }]);
    };

    console.warn = (...args) => {
      originalConsoleWarn(...args);
      setLogs(prev => [...prev.slice(-49), {
        timestamp: new Date(),
        level: 'warn',
        message: args.join(' '),
        data: args[1]
      }]);
    };

    return () => {
      console.log = originalConsoleLog;
      console.error = originalConsoleError;
      console.warn = originalConsoleWarn;
    };
  }, []);

  const clearLogs = () => setLogs([]);

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'error': return 'destructive';
      case 'warn': return 'secondary';
      default: return 'default';
    }
  };

  const testServerConnections = async () => {
    const endpoints = [
      '/api/auth/me',
      '/api/settings',
      '/api/comparisons/recent',
      '/api/sessions'
    ];

    console.log('=== TESTING SERVER CONNECTIONS ===');
    
    for (const endpoint of endpoints) {
      try {
        const startTime = Date.now();
        const response = await fetch(endpoint, {
          credentials: 'include',
          signal: AbortSignal.timeout(10000)
        });
        const duration = Date.now() - startTime;
        
        console.log(`${endpoint}: ${response.status} (${duration}ms)`);
      } catch (error) {
        console.error(`${endpoint}: FAILED -`, error);
      }
    }
    console.log('=== END CONNECTION TEST ===');
  };

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <Card className="bg-gray-900 border-gray-700 shadow-lg">
        <CardHeader 
          className="pb-2 cursor-pointer"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <CardTitle className="text-sm font-medium text-white flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bug className="h-4 w-4 text-blue-400" />
              Panel de Depuración
            </div>
            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </CardTitle>
        </CardHeader>
        
        {isExpanded && (
          <CardContent className="w-96 max-h-[600px]">
            <Tabs defaultValue="connection" className="space-y-4">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="connection" className="text-xs">
                  <Network className="h-3 w-3 mr-1" />
                  Conexión
                </TabsTrigger>
                <TabsTrigger value="logs" className="text-xs">
                  <Server className="h-3 w-3 mr-1" />
                  Logs
                </TabsTrigger>
                <TabsTrigger value="tests" className="text-xs">
                  <Database className="h-3 w-3 mr-1" />
                  Tests
                </TabsTrigger>
              </TabsList>

              <TabsContent value="connection" className="space-y-3">
                <ConnectionStatus />
                
                <Card className="bg-gray-800 border-gray-700">
                  <CardContent className="p-4">
                    <h4 className="text-sm font-medium text-white mb-2">Estado del Sistema</h4>
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between">
                        <span className="text-gray-400">Navegador:</span>
                        <span className="text-gray-300">{navigator.userAgent.split(' ')[0]}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">URL actual:</span>
                        <span className="text-gray-300">{window.location.pathname}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Timestamp:</span>
                        <span className="text-gray-300">{new Date().toLocaleTimeString()}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="logs" className="space-y-3">
                <div className="flex justify-between items-center">
                  <h4 className="text-sm font-medium text-white">
                    Logs del Sistema ({logs.length})
                  </h4>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={clearLogs}
                    className="text-xs"
                  >
                    Limpiar
                  </Button>
                </div>
                
                <ScrollArea className="h-80 border border-gray-700 rounded-lg p-2">
                  <div className="space-y-1">
                    {logs.slice(-20).map((log, index) => (
                      <div key={index} className="text-xs border-b border-gray-800 pb-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant={getLevelColor(log.level)} className="text-xs">
                            {log.level}
                          </Badge>
                          <span className="text-gray-500">
                            {log.timestamp.toLocaleTimeString()}
                          </span>
                        </div>
                        <div className="text-gray-300 font-mono">
                          {log.message}
                        </div>
                        {log.data && (
                          <pre className="text-gray-400 mt-1 text-xs overflow-x-auto">
                            {JSON.stringify(log.data, null, 2)}
                          </pre>
                        )}
                      </div>
                    ))}
                    {logs.length === 0 && (
                      <div className="text-gray-500 text-center py-4">
                        No hay logs disponibles
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="tests" className="space-y-3">
                <Card className="bg-gray-800 border-gray-700">
                  <CardContent className="p-4 space-y-3">
                    <h4 className="text-sm font-medium text-white">Diagnósticos</h4>
                    
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={testServerConnections}
                      className="w-full text-xs"
                    >
                      Probar Conexiones del Servidor
                    </Button>
                    
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => window.location.reload()}
                      className="w-full text-xs"
                    >
                      Recargar Aplicación
                    </Button>
                    
                    <div className="text-xs text-gray-400">
                      <p className="mb-2">Errores comunes:</p>
                      <ul className="list-disc list-inside space-y-1">
                        <li>502: Servidor no disponible</li>
                        <li>401: Sin autenticación</li>
                        <li>500: Error interno del servidor</li>
                        <li>Timeout: Respuesta lenta</li>
                      </ul>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </CardContent>
        )}
      </Card>
    </div>
  );
}