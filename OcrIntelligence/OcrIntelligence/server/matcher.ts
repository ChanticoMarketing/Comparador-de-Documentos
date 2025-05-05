import OpenAI from "openai";
import { OcrService } from "./ocr";
import { ComparisonResult, ResultItem, MetadataItem } from "../client/src/types";

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
    invoiceStructured: Record<string, any>,
    deliveryOrderStructured: Record<string, any>,
    invoiceFilename: string,
    deliveryOrderFilename: string
  ): Promise<ComparisonResult> {
    try {
      // Prepare the prompt for OpenAI
      const prompt = this.buildComparisonPrompt(
        invoiceText,
        deliveryOrderText,
        invoiceStructured,
        deliveryOrderStructured
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
        `AI comparison failed: ${
          error instanceof Error ? error.message : String(error)
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
  private buildComparisonPrompt(
    invoiceText: string,
    deliveryOrderText: string,
    invoiceStructured: Record<string, any>,
    deliveryOrderStructured: Record<string, any>
  ): string {
    return `
Compare the following invoice against the delivery order and identify any discrepancies.
Pay special attention to product names, quantities, prices, and other important details.

Apply the following rules:
1. If an item quantity is listed in different units (e.g., "1 caja" vs "24 unidades"), try to determine if they are equivalent based on any conversion information in the text.
2. Use fuzzy matching for product names to identify the same product even if the descriptions differ slightly.
3. Check dates, numbers, and other metadata for discrepancies.

INVOICE TEXT:
${invoiceText}

DELIVERY ORDER TEXT:
${deliveryOrderText}

INVOICE STRUCTURED DATA:
${JSON.stringify(invoiceStructured, null, 2)}

DELIVERY ORDER STRUCTURED DATA:
${JSON.stringify(deliveryOrderStructured, null, 2)}

Respond with a JSON object with the following structure:
{
  "items": [
    {
      "productName": "Product name",
      "invoiceValue": "Value in invoice (e.g., '10 units')",
      "deliveryOrderValue": "Value in delivery order (e.g., '10 units')",
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

For status:
- Use "match" when values are identical or equivalent after conversion.
- Use "warning" when values might be equivalent but require attention (e.g., different units, slightly different product names).
- Use "error" when there's a clear discrepancy.

Only include fields that are present in at least one of the documents. Focus on important information like product details, quantities, dates, and reference numbers.
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
      invoiceFilename,
      deliveryOrderFilename,
      createdAt,
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
  const model = process.env.OPENAI_MODEL || 'gpt-4o';
  const useFallback = process.env.OPENAI_USE_FALLBACK !== 'false';
  
  if (!apiKey) {
    console.warn("OPENAI_KEY environment variable is not set");
  }
  
  return new MatcherService(apiKey, model, 'gpt-4o-mini', useFallback);
}

export default getMatcherService;
