// Script para iniciar la aplicación OCR Intelligence correctamente
import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

console.log("Iniciando aplicación OCR Intelligence...");
console.log("La aplicación estará disponible en la pestaña 'Webview' o en el puerto 3000");

try {
  // Verificar que server/index.ts existe
  if (!fs.existsSync(path.join(process.cwd(), 'server', 'index.ts'))) {
    throw new Error("No se encontró el archivo server/index.ts. Verificando estructura de carpetas...");
  }
  
  // Ejecutar la aplicación
  execSync('npx tsx server/index.ts', { stdio: 'inherit' });
} catch (error) {
  console.error("Error al iniciar la aplicación:", error.message);
  
  // Intentar localizar el archivo index.ts
  console.log("Buscando archivo index.ts en otras carpetas...");
  const result = execSync('find . -name "index.ts" | grep server').toString();
  console.log("Archivos encontrados:", result);
  
  // Si encontramos archivos, sugerir comando correcto
  if (result) {
    console.log("Por favor, intenta ejecutar la aplicación con uno de los comandos sugeridos:");
    result.split('\n').filter(Boolean).forEach(file => {
      console.log(`npx tsx ${file}`);
    });
  }
}