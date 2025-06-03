#!/usr/bin/env node

// Entry point que ejecuta el servidor directamente
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('=== OCR Intelligence Startup ===');
console.log('NODE_ENV:', process.env.NODE_ENV || 'development');
console.log('Starting server...');

// Ejecutar el servidor con tsx directamente
const serverProcess = spawn('npx', ['tsx', 'server/index.ts'], {
  stdio: 'inherit',
  shell: true,
  cwd: process.cwd()
});

serverProcess.on('error', (error) => {
  console.error('Error starting server:', error);
  process.exit(1);
});

serverProcess.on('exit', (code) => {
  console.log('Server process exited with code:', code);
  if (code !== 0) {
    process.exit(code);
  }
});

// Manejar señales de terminación
process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down gracefully');
  serverProcess.kill('SIGTERM');
});

process.on('SIGINT', () => {
  console.log('Received SIGINT, shutting down gracefully');
  serverProcess.kill('SIGINT');
});