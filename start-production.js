#!/usr/bin/env node

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('OCR Intelligence - Production Start');
console.log('Environment:', process.env.NODE_ENV || 'production');
console.log('Port:', process.env.PORT || '3000');

// Set NODE_ENV to production if not already set
if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = 'production';
}

// Start the production server
const serverProcess = spawn('node', ['dist/index.js'], {
  stdio: 'inherit',
  shell: true,
  cwd: process.cwd(),
  env: process.env
});

serverProcess.on('error', (error) => {
  console.error('Error starting production server:', error);
  process.exit(1);
});

serverProcess.on('exit', (code) => {
  if (code !== 0) {
    console.error('Production server exited with code:', code);
    process.exit(code);
  }
});

// Graceful shutdown handling
process.on('SIGTERM', () => {
  console.log('Shutting down production server gracefully...');
  serverProcess.kill('SIGTERM');
});

process.on('SIGINT', () => {
  console.log('Shutting down production server gracefully...');
  serverProcess.kill('SIGINT');
});