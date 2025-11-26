const { spawn } = require('child_process');
const path = require('path');

// Determinar el comando según el entorno
function getCommand() {
  const isProduction = process.env.NODE_ENV === 'production';
  
  if (isProduction) {
    console.log('Modo producción detectado - construyendo y ejecutando...');
    return ['run', 'build'];
  } else {
    console.log('Modo desarrollo detectado - ejecutando servidor de desarrollo...');
    return ['run', 'dev'];
  }
}

// Inicia la aplicación
function startApplication() {
  console.log('Iniciando la aplicación OCR Intelligence...');
  
  const command = getCommand();
  const isProduction = process.env.NODE_ENV === 'production';
  
  // Ejecutar el comando inicial
  const buildProcess = spawn('npm', command, {
    cwd: process.cwd(),
    stdio: 'inherit',
    shell: true
  });
  
  buildProcess.on('error', (error) => {
    console.error('Error al iniciar la aplicación:', error);
  });
  
  buildProcess.on('close', (code) => {
    if (code !== 0) {
      console.error(`Proceso terminó con código: ${code}`);
      return;
    }
    
    // Si es producción, después del build ejecutar start
    if (isProduction) {
      console.log('Build completado, iniciando servidor de producción...');
      const startProcess = spawn('npm', ['start'], {
        cwd: process.cwd(),
        stdio: 'inherit',
        shell: true
      });
      
      startProcess.on('error', (error) => {
        console.error('Error al iniciar servidor de producción:', error);
      });
      
      startProcess.on('close', (startCode) => {
        console.log(`Servidor de producción terminó con código: ${startCode}`);
      });
      
      return startProcess;
    } else {
      console.log('Servidor de desarrollo iniciado correctamente');
    }
  });
  
  return buildProcess;
}

// Si este archivo se ejecuta directamente
if (require.main === module) {
  startApplication();
}

module.exports = startApplication;