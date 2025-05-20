// Script para iniciar la aplicación en Replit
console.log("Iniciando OCR Intelligence en Replit...");

// Importar módulos necesarios usando ESM
import { spawn } from 'child_process';

// Configurar puerto
process.env.PORT = process.env.PORT || 4001;

// Función para iniciar el servidor
function startServer() {
  console.log(`Iniciando servidor en puerto ${process.env.PORT}...`);
  
  const serverProcess = spawn('npx', ['tsx', 'server/index.ts'], {
    stdio: 'inherit',
    env: { ...process.env }
  });
  
  serverProcess.on('error', (err) => {
    console.error("Error iniciando el servidor:", err);
    // Reintentar después de un breve retraso
    setTimeout(startServer, 5000);
  });
  
  serverProcess.on('exit', (code) => {
    if (code !== 0) {
      console.error(`El servidor terminó con código ${code}. Reiniciando...`);
      // Reintentar después de un breve retraso
      setTimeout(startServer, 5000);
    }
  });
}

// Iniciar el servidor
startServer();