// Imports
import fs from "fs";
import path from "path";
import os from "os";
import { v4 as uuidv4 } from "uuid";
import dotenv from "dotenv";
import { Storage } from "@google-cloud/storage";
import { ImageAnnotatorClient } from "@google-cloud/vision";

dotenv.config();

const visionClient = new ImageAnnotatorClient();
const storage = new Storage();

interface VisionGcsFileJson {
  responses?: Array<{
    fullTextAnnotation?: { text?: string };
    textAnnotations?: Array<{ description?: string }>;
    [k: string]: any;
  }>;
  [k: string]: any;
}

export class GoogleVisionOcrService {
  private tempDir: string;
  private bucketName: string;

  constructor(bucketName: string, tempDir?: string) {
    this.bucketName = bucketName;
    this.tempDir = tempDir || path.join(os.tmpdir(), "ocr-matcher");

    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
      try {
        fs.chmodSync(this.tempDir, 0o777);
      } catch (e) {
        console.warn("No se pudieron establecer permisos en dir temporal OCR:", e);
      }
    }
    console.log("Directorio temporal OCR:", this.tempDir);
  }

  /**
   * Extrae texto de un PDF usando Google Vision (asyncBatchAnnotateFiles)
   * 1) Sube el PDF a GCS
   * 2) Ejecuta Vision async
   * 3) Lee los JSONs de salida desde GCS
   * 4) Concatena el texto
   */
  async extractText(localPdfPath: string): Promise<{ text: string; error?: string }> {
    try {
      console.log("Procesando archivo:", localPdfPath);

      if (!fs.existsSync(localPdfPath)) {
        const msg = `El archivo no existe: ${localPdfPath}`;
        console.error(msg);
        return { text: "", error: msg };
      }

      const jobId = uuidv4();
      const basename = path.basename(localPdfPath);
      const inputObject = `inputs/${jobId}-${basename}`;
      const outputPrefix = `outputs/${jobId}/`;

      // 1) Subir a GCS
      await this.uploadLocalFileToGCS(this.bucketName, inputObject, localPdfPath);
      const gcsSourceUri = `gs://${this.bucketName}/${inputObject}`;
      const gcsDestinationUri = `gs://${this.bucketName}/${outputPrefix}`;

      // 2) Ejecutar Vision
      const request = {
        requests: [
          {
            inputConfig: {
              mimeType: "application/pdf",
              gcsSource: { uri: gcsSourceUri },
            },
            features: [{ type: "DOCUMENT_TEXT_DETECTION" as const }],
            outputConfig: {
              gcsDestination: { uri: gcsDestinationUri },
            },
          },
        ],
      };

      const [operation] = await visionClient.asyncBatchAnnotateFiles(request);
      const [filesResponse] = await operation.promise();
      const destinationUri = filesResponse.responses?.[0]?.outputConfig?.gcsDestination?.uri;
      console.log("JSON(s) guardados en:", destinationUri || gcsDestinationUri);

      // 3) Listar y descargar JSONs de salida
      const texts: string[] = [];
      const [files] = await storage.bucket(this.bucketName).getFiles({ prefix: outputPrefix });
      if (!files.length) {
        return { text: "", error: "No se encontraron archivos JSON de salida en GCS." };
      }

      for (const f of files) {
        if (!f.name.toLowerCase().endsWith(".json")) continue;
        const [buf] = await f.download();
        const json = JSON.parse(buf.toString("utf8")) as VisionGcsFileJson | { responses?: VisionGcsFileJson[] };

        // El JSON de asyncBatchAnnotateFiles suele venir como { responses: [ { responses: [...] } ] } o directamente { responses: [...] }
        const innerResponses =
          Array.isArray((json as any).responses?.[0]?.responses)
            ? (json as any).responses[0].responses
            : (json as any).responses;

        if (Array.isArray(innerResponses)) {
          for (const r of innerResponses) {
            const full = r.fullTextAnnotation?.text?.trim();
            if (full) {
              texts.push(full);
            } else if (Array.isArray(r.textAnnotations) && r.textAnnotations[0]?.description) {
              texts.push((r.textAnnotations[0].description || "").trim());
            }
          }
        }
      }

      const finalText = texts.join("\n\n").trim();
      if (!finalText) {
        console.warn("No se pudo extraer texto de los JSONs de salida.");
        return { text: "", error: "OCR sin texto útil en salida." };
      }

      console.log(`Texto extraído exitosamente (${finalText.length} caracteres)`);
      return { text: finalText };
    } catch (error) {
      console.error("OCR extraction error:", error);
      return {
        text: "",
        error: `OCR Error: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  async splitPdf(filePath: string): Promise<string[]> {
    // Placeholder: si necesitaras dividir PDFs localmente
    return [filePath];
  }

  async saveFile(buffer: Buffer, originalFilename: string): Promise<string> {
    const filename = `${uuidv4()}-${originalFilename}`;
    const filePath = path.join(this.tempDir, filename);
    await fs.promises.writeFile(filePath, buffer);
    return filePath;
  }

  async cleanupFiles(filePaths: string[]): Promise<void> {
    for (const filePath of filePaths) {
      try {
        if (fs.existsSync(filePath)) {
          await fs.promises.unlink(filePath);
          console.log(`Archivo temporal eliminado: ${filePath}`);
        } else {
          console.warn(`No existe: ${filePath}`);
        }
      } catch (e) {
        console.error(`Error al eliminar ${filePath}:`, e instanceof Error ? e.message : String(e));
      }
    }
  }

  private async uploadLocalFileToGCS(bucketName: string, objectName: string, localPath: string): Promise<void> {
    await storage.bucket(bucketName).upload(localPath, {
      destination: objectName,
      resumable: true,
      gzip: false,
      contentType: "application/pdf",
      public: false,
    });
    console.info(`Subido a gs://${bucketName}/${objectName}`);
  }
}

// Factory limpio (sin MISTRAL_KEY)
export function getGoogleVisionOcrService(): GoogleVisionOcrService {
  const bucketName = process.env.BUCKET_NAME || "";
  if (!bucketName) console.warn("BUCKET_NAME no está configurado");
  return new GoogleVisionOcrService(bucketName);
}

export default getGoogleVisionOcrService;
