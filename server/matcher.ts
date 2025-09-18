import OpenAI from "openai";
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
  async compareSingleDocument(
    fileText: string,
    fileFilename: string
  ): Promise<ComparisonResult> {
    try {
      // Prepare the prompt for OpenAI
      const prompt = this.buildProductExtractionPromptSingleDocument(
        fileText
      );

      // Make the API call to OpenAI
      const response = await this.callOpenAI(prompt);
      console.log("Response:", response);

      // Parse and process the response
      const aiResult = JSON.parse(response);

      // Format the result into our application structure
      return this.formatComparisonResult(
        aiResult,
        fileFilename,
        fileFilename
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
    
    Additionally, extract the unit price and calculate the total price (unit price × quantity) for each item list.  
    Then, compare the total prices of both lists (invoiceList and deliveryOrderList) and determine a general priceMatch status to include in the metadata section:
    - If both totals match exactly, set "priceMatch": "match".
    - If one or both totals are missing, set "priceMatch": "N/A".
    - If totals are present but different, set "priceMatch": "error".
    
    When you have the 2 processed list (invoiceList and deliveryOrderList), compare them and return a list of products with the following structure:
    Return a JSON with the following structure:
    {
      "items": [
        {
          "productName": "Product name",
          "invoiceValue": "Value in invoice (e.g., '3 caja')",
          "deliveryOrderValue": "Value in delivery order (e.g., '3 caja')",
          "status": "match|warning|error",
          "priceMatch": "match|N/A|error",
          "price": "The amount of money (e.g., '$12.00') if not match just return empty string",
          "note": "Optional explanation of any discrepancies or conversions"
        }
      ],
      "metadata": [
        {
          "field": "Field name (e.g., 'Date', 'Invoice Number')",
          "invoiceValue": "Value in invoice",
          "deliveryOrderValue": "Value in delivery order",
          "status": "match|warning|error",
          "priceMatch": "match|N/A|error"
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
 * Build a detailed prompt for the AI to compare a single document
 */
  private buildProductExtractionPromptSingleDocument(
    fileText: string,
  ): string {
    return `
    You will receive ONE raw text string that contains BOTH an invoice and a delivery order.

    Input:
    fileText = ${fileText}

    Goal:
    1) Detect and split the input into two logical blocks:
      - invoiceText
      - deliveryOrderText

    How to split (apply in order until one works):
    A) If explicit markers exist, use them:
      - Headers like “INVOICE TEXT:” / “DELIVERY ORDER TEXT:”
      - Or clear dividers such as “===INVOICE===” / “===DELIVERY_ORDER===”
    B) Otherwise, infer by keywords and context (case-insensitive, multilingual if needed):
      - Invoice indicators: “invoice”, “factura”, “bill to”, “subtotal”, “iva/vat”, “invoice no”, “total invoice”, “amount due”, “rfc”
      - Delivery indicators: “delivery order”, “orden de entrega”, “do no”, “delivered qty”, “received by”, “dispatch”, “remisión”, “packing list”
      Assign each detected line to the nearest matching block; if a line has both kinds of cues, prefer the block suggested by surrounding lines and section totals.
    C) If still ambiguous, split by strongest page/section dividers:
      - Form feeds, long dashed lines, page headers/footers repeating patterns, or the largest blank-line gap.
      The first block becomes invoiceText, the second becomes deliveryOrderText.

    If only one block can be confidently detected, treat the remainder as the other block; if still impossible, return an items list with status "error" and priceMatch "N/A" explaining the split failure in "note".

    Processing (same rules as before):
    - Create two lists of products (invoiceList and deliveryOrderList) from invoiceText and deliveryOrderText with items shaped as:
      {
        "productName": "Product name",
        "quantity": "Quantity of the product"
      }

    - Focus ONLY on product lines. Ignore headers/footers/addresses/signatures.
    - Use FIFO alignment when a product column and a quantity/price column are messy; associate each product with its most plausible quantity on the same line/row or aligned column.
    - Normalize units to milliliters (ml) or grams (g):
      • L → 1000 ml; cl → 10 ml; oz (fluid) → 29.5735 ml
      • kg → 1000 g; lb → 453.592 g; oz (weight) → 28.3495 g
      • Handle patterns like “12x500 ml”, “caja 24 pzas de 355ml”, “pack(6)*2L”
        → Multiply counts and convert to a single normalized quantity per product.
    - If duplicates exist within a list (fuzzy name match), sum quantities.
    - Extract unit price when present; compute line total: unit price × normalized quantity (respect decimal/currency formats like $ 1,234.56 or 1.234,56).
      • If price is per pack, normalize to per unit before multiplying.
      • Keep currency symbol from the source if available, else default to empty symbol but numeric value preserved.

    Matching rules:
    - Fuzzy match product names across lists (e.g., “agua min 1000 12p” ≈ “agua mineral 1000ml”).
    - Consider unit conversions and pack expansions (e.g., “1 caja de 12 x 1L” vs “12 L”).
    - Status per item:
      • "match"  → product exists in both with equivalent normalized quantity
      • "warning"→ product exists in both but minor name differences or rounding tolerances
      • "error"  → product missing in one list or materially different normalized quantity
    
    Additionally, extract the unit price and calculate the total price (unit price × quantity) for each item list.  
    Then, compare the total prices of both lists (invoiceList and deliveryOrderList) and determine a general priceMatch status to include in the metadata section:
    - If both totals match exactly, set "priceMatch": "match".
    - If one or both totals are missing, set "priceMatch": "N/A".
    - If totals are present but different, set "priceMatch": "error".

    Output:
    Return ONLY the JSON object, no extra text.

    Schema:
    {
      "items": [
        {
          "productName": "Product name",
          "invoiceValue": "Value in invoice (e.g., '3 caja', '6000 ml')",
          "deliveryOrderValue": "Value in delivery order (e.g., '3 caja', '6000 ml')",
          "status": "match|warning|error",
          "priceMatch": "match|N/A|error",
          "price": "The amount of money (e.g., '$12.00'); empty string if not a match or unavailable",
          "note": "Optional explanation of discrepancies/conversions (e.g., 'Converted 12x500ml to 6000 ml')"
        }
      ],
      "metadata": [
        {
          "field": "Field name (e.g., 'Date', 'Invoice Number')",
          "invoiceValue": "Value in invoice",
          "deliveryOrderValue": "Value in delivery order",
          "status": "match|warning|error",
          "priceMatch": "match|N/A|error"
        }
      ],
      "summary": {
        "matches": 0,
        "warnings": 0,
        "errors": 0
      }
    }

    Guidelines & heuristics:
    - Be resilient to OCR noise and column drift.
    - Strip SKU codes from names when they hinder matching but keep them if needed to disambiguate.
    - Prefer normalized numeric comparisons with a small tolerance for decimal rounding (±0.5%).
    - Currency handling: if multiple currencies are detected, do NOT convert; compute totals per detected currency and set priceMatch to "N/A" (note why).
    - If a unit price is missing on a line, leave its line total blank; still include the item.

    Now process:
    1) Parse fileText → split into invoiceText and deliveryOrderText (using the rules above).
    2) Build invoiceList and deliveryOrderList with normalized quantities and summed duplicates.
    3) Extract unit prices, compute line totals, and compute overall totals.
    4) Compare lists and produce "items", "metadata", and "summary".
    5) Return ONLY the JSON object.
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
        priceMatch: item.priceMatch,
        price: item.price || "",
        note: item.note || ""
      }))
      : [];

    const metadata: MetadataItem[] = Array.isArray(aiResult.metadata)
      ? aiResult.metadata.map((meta: any) => ({
        field: meta.field || "Unknown Field",
        invoiceValue: meta.invoiceValue || "",
        deliveryOrderValue: meta.deliveryOrderValue || "",
        status: this.validateStatus(meta.status),
        priceMatch: meta.priceMatch
      }))
      : [];

    // Calculate summary if not provided or to ensure correctness
    const summary = {
      matches: items.filter((item) => item.status === "match").length,
      warnings: items.filter((item) => item.status === "warning").length,
      errors: items.filter((item) => item.status === "error").length,
    };

    return {
      id,
      sessionId: 0, // TODO: Implementar sessionId cuando se implemente el sistema de sesiones
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
