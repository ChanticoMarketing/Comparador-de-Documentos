import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { getOcrService } from "./ocr";
import { getMatcherService } from "./matcher";
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
  files: Array<{
    name: string;
    type: "invoice" | "deliveryOrder";
    size: number;
    status: "pending" | "processing" | "completed" | "error";
  }>;
  isProcessing: boolean;
  error?: string;
}

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
        // Check if processing is already in progress
        if (processingState.isProcessing) {
          return res.status(409).json({
            message: "Another processing job is already in progress",
          });
        }

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

        // Reset processing state
        processingState.ocrProgress = 0;
        processingState.aiProgress = 0;
        processingState.files = [];
        processingState.isProcessing = true;
        processingState.error = undefined;

        // Add files to processing state
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

        // Create a new session
        const session = await storage.createSession(
          files.invoices[0].originalname,
          files.deliveryOrders[0].originalname
        );
        processingState.sessionId = session.id;

        // Start processing in the background
        processFiles(files.invoices, files.deliveryOrders, session.id).catch(
          (error) => {
            const errorMsg = error instanceof Error ? error.message : String(error);
            console.error("Error processing files:", errorMsg);
            processingState.isProcessing = false;
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
    
    // Return the current processing state cuando hay procesamiento activo
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

  // Cancel processing
  app.post("/api/processing/cancel", async (req: Request, res: Response) => {
    if (!processingState.isProcessing) {
      return res.status(400).json({
        message: "No processing job is currently running",
      });
    }

    // Update session status if we have one
    if (processingState.sessionId) {
      await storage.updateSessionStatus(
        processingState.sessionId,
        "error",
        "Processing canceled by user"
      );
    }

    // Reset processing state
    processingState.isProcessing = false;
    processingState.ocrProgress = 0;
    processingState.aiProgress = 0;
    processingState.sessionId = undefined;
    
    return res.json({
      message: "Processing canceled successfully",
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
async function processFiles(
  invoiceFiles: Express.Multer.File[],
  deliveryOrderFiles: Express.Multer.File[],
  sessionId: number
): Promise<void> {
  const ocrService = getOcrService();
  const matcherService = getMatcherService();
  const processedFiles: string[] = [];

  try {
    // First, process all files with OCR
    const totalFiles = invoiceFiles.length + deliveryOrderFiles.length;
    let processedFileCount = 0;

    // Process invoice files
    let invoiceText = "";
    for (const file of invoiceFiles) {
      // Update processing state
      const fileIndex = processingState.files.findIndex(
        (f) => f.name === file.originalname && f.type === "invoice"
      );
      if (fileIndex !== -1) {
        processingState.files[fileIndex].status = "processing";
      }
      processingState.currentOcrFile = file.originalname;

      // Process the file
      console.log(`Procesando archivo de factura: ${file.originalname} (${file.path})`);
      const { text, error } = await ocrService.extractText(
        file.path
      );
      
      if (error) {
        console.error(`Error en OCR para el archivo ${file.originalname}: ${error}`);
        throw new Error(`OCR error: ${error}`);
      }
      
      console.log(`Texto extraído de la factura ${file.originalname}: ${text.substring(0, 100)}...`);

      // Update processed text
      invoiceText += text + "\n\n";

      // Update processing state
      processedFileCount++;
      processingState.ocrProgress = Math.floor(
        (processedFileCount / totalFiles) * 100
      );
      if (fileIndex !== -1) {
        processingState.files[fileIndex].status = "completed";
      }
      processedFiles.push(file.path);
    }

    // Process delivery order files
    let deliveryOrderText = "";
    for (const file of deliveryOrderFiles) {
      // Update processing state
      const fileIndex = processingState.files.findIndex(
        (f) => f.name === file.originalname && f.type === "deliveryOrder"
      );
      if (fileIndex !== -1) {
        processingState.files[fileIndex].status = "processing";
      }
      processingState.currentOcrFile = file.originalname;

      // Process the file
      console.log(`Procesando archivo de orden de entrega: ${file.originalname} (${file.path})`);
      const { text, error } = await ocrService.extractText(
        file.path
      );
      
      if (error) {
        console.error(`Error en OCR para el archivo ${file.originalname}: ${error}`);
        throw new Error(`OCR error: ${error}`);
      }
      
      console.log(`Texto extraído de orden de entrega ${file.originalname}: ${text.substring(0, 100)}...`);

      // Update processed text
      deliveryOrderText += text + "\n\n";

      // Update processing state
      processedFileCount++;
      processingState.ocrProgress = Math.floor(
        (processedFileCount / totalFiles) * 100
      );
      if (fileIndex !== -1) {
        processingState.files[fileIndex].status = "completed";
      }
      processedFiles.push(file.path);
    }

    // Start AI analysis
    processingState.aiProgress = 5;
    
    // Iniciar una simulación de progreso gradual mientras se procesa el análisis real
    // Esto proporciona feedback visual al usuario mientras el proceso real ocurre
    let currentProgress = 5;
    const progressInterval = setInterval(() => {
      // Incrementar gradualmente hasta 70% mientras el análisis real ocurre
      if (currentProgress < 70) {
        currentProgress += 5;
        processingState.aiProgress = currentProgress;
        console.log(`Actualizando progreso de IA simulado: ${currentProgress}%`);
      }
    }, 1000);
    
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
      clearInterval(progressInterval);
      
      // Update AI progress to near complete
      processingState.aiProgress = 90;
    } catch (error) {
      // Detener la simulación de progreso en caso de error
      clearInterval(progressInterval);
      throw error;
    }

    if (comparisonResult) {
      // Save comparison result
      await storage.saveComparisonResult(sessionId, comparisonResult);
    } else {
      throw new Error("No se pudo generar el resultado de la comparación");
    }

    // Update AI progress to complete
    processingState.aiProgress = 100;

    // Update session status
    await storage.updateSessionStatus(sessionId, "completed");

    // Clean up processed files
    await ocrService.cleanupFiles(processedFiles);

    // Reset processing state
    processingState.isProcessing = false;
  } catch (error) {
    console.error("Error processing files:", error);
    
    // Update processing state to indicate error
    processingState.isProcessing = false;
    processingState.error = error instanceof Error ? error.message : String(error);
    
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
    
    throw error;
  }
}
