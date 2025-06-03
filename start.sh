#!/bin/bash
# Script para iniciar la aplicación OcrIntelligence

echo "Iniciando aplicación OcrIntelligence..."
echo "La aplicación estará disponible en la pestaña 'Webview' o en el puerto 4000"

# Verificar si hay procesos usando el puerto 4000 y matarlos
echo "Verificando si el puerto 4000 está en uso..."
netstat -tulpn 2>/dev/null | grep ":4000" | awk '{print $7}' | cut -d'/' -f1 | xargs -r kill -9 2>/dev/null

# Esperar un momento para asegurarse de que el puerto está libre
sleep 1

# Iniciar la aplicación en el puerto 4000
PORT=4000 npx tsx server/index.ts