import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// Obtener __dirname en ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Rutas
const sourcePath = path.join(__dirname, 'OcrIntelligence', 'OcrIntelligence');
const targetPath = __dirname;

// Función para copiar archivos y directorios recursivamente
function copyRecursive(source, target) {
  // Crear directorio destino si no existe
  if (!fs.existsSync(target)) {
    fs.mkdirSync(target, { recursive: true });
  }

  // Leer contenido del directorio
  const items = fs.readdirSync(source);

  for (const item of items) {
    const sourcePath = path.join(source, item);
    const targetPath = path.join(target, item);
    const stat = fs.statSync(sourcePath);
    
    // Ignorar node_modules para evitar problemas
    if (item === 'node_modules') continue;

    if (stat.isDirectory()) {
      // Si es un directorio, copiar recursivamente
      copyRecursive(sourcePath, targetPath);
    } else {
      // Si es un archivo y no existe en destino, copiar directamente
      if (!fs.existsSync(targetPath)) {
        fs.copyFileSync(sourcePath, targetPath);
        console.log(`Copiado: ${targetPath}`);
      }
    }
  }
}

// Copiar archivos
console.log('Copiando archivos del proyecto...');
copyRecursive(sourcePath, targetPath);

console.log('¡Configuración completada! Ahora puedes ejecutar el proyecto con "npm run dev"');