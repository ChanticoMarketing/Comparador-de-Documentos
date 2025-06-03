#!/usr/bin/env node

// Simple and direct entry point for Replit
import { execSync } from 'child_process';

const isProduction = process.env.NODE_ENV === 'production';

console.log('Starting OCR Intelligence...');
console.log('Environment:', isProduction ? 'production' : 'development');

if (isProduction) {
  console.log('Building application...');
  execSync('npm run build', { stdio: 'inherit' });
  console.log('Starting production server...');
  execSync('npm start', { stdio: 'inherit' });
} else {
  console.log('Starting development server...');
  execSync('npm run dev', { stdio: 'inherit' });
}