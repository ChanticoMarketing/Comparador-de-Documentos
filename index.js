#!/usr/bin/env node

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('OCR Intelligence - Starting...');
console.log('Environment:', process.env.NODE_ENV || 'development');

// Ejecutar el servidor con tsx
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
  if (code !== 0) {
    console.error('Server exited with code:', code);
    process.exit(code);
  }
});

// Manejo de señales de terminación
process.on('SIGTERM', () => {
  console.log('Shutting down gracefully...');
  serverProcess.kill('SIGTERM');
});

process.on('SIGINT', () => {
  console.log('Shutting down gracefully...');
  serverProcess.kill('SIGINT');
});