import React from 'react';
import { useConnectionMonitor } from '@/hooks/useConnectionMonitor';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, CheckCircle, Wifi, WifiOff, Server, ServerOff } from 'lucide-react';

export function ConnectionStatus() {
  const { 
    isOnline, 
    isServerReachable, 
    lastChecked, 
    consecutiveFailures,
    checkServerHealth,
    isHealthy 
  } = useConnectionMonitor();

  const getStatusColor = () => {
    if (!isOnline) return 'text-red-500';
    if (!isServerReachable) return 'text-yellow-500';
    return 'text-green-500';
  };

  const getStatusIcon = () => {
    if (!isOnline) return <WifiOff className="h-4 w-4" />;
    if (!isServerReachable) return <ServerOff className="h-4 w-4" />;
    return <CheckCircle className="h-4 w-4" />;
  };

  const getStatusText = () => {
    if (!isOnline) return 'Sin conexión a internet';
    if (!isServerReachable) return 'Servidor no disponible';
    return 'Conexión estable';
  };

  return (
    <Card className="bg-gray-800 border-gray-700">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium text-white flex items-center gap-2">
          <div className={getStatusColor()}>
            {getStatusIcon()}
          </div>
          Estado de Conexión
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-400">Estado:</span>
          <span className={`text-sm font-medium ${getStatusColor()}`}>
            {getStatusText()}
          </span>
        </div>
        
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-400">Internet:</span>
          <div className="flex items-center gap-1">
            {isOnline ? (
              <Wifi className="h-3 w-3 text-green-500" />
            ) : (
              <WifiOff className="h-3 w-3 text-red-500" />
            )}
            <span className={`text-xs ${isOnline ? 'text-green-500' : 'text-red-500'}`}>
              {isOnline ? 'Conectado' : 'Desconectado'}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-400">Servidor:</span>
          <div className="flex items-center gap-1">
            {isServerReachable ? (
              <Server className="h-3 w-3 text-green-500" />
            ) : (
              <ServerOff className="h-3 w-3 text-red-500" />
            )}
            <span className={`text-xs ${isServerReachable ? 'text-green-500' : 'text-red-500'}`}>
              {isServerReachable ? 'Disponible' : 'No disponible'}
            </span>
          </div>
        </div>

        {consecutiveFailures > 0 && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-400">Fallos consecutivos:</span>
            <span className="text-xs text-yellow-500">{consecutiveFailures}</span>
          </div>
        )}

        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-400">Última verificación:</span>
          <span className="text-xs text-gray-500">
            {lastChecked.toLocaleTimeString()}
          </span>
        </div>

        <div className="pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={checkServerHealth}
            className="w-full text-xs"
          >
            Verificar conexión
          </Button>
        </div>

        {!isHealthy && (
          <div className="bg-yellow-900/20 border border-yellow-900/30 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-yellow-500 mt-0.5 flex-shrink-0" />
              <div className="text-xs text-yellow-200">
                <p className="font-medium mb-1">Problemas de conexión detectados</p>
                <p className="text-yellow-300">
                  {!isOnline ? 
                    'Verifica tu conexión a internet.' :
                    'El servidor puede estar temporalmente no disponible. Los datos se actualizarán cuando la conexión se restablezca.'
                  }
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}