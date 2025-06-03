import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { getOcrService } from "./ocr";
import { getMatcherService } from "./matcher";
import { authService } from "./auth";
import { isAuthenticated, AuthRequest, getUserId } from "./auth-config";
import passport from "passport";
import multer from "multer";
import path from "path";
import fs from "fs";
import os from "os";
import { ProcessingStatus, Settings } from "../client/src/types";
import { exportToPdf, exportToExcel } from "./utils";
import { db } from "@db";
import { comparisons } from "@shared/schema";
import { desc } from "drizzle-orm";

// Global processing state (in a real app, this would be in a database or Redis)
interface ProcessingState {
  sessionId?: number;
  ocrProgress: number;
  aiProgress: number;
  currentOcrFile?: string;
  currentAiStage?: string; // Etapa actual del procesamiento de IA (para mostrar en la UI)
  files: Array<{
    name: string;
    type: "invoice" | "deliveryOrder";
    size: number;
    status: "pending" | "processing" | "completed" | "error";
  }>;
  isProcessing: boolean;
  error?: string;
  blockId?: string; // Identificador único del bloque de comparación
  blockName?: string; // Nombre descriptivo del bloque basado en el archivo de factura
}

// Estado principal para el lote de procesamiento
const processingState: ProcessingState = {
  ocrProgress: 0,
  aiProgress: 0,
  files: [],
  isProcessing: false,
};

// Configure multer for file uploads
const createTempDir = (): string => {
  // Usar un directorio temporal que funcione bien en Replit
  const tempDir = path.join(os.tmpdir(), "ocr-matcher-uploads");
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
    
    // En Replit, aseguramos que el directorio tenga permisos adecuados
    try {
      fs.chmodSync(tempDir, 0o777);
    } catch (error) {
      console.warn("No se pudieron establecer permisos en directorio temporal:", error);
    }
  }
  console.log("Directorio temporal para uploads:", tempDir);
  return tempDir;
};

const upload = multer({
  dest: createTempDir(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
});

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);

  // Rutas de autenticación
  app.post("/api/auth/register", async (req: Request, res: Response) => {
    try {
      const newUser = await authService.registerUser(req.body);
      res.status(201).json(newUser);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });
  
  app.post("/api/auth/login", (req: Request, res: Response, next) => {
    passport.authenticate("local", (err: Error, user: any) => {
      if (err) {
        return res.status(500).json({ message: "Error en el servidor" });
      }
      if (!user) {
        return res.status(401).json({ message: "Credenciales inválidas" });
      }
      
      req.logIn(user, (loginErr) => {
        if (loginErr) {
          return res.status(500).json({ message: "Error al iniciar sesión" });
        }
        return res.status(200).json(user);
      });
    })(req, res, next);
  });
  
  app.post("/api/auth/logout", (req: Request, res: Response) => {
    req.logout((err) => {
      if (err) {
        return res.status(500).json({ message: "Error al cerrar sesión" });
      }
      res.status(200).json({ message: "Sesión cerrada correctamente" });
    });
  });
  
  app.get("/api/auth/me", (req: Request, res: Response) => {
    if (req.isAuthenticated && req.isAuthenticated()) {
      res.status(200).json(req.user);
    } else {
      res.status(401).json({ message: "No autenticado" });
    }
  });

  // Get application settings
  app.get("/api/settings", async (req: Request, res: Response) => {
    try {
      const settings = await storage.getSettings();
      if (!settings) {
        // Return default settings if none exist
        return res.json({
          api4aiKey: "",
          openaiKey: "",
          openaiModel: "gpt-4o",
          fallbackToMiniModel: true,
          autoSaveResults: false,
          maxFileSize: 10,
        });
      }
      return res.json({
        api4aiKey: settings.api4aiKey || "",
        openaiKey: settings.openaiKey || "",
        openaiModel: settings.openaiModel || "gpt-4o",
        fallbackToMiniModel: settings.fallbackToMiniModel,
        autoSaveResults: settings.autoSaveResults,
        maxFileSize: settings.maxFileSize || 10,
      });
    } catch (error) {
      console.error("Error fetching settings:", error);
      return res.status(500).json({
        message: `Error fetching settings: ${
          error instanceof Error ? error.message : String(error)
        }`,
      });
    }
  });

  // Update application settings
  app.post("/api/settings", async (req: Request, res: Response) => {
    try {
      const settingsData = req.body as Settings;
      // Obtener configuración existente para mantener el ID si existe
      const existingSettings = await storage.getSettings();
      
      const settingsToSave: any = {
        api4aiKey: settingsData.api4aiKey || "",
        openaiKey: settingsData.openaiKey || "",
        openaiModel: settingsData.openaiModel || "gpt-4o",
        fallbackToMiniModel: settingsData.fallbackToMiniModel || true,
        autoSaveResults: settingsData.autoSaveResults || false,
        maxFileSize: settingsData.maxFileSize || 10,
      };
      
      // Si hay configuración existente, usar su ID
      if (existingSettings && existingSettings.id) {
        settingsToSave.id = existingSettings.id;
      }
      
      const updatedSettings = await storage.saveSettings(settingsToSave);
      
      // Update environment variables for keys
      if (settingsData.api4aiKey) {
        process.env.API4AI_KEY = settingsData.api4aiKey;
      }
      if (settingsData.openaiKey) {
        process.env.OPENAI_KEY = settingsData.openaiKey;
      }
      
      return res.json({ success: true, settings: updatedSettings });
    } catch (error) {
      console.error("Error updating settings:", error);
      return res.status(500).json({
        message: `Error updating settings: ${
          error instanceof Error ? error.message : String(error)
        }`,
      });
    }
  });

  // Upload files for processing
  app.post(
    "/api/upload",
    upload.fields([
      { name: "invoices", maxCount: 10 },
      { name: "deliveryOrders", maxCount: 10 },
    ]),
    async (req: Request, res: Response) => {
      try {
        const files = req.files as {
          [fieldname: string]: Express.Multer.File[];
        };

        // Validate that we have at least one invoice and one delivery order
        if (!files.invoices || !files.deliveryOrders) {
          return res.status(400).json({
            message:
              "You must upload at least one invoice and one delivery order",
          });
        }

        // Verificar si ya hay un procesamiento activo
        if (processingState.isProcessing) {
          return res.status(409).json({
            message: "Ya hay un procesamiento en curso. Por favor espere o cancele el procesamiento actual.",
          });
        }

        // Determinar el número de pares a procesar
        const numPairs = Math.min(files.invoices.length, files.deliveryOrders.length);
        
        if (files.invoices.length !== files.deliveryOrders.length) {
          console.warn(`Número de archivos no coincide: ${files.invoices.length} facturas vs ${files.deliveryOrders.length} órdenes. Se procesarán ${numPairs} pares.`);
        }

        console.log(`Iniciando procesamiento de ${numPairs} pares de documentos`);

        // Inicializar el estado global del lote
        processingState.isProcessing = true;
        processingState.ocrProgress = 0;
        processingState.aiProgress = 0;
        processingState.files = [];
        processingState.error = undefined;
        processingState.sessionId = undefined; // Ya no es un ID de sesión maestra

        // Poblar el estado con todos los archivos del lote
        files.invoices.forEach((file) => {
          processingState.files.push({
            name: file.originalname,
            type: "invoice",
            size: file.size,
            status: "pending",
          });
        });

        files.deliveryOrders.forEach((file) => {
          processingState.files.push({
            name: file.originalname,
            type: "deliveryOrder",
            size: file.size,
            status: "pending",
          });
        });

        // Obtener el ID del usuario si está autenticado
        const userId = getUserId(req as AuthRequest) || undefined;

        // Iniciar procesamiento en segundo plano
        processFiles(files.invoices, files.deliveryOrders, userId || undefined).catch(
          (error) => {
            const errorMsg = error instanceof Error ? error.message : String(error);
            console.error("Error processing files:", errorMsg);
            
            processingState.isProcessing = false;
            processingState.error = `Error processing files: ${errorMsg}`;
          }
        );

        return res.status(202).json({
          message: `Lote de ${numPairs} pares iniciado exitosamente`,
          totalPairs: numPairs,
        });
      } catch (error) {
        console.error("Error uploading files:", error);
        return res.status(500).json({
          message: `Error uploading files: ${
            error instanceof Error ? error.message : String(error)
          }`,
        });
      }
    }
  );

  // Get processing status
  app.get("/api/processing/status", (req: Request, res: Response) => {
    // Devolver el estado principal del lote
    const status: ProcessingStatus = {
      ocrProgress: processingState.ocrProgress,
      aiProgress: processingState.aiProgress,
      currentOcrFile: processingState.currentOcrFile,
      currentAiStage: processingState.currentAiStage,
      files: processingState.files,
      isProcessing: processingState.isProcessing,
      error: processingState.error,
    };
    return res.json(status);
  });

  // Cancel processing
  app.post("/api/processing/cancel", async (req: Request, res: Response) => {
    if (!processingState.isProcessing) {
      return res.status(400).json({
        message: "No hay ningún procesamiento activo en este momento",
      });
    }
    
    // Marcar como cancelado para detener el bucle de procesamiento
    processingState.isProcessing = false;
    processingState.ocrProgress = 0;
    processingState.aiProgress = 0;
    processingState.error = "Procesamiento cancelado por el usuario";
    
    console.log("Procesamiento cancelado correctamente");
    
    return res.json({
      message: "Procesamiento cancelado correctamente",
      success: true,
    });
  });

  // Get all sessions
  app.get("/api/sessions", async (req: Request, res: Response) => {
    try {
      // Get query parameters for pagination
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 5;
      const sessions = await storage.getAllSessions(limit);
      return res.json(sessions);
    } catch (error) {
      console.error("Error fetching sessions:", error);
      return res.status(500).json({
        message: `Error fetching sessions: ${
          error instanceof Error ? error.message : String(error)
        }`,
      });
    }
  });

  // Get all sessions (full list)
  app.get("/api/sessions/all", async (req: Request, res: Response) => {
    try {
      const sessions = await storage.getAllSessions();
      return res.json(sessions);
    } catch (error) {
      console.error("Error fetching all sessions:", error);
      return res.status(500).json({
        message: `Error fetching all sessions: ${
          error instanceof Error ? error.message : String(error)
        }`,
      });
    }
  });

  // Get a specific session
  app.get("/api/sessions/:id", async (req: Request, res: Response) => {
    try {
      const sessionId = parseInt(req.params.id);
      if (isNaN(sessionId)) {
        return res.status(400).json({
          message: "Invalid session ID",
        });
      }

      const session = await storage.getSession(sessionId);
      if (!session) {
        return res.status(404).json({
          message: "Session not found",
        });
      }

      return res.json(session);
    } catch (error) {
      console.error("Error fetching session:", error);
      return res.status(500).json({
        message: `Error fetching session: ${
          error instanceof Error ? error.message : String(error)
        }`,
      });
    }
  });

  // Get the latest comparison result
  app.get("/api/comparisons/latest", async (req: Request, res: Response) => {
    try {
      const comparison = await storage.getMostRecentComparison();
      if (!comparison) {
        return res.status(404).json({
          message: "No comparisons found",
        });
      }

      return res.json(comparison);
    } catch (error) {
      console.error("Error fetching latest comparison:", error);
      return res.status(500).json({
        message: `Error fetching latest comparison: ${
          error instanceof Error ? error.message : String(error)
        }`,
      });
    }
  });

  // Get comparisons from the most recent session (for multiple blocks)
  app.get("/api/comparisons/recent", async (req: Request, res: Response) => {
    try {
      // Primero obtener la sesión más reciente
      const latestComparison = await db.query.comparisons.findFirst({
        orderBy: desc(comparisons.createdAt),
        with: {
          session: true,
        },
      });
      
      console.log("DEBUG: Comparación más reciente:", latestComparison ? {
        id: latestComparison.id,
        sessionId: latestComparison.sessionId,
        invoiceFilename: latestComparison.invoiceFilename,
        createdAt: latestComparison.createdAt
      } : "No encontrada");
      
      if (!latestComparison || !latestComparison.sessionId) {
        console.log("DEBUG: No hay comparaciones o sesiones disponibles");
        return res.json([]);
      }
      
      // Obtener todas las comparaciones de la sesión más reciente
      const sessionComparisons = await storage.getComparisonsBySessionId(latestComparison.sessionId);
      
      console.log(`DEBUG: Encontradas ${sessionComparisons.length} comparaciones de la sesión ${latestComparison.sessionId}`);
      console.log("DEBUG: IDs de comparaciones:", sessionComparisons.map(c => ({ id: c.id, invoice: c.invoiceFilename })));
      
      return res.json(sessionComparisons);
    } catch (error) {
      console.error("Error fetching recent comparisons:", error);
      return res.status(500).json({
        message: `Error fetching recent comparisons: ${
          error instanceof Error ? error.message : String(error)
        }`,
      });
    }
  });

  // Get a specific comparison result
  app.get("/api/comparisons/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      // Convertir ID a número y verificar que sea válido
      const comparisonId = parseInt(req.params.id);
      if (isNaN(comparisonId)) {
        console.error(`ID de comparación inválido recibido: "${req.params.id}"`);
        return res.status(400).json({
          message: "ID de comparación inválido",
        });
      }

      console.log(`Solicitando comparación ID: ${comparisonId}`);

      // Manejamos el tipo de usuario de manera segura
      const authReq = req as unknown as AuthRequest;
      
      // Obtener el ID del usuario actual
      const userId = getUserId(authReq);
      if (!userId) {
        console.error("Solicitud sin usuario autenticado");
        return res.status(401).json({
          message: "Sesión no válida. Por favor inicie sesión nuevamente.",
        });
      }

      console.log(`Usuario ${userId} solicitando comparación ${comparisonId}`);

      // Obtener la comparación
      const comparison = await storage.getComparison(comparisonId);
      
      // Si no existe, retornar 404 con mensaje claro
      if (!comparison) {
        console.error(`Comparación ID ${comparisonId} no encontrada en la base de datos`);
        return res.status(404).json({
          message: `Comparación con ID ${comparisonId} no encontrada. Por favor verifique que el ID es correcto.`,
        });
      }

      // Verificar que la comparación pertenece al usuario (si tiene userId definido)
      // Si el campo userId no está definido en la comparación (migraciones antiguas) permitir acceso
      const comparisonUserId = comparison.userId as number | undefined;
      
      // Solo verificar permisos si el usuario está definido en la comparación
      if (comparisonUserId !== undefined && comparisonUserId !== userId) {
        console.error(`Usuario ${userId} intentó acceder a comparación ${comparisonId} que pertenece a usuario ${comparisonUserId}`);
        return res.status(403).json({
          message: "No tienes permiso para acceder a esta comparación",
        });
      }

      // Comparación encontrada y permisos verificados, devolver datos
      console.log(`Comparación ${comparisonId} enviada exitosamente al usuario ${userId}`);
      return res.json(comparison);
    } catch (error) {
      console.error(`Error procesando solicitud de comparación:`, error);
      return res.status(500).json({
        message: `Error al obtener la comparación: ${
          error instanceof Error ? error.message : String(error)
        }`,
      });
    }
  });

  // Save a comparison result
  app.post("/api/comparisons/save", async (req: Request, res: Response) => {
    try {
      const { comparisonId } = req.body;
      if (!comparisonId) {
        return res.status(400).json({
          message: "Comparison ID is required",
        });
      }

      // For now, we'll just return success since comparisons are already saved
      // In a real implementation, this might save a comparison to a "favorites" or make it permanent
      return res.json({
        message: "Comparison saved successfully",
        success: true,
      });
    } catch (error) {
      console.error("Error saving comparison:", error);
      return res.status(500).json({
        message: `Error saving comparison: ${
          error instanceof Error ? error.message : String(error)
        }`,
      });
    }
  });

  // Export comparison to PDF or Excel
  app.get(
    "/api/comparisons/:id/export",
    async (req: Request, res: Response) => {
      try {
        const comparisonId = parseInt(req.params.id);
        if (isNaN(comparisonId)) {
          return res.status(400).json({
            message: "Invalid comparison ID",
          });
        }

        const format = req.query.format as string;
        if (!format || !["pdf", "excel"].includes(format)) {
          return res.status(400).json({
            message: "Invalid export format. Use 'pdf' or 'excel'",
          });
        }

        const comparison = await storage.getComparison(comparisonId);
        if (!comparison) {
          return res.status(404).json({
            message: "Comparison not found",
          });
        }

        if (format === "pdf") {
          const pdfBuffer = await exportToPdf(comparison);
          res.setHeader("Content-Type", "application/pdf");
          res.setHeader(
            "Content-Disposition",
            `attachment; filename=comparison-${comparisonId}.pdf`
          );
          return res.send(pdfBuffer);
        } else {
          const excelBuffer = await exportToExcel(comparison);
          res.setHeader(
            "Content-Type",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          );
          res.setHeader(
            "Content-Disposition",
            `attachment; filename=comparison-${comparisonId}.xlsx`
          );
          return res.send(excelBuffer);
        }
      } catch (error) {
        console.error("Error exporting comparison:", error);
        return res.status(500).json({
          message: `Error exporting comparison: ${
            error instanceof Error ? error.message : String(error)
          }`,
        });
      }
    }
  );

  return httpServer;
}

// Process files in the background with pair-based processing
async function processFiles(
  invoiceFiles: Express.Multer.File[],
  deliveryOrderFiles: Express.Multer.File[],
  userId?: number
): Promise<void> {
  const ocrService = getOcrService();
  const matcherService = getMatcherService();
  const allTempFiles: string[] = [];
  
  try {
    // Determinar el número de pares a procesar
    const numPairs = Math.min(invoiceFiles.length, deliveryOrderFiles.length);
    console.log(`Procesando ${numPairs} pares de documentos independientes`);
    
    // Iterar sobre cada par (invoice, deliveryOrder)
    for (let i = 0; i < numPairs; i++) {
      // Verificar si el procesamiento fue cancelado
      if (!processingState.isProcessing) {
        console.log("Procesamiento cancelado, deteniendo el bucle");
        break;
      }
      
      const invoiceFile = invoiceFiles[i];
      const deliveryFile = deliveryOrderFiles[i];
      
      console.log(`\n=== Procesando par ${i + 1}/${numPairs} ===`);
      console.log(`Factura: ${invoiceFile.originalname}`);
      console.log(`Orden de entrega: ${deliveryFile.originalname}`);
      
      // **Crear sesión independiente para este par específico**
      console.log(`Creando nueva sesión independiente para par ${i + 1}: ${invoiceFile.originalname} + ${deliveryFile.originalname}`);
      
      // Forzar creación de sesión única para este par específico
      const session = await storage.createSession(
        invoiceFile.originalname,
        deliveryFile.originalname,
        userId
      );
      const sessionId = session.id;
      console.log(`NUEVA SESIÓN INDEPENDIENTE CREADA - ID: ${sessionId} para par ${i + 1} (${invoiceFile.originalname} + ${deliveryFile.originalname})`);
      
      // **Actualizar estado (Inicio OCR Par)**
      // Marcar archivos como "processing"
      const invoiceFileEntry = processingState.files.find(f => f.name === invoiceFile.originalname && f.type === "invoice");
      const deliveryFileEntry = processingState.files.find(f => f.name === deliveryFile.originalname && f.type === "deliveryOrder");
      
      if (invoiceFileEntry) invoiceFileEntry.status = "processing";
      if (deliveryFileEntry) deliveryFileEntry.status = "processing";
      
      processingState.currentOcrFile = invoiceFile.originalname;
      
      try {
        // **OCR Factura**
        console.log(`OCR: Procesando factura ${invoiceFile.originalname}`);
        const invoiceOcrResult = await ocrService.extractText(invoiceFile.path);
        
        if (invoiceOcrResult.error) {
          throw new Error(`OCR error en factura: ${invoiceOcrResult.error}`);
        }
        
        const invoiceText = invoiceOcrResult.text;
        
        // Actualizar progreso OCR (archivos OCR completados / total archivos en lote * 100)
        const ocrCompletedFiles = (i * 2) + 1; // 2 archivos por par, +1 por la factura actual
        const totalFilesInBatch = numPairs * 2;
        processingState.ocrProgress = Math.floor((ocrCompletedFiles / totalFilesInBatch) * 100);
        
        if (invoiceFileEntry) invoiceFileEntry.status = "completed";
        
        // **OCR Orden de Entrega**
        processingState.currentOcrFile = deliveryFile.originalname;
        console.log(`OCR: Procesando orden de entrega ${deliveryFile.originalname}`);
        const deliveryOcrResult = await ocrService.extractText(deliveryFile.path);
        
        if (deliveryOcrResult.error) {
          throw new Error(`OCR error en orden de entrega: ${deliveryOcrResult.error}`);
        }
        
        const deliveryText = deliveryOcrResult.text;
        
        // Actualizar progreso OCR final para este par
        const ocrCompletedFilesAfterDelivery = (i * 2) + 2;
        processingState.ocrProgress = Math.floor((ocrCompletedFilesAfterDelivery / totalFilesInBatch) * 100);
        
        if (deliveryFileEntry) deliveryFileEntry.status = "completed";
        processingState.currentOcrFile = undefined;
        
        // **Actualizar estado (Inicio AI Par)**
        const aiStartedPairs = i; // Pares de AI iniciados
        processingState.aiProgress = Math.floor((aiStartedPairs / numPairs) * 10);
        processingState.currentAiStage = `Analizando par ${i + 1}/${numPairs}`;
        
        // **Comparación AI**
        console.log(`IA: Comparando documentos del par ${i + 1}`);
        const comparisonResult = await matcherService.compareDocuments(
          invoiceText,
          deliveryText,
          invoiceFile.originalname,
          deliveryFile.originalname
        );
        
        // **Actualizar estado (Fin AI Par)**
        const aiCompletedPairs = i + 1;
        processingState.aiProgress = Math.floor((aiCompletedPairs / numPairs) * 100);
        
        // **Guardar Resultado**
        await storage.saveComparisonResult(sessionId, comparisonResult, userId);
        console.log(`Par ${i + 1} guardado exitosamente con sesión ${sessionId}`);
        
        // **Limpieza de Archivos del Par**
        await ocrService.cleanupFiles([invoiceFile.path, deliveryFile.path]);
        
        // Actualizar sesión a completada
        await storage.updateSessionStatus(sessionId, "completed");
        
      } catch (pairError) {
        console.error(`Error procesando par ${i + 1}:`, pairError);
        
        // **Manejo de Errores del Par**
        await storage.updateSessionStatus(sessionId, "error", pairError instanceof Error ? pairError.message : String(pairError));
        
        // Marcar archivos como error
        if (invoiceFileEntry) invoiceFileEntry.status = "error";
        if (deliveryFileEntry) deliveryFileEntry.status = "error";
        
        // Registrar error pero continuar con otros pares
        const errorMessage = pairError instanceof Error ? pairError.message : String(pairError);
        processingState.error = `Error en par ${i + 1}: ${errorMessage}`;
        
        // Limpiar archivos del par con error
        try {
          await ocrService.cleanupFiles([invoiceFile.path, deliveryFile.path]);
        } catch (cleanupError) {
          console.error("Error limpiando archivos del par con error:", cleanupError);
        }
      }
      
      // Agregar archivos a la lista para limpieza final (por si algunos no se limpiaron)
      allTempFiles.push(invoiceFile.path, deliveryFile.path);
    }
    
    // **Finalización del Lote**
    processingState.isProcessing = false;
    
    if (!processingState.error) {
      processingState.ocrProgress = 100;
      processingState.aiProgress = 100;
      processingState.currentAiStage = "Procesamiento completado";
      console.log(`\n=== Lote completado: ${numPairs} pares procesados ===`);
    } else {
      console.log(`\n=== Lote completado con errores ===`);
    }
    
  } catch (error) {
    console.error("Error fatal durante el procesamiento del lote:", error);
    
    // Actualizar estado global
    processingState.isProcessing = false;
    processingState.error = error instanceof Error ? error.message : String(error);
    
    // Limpiar todos los archivos temporales restantes
    if (allTempFiles.length > 0) {
      try {
        await ocrService.cleanupFiles(allTempFiles);
      } catch (cleanupError) {
        console.error("Error en limpieza final de archivos:", cleanupError);
      }
    }
    
    throw error;
  }
}
