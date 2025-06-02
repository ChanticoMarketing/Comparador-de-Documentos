import OpenAI from "openai";
import { OcrService } from "./ocr";
import { ComparisonResult, ResultItem, MetadataItem } from "../client/src/types";
import dotenv from 'dotenv';

dotenv.config();

/**
 * Service for comparing invoices against delivery orders using AI
 */
export class MatcherService {
  private openai: OpenAI;
  private primaryModel: string;
  private fallbackModel: string;
  private useFallback: boolean;

  constructor(
    apiKey: string,
    primaryModel = "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
    fallbackModel = "gpt-4o-mini",
    useFallback = true
  ) {
    this.openai = new OpenAI({ apiKey: apiKey });
    this.primaryModel = primaryModel;
    this.fallbackModel = fallbackModel;
    this.useFallback = useFallback;
  }

  /**
   * Compare invoice text with delivery order text using AI
   * @param invoiceText Text extracted from invoice
   * @param deliveryOrderText Text extracted from delivery order
   * @param invoiceStructured Structured data from invoice
   * @param deliveryOrderStructured Structured data from delivery order
   */
  async compareDocuments(
    invoiceText: string,
    deliveryOrderText: string,
    invoiceFilename: string,
    deliveryOrderFilename: string
  ): Promise<ComparisonResult> {
    try {
      // Prepare the prompt for OpenAI

      const prompt = this.buildProductExtractionPrompt(
        invoiceText,
        deliveryOrderText
      );

      // Make the API call to OpenAI

      const response = await this.callOpenAI(prompt);

      // Parse and process the response
      const aiResult = JSON.parse(response);

      // Format the result into our application structure
      return this.formatComparisonResult(
        aiResult,
        invoiceFilename,
        deliveryOrderFilename
      );
    } catch (error) {
      console.error("AI comparison error:", error);
      throw new Error(
        `AI comparison failed: ${error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Call OpenAI API with fallback logic
   * @param prompt Prompt for OpenAI
   * @returns OpenAI response text
   */
  private async callOpenAI(prompt: string): Promise<string> {
    try {
      // Try with primary model first
      const response = await this.openai.chat.completions.create({
        model: this.primaryModel,
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature: 0.1, // Low temperature for more consistent results
      });

      return response.choices[0].message.content || "{}";
    } catch (error) {
      console.error(`Error with primary model (${this.primaryModel}):`, error);

      // If fallback is enabled, try with fallback model
      if (this.useFallback) {
        console.log(`Falling back to ${this.fallbackModel}`);
        try {
          const fallbackResponse = await this.openai.chat.completions.create({
            model: this.fallbackModel,
            messages: [{ role: "user", content: prompt }],
            response_format: { type: "json_object" },
            temperature: 0.1,
          });

          return fallbackResponse.choices[0].message.content || "{}";
        } catch (fallbackError) {
          console.error(
            `Error with fallback model (${this.fallbackModel}):`,
            fallbackError
          );
          throw fallbackError;
        }
      } else {
        throw error;
      }
    }
  }

  /**
   * Build a detailed prompt for the AI to compare documents
   */
  private buildProductExtractionPrompt(
    invoiceText: string,
    deliveryOrderText: string
  ): string {
    return `
  You will receive two raw text blocks: one from an invoice and one from a delivery order.

  Create two lists of products (invoiceList and deliveryOrderList) with the two text inputs with the following structure:
  {
    "productName": "Product name",
    "quantity": "Quantity of the product",
  }

  You have to normalize the unit to milliliters or grams if any. 
  The input text will sometimes be a bit messy, try to always associate 1 product with 1 quantity when you detect the column, a fifo in other words.
  And if you found duplicates items by list, sum them.

  When you have the 2 processed list (invoiceList and deliveryOrderList), compare them and return a list of products with the following structure:
  Return a JSON with the following structure:
  {
    "items": [
      {
        "productName": "Product name",
        "invoiceValue": "Value in invoice (e.g., '3 caja')",
        "deliveryOrderValue": "Value in delivery order (e.g., '3 caja')",
        "status": "match|warning|error",
        "note": "Optional explanation of any discrepancies or conversions"
      }
    ],
    "metadata": [
       {
        "field": "Field name (e.g., 'Date', 'Invoice Number')",
        "invoiceValue": "Value in invoice",
        "deliveryOrderValue": "Value in delivery order",
        "status": "match|warning|error"
      }
    ],
    "summary": {
      "matches": 0,
      "warnings": 0,
      "errors": 0
    }
  }

  Guidelines:
  - Focus **only** on product lines.
  - Consider discrepancies in product name, quantity, and unit (e.g., caja, piezas).
  - Use fuzzy matching for slightly different names (e.g., "agua min 1000 12p" vs "agua mineral 1000ml").
  - Match products even if formatting varies or if units need conversion (e.g., "1 caja" vs "12 piezas").
  - Ignore all metadata and document headers or footers.

  INVOICE TEXT:
  ${invoiceText}

  DELIVERY ORDER TEXT:
  ${deliveryOrderText}

  Return only the JSON object. Do not include explanations or any additional text.
  `;
  }


  /**
   * Format the AI response into our application's result structure
   */
  private formatComparisonResult(
    aiResult: any,
    invoiceFilename: string,
    deliveryOrderFilename: string
  ): ComparisonResult {
    // Generate a unique ID for this comparison
    const id = this.generateId();
    const createdAt = new Date().toISOString();

    // Ensure the AI result has all required fields
    const items: ResultItem[] = Array.isArray(aiResult.items)
      ? aiResult.items.map((item: any) => ({
        productName: item.productName || "Unknown Product",
        invoiceValue: item.invoiceValue || "",
        deliveryOrderValue: item.deliveryOrderValue || "",
        status: this.validateStatus(item.status),
        note: item.note || "",
      }))
      : [];

    const metadata: MetadataItem[] = Array.isArray(aiResult.metadata)
      ? aiResult.metadata.map((meta: any) => ({
        field: meta.field || "Unknown Field",
        invoiceValue: meta.invoiceValue || "",
        deliveryOrderValue: meta.deliveryOrderValue || "",
        status: this.validateStatus(meta.status),
      }))
      : [];

    // Calculate summary if not provided or to ensure correctness
    const summary = {
      matches: items.filter((item) => item.status === "match").length +
        metadata.filter((meta) => meta.status === "match").length,
      warnings: items.filter((item) => item.status === "warning").length +
        metadata.filter((meta) => meta.status === "warning").length,
      errors: items.filter((item) => item.status === "error").length +
        metadata.filter((meta) => meta.status === "error").length,
    };

    return {
      id,
      sessionId: 0, // Will be set when saving to database
      invoiceFilename,
      deliveryOrderFilename,
      createdAt,
      matchCount: summary.matches,
      warningCount: summary.warnings,
      errorCount: summary.errors,
      summary,
      items,
      metadata,
      rawData: aiResult, // Store original AI response for debugging
    };
  }

  /**
   * Generate a unique ID for a comparison
   */
  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substring(2, 7);
  }

  /**
   * Validate status field to ensure it's one of the expected values
   */
  private validateStatus(status: string): "match" | "warning" | "error" {
    const validStatuses = ["match", "warning", "error"];
    return validStatuses.includes(status)
      ? (status as "match" | "warning" | "error")
      : "error";
  }
}

/**
 * Factory function to get a matcher service instance
 */
export function getMatcherService(): MatcherService {
  const apiKey = process.env.OPENAI_KEY || '';
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  const useFallback = process.env.OPENAI_USE_FALLBACK !== 'false';

  if (!apiKey) {
    console.warn("OPENAI_KEY environment variable is not set");
  }

  return new MatcherService(apiKey, model, 'gpt-4o-mini', useFallback);
}

export default getMatcherService;