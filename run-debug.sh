#!/bin/bash
# Script de depuración para la aplicación OCR Intelligence

echo "=== Iniciando depuración de la aplicación OCR Intelligence ==="
echo "Verificando estructura de archivos..."

# Verificar archivos clave
if [ ! -f "server/index.ts" ]; then
  echo "ERROR: No se encontró server/index.ts"
  exit 1
fi

if [ ! -f "client/index.html" ]; then
  echo "ERROR: No se encontró client/index.html"
  exit 1
fi

echo "=== Verificación de credenciales ==="
# Verificar las variables de entorno (sin mostrar los valores)
echo "API4AI_KEY: $(if [ -n "$API4AI_KEY" ]; then echo "CONFIGURADA"; else echo "NO CONFIGURADA"; fi)"
echo "MISTRAL_KEY: $(if [ -n "$MISTRAL_KEY" ]; then echo "CONFIGURADA"; else echo "NO CONFIGURADA"; fi)"
echo "OPENAI_API_KEY: $(if [ -n "$OPENAI_API_KEY" ]; then echo "CONFIGURADA"; else echo "NO CONFIGURADA"; fi)"
echo "DATABASE_URL: $(if [ -n "$DATABASE_URL" ]; then echo "CONFIGURADA"; else echo "NO CONFIGURADA"; fi)"

echo "=== Iniciando aplicación... ==="
echo "La aplicación estará accesible en el puerto 3000"

# Ejecutar la aplicación en primer plano
npx tsx server/index.ts