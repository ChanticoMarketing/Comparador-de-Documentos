// Imports
import axios from "axios";
import FormData from "form-data";
import { Readable } from "stream";
import fs from "fs";
import path from "path";
import util from "util";
import { pipeline } from "stream";
import { v4 as uuidv4 } from "uuid";
import os from "os";
import dotenv from 'dotenv';

import { normalizeProductString } from "./utils";

dotenv.config();

// Promisify pipeline for easier use with async/await
const streamPipeline = util.promisify(pipeline);

// Define interfaces for API responses
interface API4AIErrorResponse {
  message: string;
  code?: string;
  [key: string]: any;
}

interface API4AISuccessResponse {
  results: {
    text_blocks: Array<{
      text: string;
      confidence?: number;
      box?: number[];
      [key: string]: any;
    }>;
    [key: string]: any;
  };
  [key: string]: any;
}

/**
 * OCR service that handles extracting text from documents using API4AI
 */
export class OcrService {
  private apiKey: string;
  private tempDir: string;

  constructor(apiKey: string, tempDir?: string) {
    this.apiKey = apiKey;
    this.tempDir = tempDir || path.join(os.tmpdir(), "ocr-matcher");
    
    // Create temp directory if it doesn't exist
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
      
      // En Replit, aseguramos que el directorio tenga permisos adecuados
      try {
        fs.chmodSync(this.tempDir, 0o777);
      } catch (error) {
        console.warn("No se pudieron establecer permisos en directorio temporal OCR:", error);
      }
    }
    
    console.log("Directorio temporal OCR:", this.tempDir);
  }

  /**
   * Extract text from a document using OCR
   * @param filePath Path to document file
   * @returns Extracted text and structured document data
   */
  async extractText(filePath: string): Promise<{
    text: string;
    error?: string;
  }> {
    try {
      console.log("Procesando archivo:", filePath);
      
      // Verificar que el archivo existe
      if (!fs.existsSync(filePath)) {
        console.error(`El archivo ${filePath} no existe`);
        return {
          text: "",
          error: `El archivo no existe o no es accesible: ${filePath}`,
        };
      }

      const form = new FormData();
      
      try {
        const fileBuffer = fs.readFileSync(filePath);
        form.append("image", fileBuffer, path.basename(filePath));
      } catch (readError: unknown) {
        const errorMessage = readError instanceof Error ? readError.message : String(readError);
        console.error("Error al leer el archivo:", errorMessage);
        return {
          text: "",
          error: `Error al leer el archivo: ${errorMessage}`,
        };
      }

      console.log("Enviando archivo a API4AI OCR...");
      
      // Make API call to API4AI OCR service
      const response = await axios({
        method: "post",
        url: "https://ocr43.p.rapidapi.com/v1/results",
        data: form,
        headers: {
          "x-rapidapi-key": this.apiKey,
          "x-rapidapi-host": "ocr43.p.rapidapi.com",
          "Content-Type": "multipart/form-data"
        },
      });

      const result = await response.data as API4AIErrorResponse | API4AISuccessResponse;

      if (!response.status) {
        console.error("API4AI OCR error:", result);
        return {
          text: "",
          error: `API4AI Error: ${(result as API4AIErrorResponse)?.message || "Unknown error"}`,
        };
      }

      // Process the response to extract text and structured data
      const newRawText = newExtractRawText(result); 
      
      return {
        text: newRawText,
      };
    } catch (error) {
      console.error("OCR extraction error:", error);
      return {
        text: "",
        error: `OCR Error: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * Split a PDF file into individual pages for processing
   * @param filePath Path to PDF file
   * @returns Array of paths to individual page files
   */
  async splitPdf(filePath: string): Promise<string[]> {
    try {
      // For now, we'll use a simple approach since we don't have access to PDF libraries
      // In a real implementation, you'd use a library like pdf-lib or pdf.js
      
      // Mock implementation that just returns the original file
      // In a real implementation, this would extract individual pages
      return [filePath];
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error("PDF split error:", errorMessage);
      throw new Error(`Failed to split PDF: ${errorMessage}`);
    }
  }

  /**
   * Save a file from a buffer to the temporary directory
   * @param buffer File buffer
   * @param originalFilename Original filename
   * @returns Path to saved file
   */
  async saveFile(buffer: Buffer, originalFilename: string): Promise<string> {
    const filename = `${uuidv4()}-${originalFilename}`;
    const filePath = path.join(this.tempDir, filename);
    
    await fs.promises.writeFile(filePath, buffer);
    return filePath;
  }

  /**
   * Clean up temporary files
   * @param filePaths Array of file paths to delete
   */
  async cleanupFiles(filePaths: string[]): Promise<void> {
    for (const filePath of filePaths) {
      try {
        // Verificar que el archivo existe antes de intentar eliminarlo
        if (fs.existsSync(filePath)) {
          await fs.promises.unlink(filePath);
          console.log(`Archivo temporal eliminado: ${filePath}`);
        } else {
          console.warn(`El archivo ${filePath} no existe, no se puede eliminar`);
        }
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`Error al eliminar archivo ${filePath}: ${errorMessage}`);
      }
    }
  }
}

function newExtractRawText(result: any): string {
  let fullText = '';
  
  // Para API4AI OCR, el texto se encuentra en la estructura: results.text_blocks[].text
  if (result.results?.text_blocks) {
    console.log("Procesando texto extraído usando formato text_blocks standard");
    result.results.text_blocks.forEach((block: any) => {
      if (block.text) {
        fullText += normalizeProductString(block.text) + '\n';
      }
    });
  }
  // Formato alternativo: results[].entities[].objects[].entities[].text
  else if (Array.isArray(result.results)) {
    console.log("Procesando texto extraído usando formato alternativo");
    (result.results as any[])?.forEach((page: any) => {
      (page.entities as any[])?.forEach((entity: any) => {
        (entity.objects as any[])?.forEach((obj: any) => {
          (obj.entities as any[])?.forEach((innerEntity: any) => {
            if (innerEntity.text) {
              fullText += normalizeProductString(innerEntity.text) + '\n';
            }
          });
        });
      });
    });
  }

  const trimmedText = fullText.trim();
  
  // Agregar log para verificar si se extrajo texto
  if (!trimmedText) {
    console.warn("No se pudo extraer texto del documento. Respuesta:", JSON.stringify(result).substring(0, 500) + "...");
  } else {
    console.log(`Texto extraído exitosamente (${trimmedText.length} caracteres)`);
  }
  
  return trimmedText;
}

// Export a factory function to get an OCR service instance
export function getOcrService(): OcrService {
  const apiKey = process.env.API4AI_KEY || '';
  if (!apiKey) {
    console.warn("API4AI_KEY environment variable is not set");
  }
  return new OcrService(apiKey);
}

export default getOcrService;
