#!/usr/bin/env node

// Simple entry point que Replit puede ejecutar
const { execSync } = require('child_process');

console.log('=== OCR Intelligence Startup ===');
console.log('NODE_ENV:', process.env.NODE_ENV || 'development');

try {
  if (process.env.NODE_ENV === 'production') {
    console.log('Production mode: Building and starting...');
    execSync('npm run build', { stdio: 'inherit' });
    execSync('npm start', { stdio: 'inherit' });
  } else {
    console.log('Development mode: Starting dev server...');
    execSync('npm run dev', { stdio: 'inherit' });
  }
} catch (error) {
  console.error('Error starting application:', error);
  process.exit(1);
}