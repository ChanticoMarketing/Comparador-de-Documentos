console.log("Iniciando aplicación OCR Intelligence...");
console.log("La aplicación estará disponible en la pestaña 'Webview'");

// Usar una variable de entorno específica para Replit
process.env.PORT = process.env.PORT || 4000;

// Ejecutar el script de inicio usando ESM
import { spawn } from 'child_process';

try {
  console.log("Ejecutando servidor con npx tsx...");
  
  // Ejecutar de forma asincrónica pero capturando errores
  const serverProcess = spawn('npx', ['tsx', 'server/index.ts'], { 
    stdio: 'inherit',
    env: { ...process.env, PORT: process.env.PORT }
  });
  
  serverProcess.on('error', (err) => {
    console.error("Error al iniciar la aplicación:", err);
  });
  
  serverProcess.on('exit', (code) => {
    if (code !== 0) {
      console.error(`El proceso terminó con código de error: ${code}`);
    }
  });
  
} catch (error) {
  console.error("Error al iniciar la aplicación:", error);
}