import fetch from "node-fetch";
import FormData from "form-data";
import { Readable } from "stream";
import fs from "fs";
import path from "path";
import util from "util";
import { pipeline } from "stream";
import { v4 as uuidv4 } from "uuid";
import os from "os";

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
    }
  }

  /**
   * Extract text from a document using OCR
   * @param filePath Path to document file
   * @returns Extracted text and structured document data
   */
  async extractText(filePath: string): Promise<{
    text: string;
    structuredData: Record<string, any>;
    error?: string;
  }> {
    try {
      const form = new FormData();
      const fileStream = fs.createReadStream(filePath);
      form.append("image", fileStream);

      // Make API call to API4AI OCR service
      const response = await fetch("https://api.api4ai.io/ocr/v1/results", {
        method: "POST",
        body: form,
        headers: {
          "X-Api-Key": this.apiKey,
        },
      });

      const result = await response.json() as API4AIErrorResponse | API4AISuccessResponse;

      if (!response.ok) {
        console.error("API4AI OCR error:", result);
        return {
          text: "",
          structuredData: {},
          error: `API4AI Error: ${(result as API4AIErrorResponse)?.message || "Unknown error"}`,
        };
      }

      // Process the response to extract text and structured data
      const rawText = this.extractRawText(result);
      const structuredData = this.processOcrResult(result);

      return {
        text: rawText,
        structuredData,
      };
    } catch (error) {
      console.error("OCR extraction error:", error);
      return {
        text: "",
        structuredData: {},
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
    } catch (error) {
      console.error("PDF split error:", error);
      throw new Error(`Failed to split PDF: ${error instanceof Error ? error.message : String(error)}`);
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
        await fs.promises.unlink(filePath);
      } catch (error) {
        console.error(`Failed to delete file ${filePath}:`, error);
      }
    }
  }

  /**
   * Extract raw text from OCR API response
   * @param result OCR API response
   * @returns Extracted text
   */
  private extractRawText(result: API4AISuccessResponse): string {
    try {
      // Extract all text blocks from the result and join them
      const textBlocks = result?.results?.text_blocks || [];
      return textBlocks.map((block) => block.text).join("\n");
    } catch (error) {
      console.error("Error extracting raw text:", error);
      return "";
    }
  }

  /**
   * Process OCR result into a structured format
   * @param result OCR API response
   * @returns Structured data extracted from document
   */
  private processOcrResult(result: API4AISuccessResponse): Record<string, any> {
    try {
      const processed: Record<string, any> = {
        lines: [],
        tables: [],
        metadata: {},
      };

      // Process text blocks
      const textBlocks = result?.results?.text_blocks || [];
      
      // Extract potential table data
      const tables = this.extractTables(textBlocks);
      if (tables.length > 0) {
        processed.tables = tables;
      }
      
      // Extract metadata (like dates, invoice numbers, etc.)
      processed.metadata = this.extractMetadata(textBlocks);
      
      // Process remaining text as lines
      processed.lines = textBlocks.map((block: any) => ({
        text: block.text,
        confidence: block.confidence,
        position: block.box,
      }));

      return processed;
    } catch (error) {
      console.error("Error processing OCR result:", error);
      return {};
    }
  }

  /**
   * Extract potential tables from OCR results
   * @param textBlocks Text blocks from OCR
   * @returns Array of extracted tables
   */
  private extractTables(textBlocks: any[]): any[] {
    // This is a simplified version - in a real implementation,
    // you would use more sophisticated algorithms to detect tables
    // based on text alignment, column detection, etc.
    
    // Look for patterns that might indicate table rows
    // For example, lines with consistent separators or column-like structures
    const tables: any[] = [];
    
    // Group blocks by vertical position (y-coordinate)
    // This is a very simplistic approach to find potential table rows
    const rowGroups: Record<number, any[]> = {};
    
    textBlocks.forEach((block: any) => {
      if (!block.box || !block.text) return;
      
      // Use the top y-coordinate as a row identifier, with some tolerance
      const yCoord = Math.floor(block.box[1] / 10) * 10; // Group within 10-pixel bands
      
      if (!rowGroups[yCoord]) {
        rowGroups[yCoord] = [];
      }
      
      rowGroups[yCoord].push({
        text: block.text,
        x: block.box[0],
        y: block.box[1],
        width: block.box[2] - block.box[0],
        height: block.box[3] - block.box[1],
      });
    });
    
    // Sort row groups by y-coordinate
    const sortedRows = Object.entries(rowGroups)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([_, blocks]) => blocks.sort((a, b) => a.x - b.x));
    
    // Check if we have enough rows that look like a table
    if (sortedRows.length >= 3) {
      // Try to identify tables by checking for consistent number of columns
      const potentialTable = {
        rows: sortedRows.map(blocks => blocks.map(block => block.text)),
      };
      
      tables.push(potentialTable);
    }
    
    return tables;
  }

  /**
   * Extract metadata from OCR results
   * @param textBlocks Text blocks from OCR
   * @returns Extracted metadata
   */
  private extractMetadata(textBlocks: any[]): Record<string, string> {
    const metadata: Record<string, string> = {};
    
    // Look for common patterns in invoices and delivery orders
    const patterns = [
      { key: "invoiceNumber", regex: /(?:factura|invoice)[:\s]+(\w+[-\d]+)/i },
      { key: "orderNumber", regex: /(?:pedido|orden|order)[:\s]+(\w+[-\d]+)/i },
      { key: "date", regex: /(?:fecha|date)[:\s]+([\d\/.-]+)/i },
      { key: "totalAmount", regex: /(?:total)[:\s]+([\d.,]+)/i },
      { key: "companyName", regex: /^([A-Z\s.,]+)$/m },
      { key: "taxId", regex: /(?:cif|nif|tax\s*id)[:\s]+([\w-]+)/i },
    ];
    
    // Join all text to help find patterns across blocks
    const fullText = textBlocks.map((block: any) => block.text).join("\n");
    
    // Apply regex patterns to find metadata
    patterns.forEach(({ key, regex }) => {
      const match = fullText.match(regex);
      if (match && match[1]) {
        metadata[key] = match[1].trim();
      }
    });
    
    return metadata;
  }
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
