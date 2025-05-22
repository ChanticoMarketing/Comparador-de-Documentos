const { spawn } = require('child_process');
const path = require('path');

// Inicia la aplicación en modo desarrollo
function startApplication() {
  console.log('Iniciando la aplicación OCR Intelligence...');
  
  // Ejecutar el script de inicio que está configurado en package.json
  const process = spawn('npm', ['run', 'dev'], {
    cwd: path.resolve(__dirname, '../../..'),
    stdio: 'inherit',
    shell: true
  });
  
  process.on('error', (error) => {
    console.error('Error al iniciar la aplicación:', error);
  });
  
  process.on('close', (code) => {
    if (code !== 0) {
      console.error(`La aplicación se cerró con código: ${code}`);
    } else {
      console.log('Aplicación finalizada correctamente');
    }
  });
  
  return process;
}

module.exports = startApplication;