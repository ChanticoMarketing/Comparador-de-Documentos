import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { configureAuth } from "./auth-config";
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config();

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Configurar autenticación
configureAuth(app);

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  // Remove conflicting health check endpoints

  app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    // Enhanced error logging for debugging
    console.error("=== ERROR HANDLER TRIGGERED ===");
    console.error("URL:", req.method, req.url);
    console.error("Status:", status);
    console.error("Message:", message);
    console.error("Error Stack:", err.stack);
    console.error("Request Headers:", req.headers);
    console.error("Request Body:", req.body);
    console.error("================================");

    // Don't throw the error again to prevent server crashes
    res.status(status).json({ 
      message,
      error: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  
  // Always serve the web application, prioritizing built files when available
  const distPath = path.resolve(process.cwd(), "dist", "public");
  const hasBuiltFiles = fs.existsSync(distPath) && fs.existsSync(path.join(distPath, "index.html"));
  
  if (hasBuiltFiles) {
    console.log(`Serving static files from: ${distPath}`);
    
    // Serve static files
    app.use(express.static(distPath, {
      maxAge: process.env.NODE_ENV === 'production' ? '1d' : '0'
    }));
    
    // SPA fallback for all routes - serve index.html instead of 404
    app.get("*", (req, res) => {
      const indexPath = path.resolve(distPath, "index.html");
      res.sendFile(indexPath);
    });
  } else {
    console.log("Using Vite development server");
    await setupVite(app, server);
  }

  // Use PORT environment variable for Autoscale deployment compatibility
  const port = process.env.PORT ? parseInt(process.env.PORT) : 3000;
  
  // Set NODE_ENV to production if not already set in production
  if (!process.env.NODE_ENV && process.env.PORT) {
    process.env.NODE_ENV = 'production';
  }
  
  // Add process monitoring for debugging server issues
  process.on('uncaughtException', (error) => {
    console.error('=== UNCAUGHT EXCEPTION ===');
    console.error('Error:', error);
    console.error('Stack:', error.stack);
    console.error('===========================');
    // Don't exit to keep server running
  });

  process.on('unhandledRejection', (reason, promise) => {
    console.error('=== UNHANDLED REJECTION ===');
    console.error('Promise:', promise);
    console.error('Reason:', reason);
    console.error('============================');
  });

  server.listen(port, "0.0.0.0", () => {
    log(`Servidor OCR Intelligence iniciado en puerto ${port}`);
    log("Aplicación OCR Intelligence lista para usar");
    log(`Acceda a la aplicación a través de la pestaña WebView o en http://localhost:${port}`);
    log(`Process ID: ${process.pid}`);
    log(`Node.js version: ${process.version}`);
    log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  });

  // Monitor server health periodically
  setInterval(() => {
    const memUsage = process.memoryUsage();
    console.log(`=== SERVER HEALTH ===`);
    console.log(`Uptime: ${Math.floor(process.uptime())} seconds`);
    console.log(`Memory: RSS ${Math.round(memUsage.rss / 1024 / 1024)}MB, Heap ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`);
    console.log(`====================`);
  }, 60000); // Every minute

})();
