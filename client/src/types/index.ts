// Types for the application

// Status of a file during OCR/AI processing
export type FileStatus = "pending" | "processing" | "completed" | "error";

// Type of the document
export type FileType = "invoice" | "deliveryOrder";

// Information about a file being processed
export interface ProcessingFile {
  name: string;
  type: FileType;
  size: number;
  status: FileStatus;
}

// Status of the processing operation
export interface ProcessingStatus {
  ocrProgress: number;
  aiProgress: number;
  currentOcrFile?: string;
  currentAiStage?: string; // Etapa actual del procesamiento de IA (para mostrar en la UI)
  files?: ProcessingFile[];
  isProcessing: boolean;  // Indica si hay un procesamiento activo en curso
  error?: string;         // Error opcional si algo salió mal
  blockId?: string;       // Identificador único del bloque de comparación (si aplica)
  activeBlocksCount?: number; // Número de bloques activos en procesamiento
  blockIds?: string[];    // Lista de IDs de bloques activos
}

// Item in the comparison result
export interface ResultItem {
  productName: string;
  invoiceValue: string;
  deliveryOrderValue: string;
  status: "match" | "warning" | "error";
  note?: string;
}

// Metadata in the comparison result
export interface MetadataItem {
  field: string;
  invoiceValue: string;
  deliveryOrderValue: string;
  status: "match" | "warning" | "error";
}

// Summary of the comparison
export interface ResultSummary {
  matches: number;
  warnings: number;
  errors: number;
}

// Complete comparison result
export interface ComparisonResult {
  id: string;
  userId?: number;
  sessionId: number;
  invoiceFilename: string;
  deliveryOrderFilename: string;
  createdAt: string;
  matchCount: number;
  warningCount: number;
  errorCount: number;
  isPermanent?: boolean;
  summary: ResultSummary;
  items: ResultItem[];
  metadata: MetadataItem[];
  rawData?: any;
}

// Session information for the history view
export interface Session {
  id: string;
  createdAt: string;
  invoiceFilename: string;
  deliveryOrderFilename: string;
  matchCount: number;
  warningCount: number;
  errorCount: number;
  userId?: number;
  username?: string; // Nombre de usuario que realizó la comparación
}

// Available tabs in the results view
export type ResultTab = "products" | "metadata" | "json";

// Application settings
export interface Settings {
  api4aiKey: string;
  openaiKey: string;
  openaiModel: string;
  fallbackToMiniModel: boolean;
  autoSaveResults: boolean;
  maxFileSize: number;
}
