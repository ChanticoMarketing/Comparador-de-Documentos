// Script principal para iniciar la aplicación OCR Intelligence en Replit
import { execSync } from 'child_process';

console.log("Iniciando la aplicación OCR Intelligence en Replit...");
console.log("Este script iniciará el servidor en el puerto 3000");

try {
  // Ejecutar la aplicación con tsx
  execSync('npx tsx server/index.ts', { 
    stdio: 'inherit',
    env: {
      ...process.env,
      PORT: 3000
    }
  });
} catch (error) {
  console.error("Error al iniciar la aplicación:", error.message);
  process.exit(1);
}