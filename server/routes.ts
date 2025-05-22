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
}

// Ahora mantenemos un registro de múltiples bloques de procesamiento
const processingBlocks: Record<string, ProcessingState> = {};

// Estado principal para compatibilidad con código existente
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

        // Obtener el ID del bloque de comparación (si existe)
        const blockId = req.body.blockId || `block-${Date.now()}`;
        console.log(`Procesando bloque de comparación: ${blockId}`);

        // Verificar si este bloque específico ya está en procesamiento
        if (processingBlocks[blockId] && processingBlocks[blockId].isProcessing) {
          return res.status(409).json({
            message: `El bloque '${blockId}' ya está siendo procesado`,
          });
        }

        // Crear un nuevo estado de procesamiento para este bloque
        const blockState: ProcessingState = {
          ocrProgress: 0,
          aiProgress: 0,
          files: [],
          isProcessing: true,
          error: undefined,
          blockId: blockId,
        };

        // Agregar archivos al estado de procesamiento del bloque
        files.invoices.forEach((file) => {
          blockState.files.push({
            name: file.originalname,
            type: "invoice",
            size: file.size,
            status: "pending",
          });
        });

        files.deliveryOrders.forEach((file) => {
          blockState.files.push({
            name: file.originalname,
            type: "deliveryOrder",
            size: file.size,
            status: "pending",
          });
        });

        // Registrar el bloque en la colección de bloques
        processingBlocks[blockId] = blockState;

        // Actualizar el estado principal para compatibilidad con código existente
        Object.assign(processingState, blockState);

        // Obtener el ID del usuario si está autenticado
        const userId = getUserId(req as AuthRequest) || undefined;
        
        // Create a new session
        const session = await storage.createSession(
          files.invoices[0].originalname,
          files.deliveryOrders[0].originalname,
          userId
        );
        blockState.sessionId = session.id;
        processingState.sessionId = session.id;

        // Start processing in the background
        processFiles(files.invoices, files.deliveryOrders, session.id, blockId).catch(
          (error) => {
            const errorMsg = error instanceof Error ? error.message : String(error);
            console.error(`Error processing files for block ${blockId}:`, errorMsg);
            
            if (processingBlocks[blockId]) {
              processingBlocks[blockId].isProcessing = false;
              processingBlocks[blockId].error = `Error processing files: ${errorMsg}`;
            }
            
            // Actualizar el estado principal si corresponde al bloque actual
            if (processingState.blockId === blockId) {
              processingState.isProcessing = false;
              processingState.error = `Error processing files: ${errorMsg}`;
            }
            processingState.error = `Error processing files: ${errorMsg}`;
            // Update session status to error
            storage.updateSessionStatus(
              session.id,
              "error",
              errorMsg
            ).catch((err) => {
              const errMsg = err instanceof Error ? err.message : String(err);
              console.error("Error updating session status:", errMsg);
            });
          }
        );

        return res.status(202).json({
          message: "Files uploaded successfully, processing started",
          sessionId: session.id,
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
    // Verificar si hay un blockId en la consulta
    const blockId = req.query.blockId as string;
    
    if (blockId) {
      // Si se especifica un blockId, devolver el estado de ese bloque específico
      const blockState = processingBlocks[blockId];
      
      if (!blockState || !blockState.isProcessing) {
        return res.json({
          ocrProgress: 0,
          aiProgress: 0,
          isProcessing: false,
          files: [],
        });
      }
      
      // Devolver el estado del bloque específico
      return res.json({
        ocrProgress: blockState.ocrProgress,
        aiProgress: blockState.aiProgress,
        currentOcrFile: blockState.currentOcrFile,
        files: blockState.files,
        isProcessing: blockState.isProcessing,
        error: blockState.error,
        blockId: blockId,
      });
    }
    
    // Si no se especifica un blockId, devolvemos el estado principal o global
    
    // Verificar si hay bloques activos (para el panel principal)
    const activeBlocks = Object.values(processingBlocks).filter(block => block.isProcessing);
    
    if (activeBlocks.length > 0) {
      // Si hay bloques activos, devolver información resumida
      return res.json({
        ocrProgress: processingState.ocrProgress,
        aiProgress: processingState.aiProgress,
        currentOcrFile: processingState.currentOcrFile,
        files: processingState.files,
        isProcessing: processingState.isProcessing || activeBlocks.length > 0,
        error: processingState.error,
        activeBlocksCount: activeBlocks.length,
        blockIds: Object.keys(processingBlocks).filter(id => processingBlocks[id].isProcessing),
      });
    }
    
    // Limpiamos el estado cuando no hay procesamiento activo
    if (!processingState.isProcessing) {
      // Si no hay procesamiento activo, enviamos un estado limpio
      const cleanStatus: ProcessingStatus = {
        ocrProgress: 0,
        aiProgress: 0,
        isProcessing: false,
        files: [], // No mostramos archivos cuando no hay procesamiento
      };
      return res.json(cleanStatus);
    }
    
    // Return the current processing state cuando hay procesamiento activo principal
    const status: ProcessingStatus = {
      ocrProgress: processingState.ocrProgress,
      aiProgress: processingState.aiProgress,
      currentOcrFile: processingState.currentOcrFile,
      files: processingState.files,
      isProcessing: processingState.isProcessing,
      error: processingState.error,
    };
    return res.json(status);
  });

  // Cancel processing - supports specific block cancellation or all blocks
  app.post("/api/processing/cancel", async (req: Request, res: Response) => {
    // Verificar si se especifica un blockId para cancelar un bloque específico
    const blockId = req.query.blockId as string;
    
    if (blockId) {
      // Cancelar un bloque específico
      if (!processingBlocks[blockId] || !processingBlocks[blockId].isProcessing) {
        return res.status(400).json({
          message: `No hay procesamiento activo para el bloque ${blockId}`,
        });
      }
      
      // Actualizar el estado de la sesión si existe
      if (processingBlocks[blockId].sessionId) {
        await storage.updateSessionStatus(
          processingBlocks[blockId].sessionId,
          "error",
          "Procesamiento cancelado por el usuario"
        );
      }
      
      // Resetear el estado del bloque
      processingBlocks[blockId].isProcessing = false;
      processingBlocks[blockId].ocrProgress = 0;
      processingBlocks[blockId].aiProgress = 0;
      
      console.log(`Bloque de procesamiento ${blockId} cancelado correctamente`);
      
      // Si este bloque también es el estado principal actual, restablecer ese también
      if (processingState.blockId === blockId) {
        processingState.isProcessing = false;
        processingState.ocrProgress = 0;
        processingState.aiProgress = 0;
        processingState.sessionId = undefined;
      }
      
      // Eliminar el bloque del registro
      delete processingBlocks[blockId];
      
      return res.json({
        message: `Procesamiento del bloque ${blockId} cancelado correctamente`,
        success: true,
      });
    } else {
      // Cancelación global de todos los procesamientos
      if (!processingState.isProcessing && Object.values(processingBlocks).filter(b => b.isProcessing).length === 0) {
        return res.status(400).json({
          message: "No hay ningún procesamiento activo en este momento",
        });
      }
      
      // Cancelar todos los bloques activos
      Object.keys(processingBlocks).forEach(id => {
        if (processingBlocks[id].isProcessing) {
          // Actualizar sesión si existe
          if (processingBlocks[id].sessionId) {
            storage.updateSessionStatus(
              processingBlocks[id].sessionId,
              "error",
              "Procesamiento cancelado por el usuario"
            ).catch(error => {
              console.error(`Error al actualizar estado de sesión para bloque ${id}:`, error);
            });
          }
          
          // Eliminar el bloque
          delete processingBlocks[id];
        }
      });
      
      // Actualizar el estado principal si está activo
      if (processingState.isProcessing) {
        // Actualizar el estado de la sesión si existe
        if (processingState.sessionId) {
          await storage.updateSessionStatus(
            processingState.sessionId,
            "error",
            "Processing canceled by user"
          );
        }
        
        // Resetear estado principal
        processingState.isProcessing = false;
        processingState.ocrProgress = 0;
        processingState.aiProgress = 0;
        processingState.sessionId = undefined;
      }
      
      console.log("Todos los procesamientos cancelados correctamente");
      
      return res.json({
        message: "Procesamiento cancelado correctamente",
        success: true,
      });
    }
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

  // Get a specific comparison result
  app.get("/api/comparisons/:id", async (req: Request, res: Response) => {
    try {
      const comparisonId = parseInt(req.params.id);
      if (isNaN(comparisonId)) {
        return res.status(400).json({
          message: "Invalid comparison ID",
        });
      }

      const comparison = await storage.getComparison(comparisonId);
      if (!comparison) {
        return res.status(404).json({
          message: "Comparison not found",
        });
      }

      return res.json(comparison);
    } catch (error) {
      console.error("Error fetching comparison:", error);
      return res.status(500).json({
        message: `Error fetching comparison: ${
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

// Process files in the background
// Declaración de la función modificada para aceptar blockId opcional
async function processFiles(
  invoiceFiles: Express.Multer.File[],
  deliveryOrderFiles: Express.Multer.File[],
  sessionId: number,
  blockId?: string
): Promise<void> {
  const ocrService = getOcrService();
  const matcherService = getMatcherService();
  const processedFiles: string[] = [];
  
  // Determinar qué estado de procesamiento usar: el del bloque específico o el global
  const state = blockId && processingBlocks[blockId] 
    ? processingBlocks[blockId] 
    : processingState;

  try {
    // First, process all files with OCR
    const totalFiles = invoiceFiles.length + deliveryOrderFiles.length;
    let processedFileCount = 0;
    
    // Iniciar simulación de progreso OCR intermedio para proporcionar feedback
    // durante el procesamiento de cada archivo (ya que puede tomar tiempo)
    const updateOcrProgressGradually = (fileStartPercent: number, fileEndPercent: number) => {
      let currentProgress = fileStartPercent;
      const progressInterval = setInterval(() => {
        // Incrementar gradualmente hasta casi el final del archivo
        if (currentProgress < fileEndPercent - 5) {
          currentProgress += 3;
          state.ocrProgress = Math.min(currentProgress, 99); // Nunca llegar a 100 hasta completar realmente
          console.log(`Actualizando progreso de OCR simulado: ${state.ocrProgress}% para bloque ${blockId || "principal"}`);
        } else {
          clearInterval(progressInterval);
        }
      }, 800);
      
      return () => {
        clearInterval(progressInterval);
      };
    };

    // Process invoice files
    let invoiceText = "";
    for (let i = 0; i < invoiceFiles.length; i++) {
      const file = invoiceFiles[i];
      // Update processing state
      const fileIndex = state.files.findIndex(
        (f) => f.name === file.originalname && f.type === "invoice"
      );
      if (fileIndex !== -1) {
        state.files[fileIndex].status = "processing";
      }
      state.currentOcrFile = file.originalname;
      
      // Calcular el progreso inicial y final para este archivo
      const fileStartPercent = Math.floor((processedFileCount / totalFiles) * 100);
      const fileEndPercent = Math.floor(((processedFileCount + 1) / totalFiles) * 100);
      state.ocrProgress = fileStartPercent;
      
      // Iniciar simulación de progreso para este archivo
      const stopProgress = updateOcrProgressGradually(fileStartPercent, fileEndPercent);

      // Process the file
      console.log(`Procesando archivo de factura: ${file.originalname} (${file.path}) para bloque ${blockId || "principal"}`);
      const { text, error } = await ocrService.extractText(
        file.path
      );
      
      // Detener la simulación de progreso
      stopProgress();
      
      if (error) {
        console.error(`Error en OCR para el archivo ${file.originalname}: ${error}`);
        throw new Error(`OCR error: ${error}`);
      }
      
      console.log(`Texto extraído de la factura ${file.originalname}: ${text.substring(0, 100)}...`);

      // Update processed text
      invoiceText += text + "\n\n";

      // Update processing state
      processedFileCount++;
      state.ocrProgress = fileEndPercent;
      if (fileIndex !== -1) {
        state.files[fileIndex].status = "completed";
      }
      processedFiles.push(file.path);
    }

    // Process delivery order files
    let deliveryOrderText = "";
    for (let i = 0; i < deliveryOrderFiles.length; i++) {
      const file = deliveryOrderFiles[i];
      // Update processing state
      const fileIndex = state.files.findIndex(
        (f) => f.name === file.originalname && f.type === "deliveryOrder"
      );
      if (fileIndex !== -1) {
        state.files[fileIndex].status = "processing";
      }
      state.currentOcrFile = file.originalname;
      
      // Calcular el progreso inicial y final para este archivo
      const fileStartPercent = Math.floor((processedFileCount / totalFiles) * 100);
      const fileEndPercent = Math.floor(((processedFileCount + 1) / totalFiles) * 100);
      state.ocrProgress = fileStartPercent;
      
      // Iniciar simulación de progreso para este archivo
      const stopProgress = updateOcrProgressGradually(fileStartPercent, fileEndPercent);

      // Process the file
      console.log(`Procesando archivo de orden de entrega: ${file.originalname} (${file.path}) para bloque ${blockId || "principal"}`);
      const { text, error } = await ocrService.extractText(
        file.path
      );
      
      // Detener la simulación de progreso
      stopProgress();
      
      if (error) {
        console.error(`Error en OCR para el archivo ${file.originalname}: ${error}`);
        throw new Error(`OCR error: ${error}`);
      }
      
      console.log(`Texto extraído de orden de entrega ${file.originalname}: ${text.substring(0, 100)}...`);

      // Update processed text
      deliveryOrderText += text + "\n\n";

      // Update processing state
      processedFileCount++;
      state.ocrProgress = fileEndPercent;
      if (fileIndex !== -1) {
        state.files[fileIndex].status = "completed";
      }
      processedFiles.push(file.path);
    }

    // Start AI analysis
    state.aiProgress = 5;
    
    // Define etapas claras del procesamiento de IA para mostrar progreso más detallado
    const aiStages = [
      { stage: "Inicializando análisis de IA", progress: 5 },
      { stage: "Preparando datos para comparación", progress: 15 },
      { stage: "Procesando texto de facturas", progress: 25 },
      { stage: "Procesando texto de órdenes de entrega", progress: 35 },
      { stage: "Extrayendo entidades y cantidades", progress: 45 },
      { stage: "Aplicando análisis semántico", progress: 60 },
      { stage: "Generando comparación detallada", progress: 75 },
      { stage: "Finalizando el análisis", progress: 85 }
    ];
    
    // Crear una función que avance por las etapas de forma gradual y realista
    let currentStageIndex = 0;
    
    // Esta función actualiza el progreso y muestra la etapa actual al usuario
    const updateAiProgressGradually = () => {
      const progressInterval = setInterval(() => {
        if (currentStageIndex < aiStages.length) {
          const currentStage = aiStages[currentStageIndex];
          state.aiProgress = currentStage.progress;
          // Guardar también el nombre de la etapa actual para mostrarla al usuario
          state.currentAiStage = currentStage.stage;
          console.log(`[AI] Etapa: ${currentStage.stage}, Progreso: ${currentStage.progress}% para bloque ${blockId || "principal"}`);
          currentStageIndex++;
        } else {
          clearInterval(progressInterval);
        }
      }, 1200); // Intervalos más largos para que el usuario pueda leer cada etapa
      
      return () => clearInterval(progressInterval);
    };
    
    // Iniciar la simulación de progreso por etapas
    const stopAiProgress = updateAiProgressGradually();
    
    let comparisonResult;
    try {
      // Perform comparison
      comparisonResult = await matcherService.compareDocuments(
        invoiceText,
        deliveryOrderText,
        invoiceFiles[0].originalname,
        deliveryOrderFiles[0].originalname
      );
      
      // Detener la simulación de progreso
      stopAiProgress();
      
      // Update AI progress to near complete
      state.aiProgress = 90;
      state.currentAiStage = "Finalizando y guardando resultados";
    } catch (error) {
      // Detener la simulación de progreso en caso de error
      stopAiProgress();
      throw error;
    }

    if (comparisonResult) {
      // Obtener la sesión para recuperar el userId
      const session = await storage.getSession(sessionId);
      
      // Save comparison result con el userId si está disponible
      await storage.saveComparisonResult(sessionId, comparisonResult, session?.userId || undefined);
    } else {
      throw new Error("No se pudo generar el resultado de la comparación");
    }

    // Update AI progress to complete
    state.aiProgress = 100;

    // Update session status
    await storage.updateSessionStatus(sessionId, "completed");

    // Clean up processed files
    await ocrService.cleanupFiles(processedFiles);

    // Reset processing state
    state.isProcessing = false;
    
    // Si este es un bloque específico, podemos eliminarlo de la colección de bloques
    // después de completar para liberar memoria
    if (blockId && processingBlocks[blockId]) {
      console.log(`Bloque de comparación ${blockId} completado. Eliminando de la memoria.`);
      delete processingBlocks[blockId];
    }
  } catch (error) {
    console.error(`Error processing files for block ${blockId || "principal"}:`, error);
    
    // Update processing state to indicate error
    state.isProcessing = false;
    state.error = error instanceof Error ? error.message : String(error);
    
    // Update session status
    await storage.updateSessionStatus(
      sessionId,
      "error",
      error instanceof Error ? error.message : String(error)
    );
    
    // Clean up processed files
    if (processedFiles.length > 0) {
      ocrService.cleanupFiles(processedFiles).catch((cleanupError) => {
        console.error("Error cleaning up files:", cleanupError);
      });
    }
    
    // Si este es un bloque específico con error, podemos eliminarlo de la colección
    if (blockId && processingBlocks[blockId]) {
      console.log(`Bloque de comparación ${blockId} falló. Eliminando de la memoria.`);
      delete processingBlocks[blockId];
    }
    
    throw error;
  }
}
