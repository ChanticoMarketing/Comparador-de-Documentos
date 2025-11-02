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
        // temperature: 0.1, // Low temperature for more consistent results
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
            // temperature: 0.1,
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

    TASK
    1) Extract product lines from each text.
    2) Normalize names, sizes, quantities, and prices.
    3) Match items one-to-one.
    4) Return ONLY the JSON object described below (no extra text).

    OUTPUT SCHEMA
    {
      "items": [
        {
          "productName": "Canonical name",
          "invoiceValue": "Quantity in invoice (e.g., '3 caja' or '36 piezas')",
          "deliveryOrderValue": "Quantity in delivery order",
          "status": "match|warning|error",
          "priceMatch": "match|N/A|error",
          "price": "Total amount for the row from invoice (e.g., '$12.00') or ''",
          "note": "Short explanation for conversions or discrepancies"
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
      "summary": { "matches": 0, "warnings": 0, "errors": 0 }
    }

    EXTRACTION RULES
    - Focus ONLY on product lines; ignore headers/footers.
    - For each line capture: name, unit price (if any), and quantity.
    - Quantity:
      • If there are “unit boxes and total pieces” (e.g., Caja | 3 | 12) then totalPieces = 3 * 12.
      • If there is a single quantity (e.g., Caja | 12) then totalPieces = 12.
      • Pack tokens in the name (4P, 6P, 12P) mean pieces-per-pack; use only to compute totalPieces.
    - Build two raw lists: invoiceList and deliveryOrderList. Do NOT drop lines.

    NORMALIZATION
    - Size: convert everything to ML/GR (0.6L=600 ML, 0.355L=355 ML, 0.250L=250 ML).
    - Ignore-only tokens for name identity: PET, LAT/LATA, SLK, VNR, RF (keep in display, ignore for matching).
    - Acronyms/synonyms:
      • Brand: RB ↔ RED BULL.
      • LIGHT synonyms: LIGHT, LGT, LIGTH → normalize to LIGHT.
    - Canonical fields per line:
      brand, variant tokens (CREAM SODA | LIGHT | SUGAR FREE | REGULAR), sizeInMl, core name tokens (lowercased, de-accented, punctuation stripped).

    SAFE DEDUPE (inside ONE document only)
    - KEY = (brand, core tokens, variant, sizeInMl).
    - Merge two lines ONLY if KEY is identical AND totalPieces is identical. Otherwise do not merge. Never delete lines.

    HARD GATES (must pass BEFORE fuzzy)
    1) Brand buckets (no cross-brand):
      PENAFIEL/PEÑAFIEL, DR PEPPER, RED BULL/RB, SNAPPLE/SNAP.
      Items only match within the SAME bucket.
      If one side is UNKNOWN and the other has brand → do NOT match.
    2) Variant equality (inside same brand):
      Extract variant as:
        has "CREAM SODA" → CREAM SODA
        else has "SUGAR FREE" → SUGAR FREE
        else has "LIGHT"/"LGT"/"LIGTH" → LIGHT
        else → REGULAR
      Items can match ONLY if variantA == variantB.
    3) Size equality: sizes must be equal after normalization (ML/GR).

    CONCRETE DO/DON’T (apply literally)
    - DO:  "DR PEPPER CREAM SODA 0.355L" ↔ "DR PEPPER CREAM SODA 355 ML".
    - DON’T: "DR PEPPER CREAM SODA 0.355L" ↔ "DR PEPPER 0.355L" (REGULAR) or any other brand.
    - DO:  "PENAFIEL LIMONADA LIGHT 0.6L" ↔ "PENAFIEL LIMONADA LGT 600 ML".
    - DON’T: "PENAFIEL LIMONADA 0.6L" ↔ "PENAFIEL LIMONADA LIGHT 0.6L".
    - DO:  "RB SUGAR FREE 0.250L" ↔ "RED BULL LAT SUGAR FREE 250 ML".
    - DON’T: cross-brand matches (e.g., DR PEPPER ↔ PENAFIEL).

    MATCHING (deterministic, one-to-one)
    1) Sort both lists by (brand, sizeInMl, normalized core+variant tokens, original order).
    2) Within the SAME brand+variant+size, pair by:
      a) Exact KEY match → pair.
      b) Otherwise fuzzy similarity on core tokens (≥ 0.65). If multiple, pick highest similarity; tie-break by shortest edit distance, then earliest original order.
    3) Once paired, remove both from consideration (no reuse).
    4) Items that fail the gates remain unmatched.

    COMPLETENESS GUARANTEE (no disappearances)
    - Let N = max(len(invoiceList), len(deliveryOrderList)).
    - The final items array MUST have exactly N rows.
    - If an item has no valid partner, create a row with the opposite side empty ("") and set status:"error", priceMatch:"N/A".
    - Each original parsed line must appear in at most one row.

    PRICES
    - Compute line total = unitPrice × totalPieces when unit price exists.
    - Row "price" = invoice line total (or '' if unavailable).
    - metadata.priceMatch:
      • both totals exist and are equal → "match"
      • one/both missing → "N/A"
      • both exist and differ → "error"
    - Unmatched rows: priceMatch:"N/A", price:"".

    STATUS
    - "match": same brand, same variant, same size, equal quantities after conversions.
    - "warning": same product but quantities differ (explain in note).
    - "error": no valid partner per gates/rules.
    - If the text cannot be reliably split into products, return items with status:"error" and priceMatch:"N/A" and explain briefly in "note".

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

    INPUT
    fileText = ${fileText}

    GOAL
    1) Split fileText into:
      - invoiceText
      - deliveryOrderText
    2) Extract product lines from each block.
    3) Normalize names/sizes/quantities/prices.
    4) Match items one-to-one under strict gates.
    5) Return ONLY the JSON object described below (no extra text).

    OUTPUT SCHEMA
    {
      "items": [
        {
          "productName": "Canonical name",
          "invoiceValue": "Quantity in invoice (e.g., '3 caja' or '36 piezas' or '6000 ml')",
          "deliveryOrderValue": "Quantity in delivery order",
          "status": "match|warning|error",
          "priceMatch": "match|N/A|error",
          "price": "Invoice row total (e.g., '$12.00') or ''",
          "note": "Short explanation for conversions/discrepancies"
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
      "summary": { "matches": 0, "warnings": 0, "errors": 0 }
    }

    SPLIT RULES (apply in order until one works)
    A) Use explicit markers if present: headers like “INVOICE TEXT:” / “DELIVERY ORDER TEXT:” or dividers like “===INVOICE===” / “===DELIVERY_ORDER===”.
    B) Otherwise infer by keywords (case-insensitive, multilingual):
      - Invoice cues: invoice, factura, bill to, subtotal, iva/vat, invoice no, total invoice, amount due, rfc.
      - Delivery cues: delivery order, orden de entrega, do no, delivered qty, received by, dispatch, remisión, packing list.
      Assign lines to the nearest block. If a line has both cues, use surrounding context and section totals.
    C) If still ambiguous, split by the strongest section/page divider (form feeds, long dashed rules, repeated headers/footers, largest blank gap).
    If only one block can be detected, treat the remainder as the other. If impossible, return items with status:"error" and priceMatch:"N/A" explaining the split failure in "note".

    EXTRACTION
    - Focus ONLY on product lines; ignore headers/addresses/signatures.
    - For each line capture: product name, unit price (if any), and quantity.
    - Quantity semantics:
      • If “unit boxes and total pieces” appear (e.g., Caja | 3 | 12) → totalPieces = 3 * 12.
      • If a single quantity appears (e.g., Caja | 12) → totalPieces = 12.
      • Pack tokens in the name (4P, 6P, 12P) = pieces-per-pack; use ONLY to compute totalPieces.
    - Build two raw lists: invoiceList and deliveryOrderList. Do NOT drop lines.

    NORMALIZATION (apply BEFORE matching)
    - Size: convert to ML/GR (0.6L=600 ML, 0.355L=355 ML, 0.250L=250 ML; cl=10 ml; L=1000 ml; kg=1000 g; lb=453.592 g).
    - Ignore-only tokens for identity: PET, LAT/LATA, SLK, VNR, RF (keep for display, ignore for matching).
    - Acronyms/synonyms:
      • Brand: RB ↔ RED BULL.
      • LIGHT synonyms: LIGHT, LGT, LIGTH → normalize to LIGHT.
    - Canonical per line: brand, variant tokens (CREAM SODA | LIGHT | SUGAR FREE | REGULAR), sizeInMl, core name tokens (lowercased, de-accented, punctuation stripped).

    SAFE DEDUPE (within ONE document only)
    - KEY = (brand, core tokens, variant, sizeInMl).
    - Merge two lines ONLY if KEY is IDENTICAL AND totalPieces is IDENTICAL. Otherwise do NOT merge. Never delete lines.

    HARD GATES (must pass BEFORE fuzzy)
    1) Brand buckets (no cross-brand):
      PENAFIEL/PEÑAFIEL, DR PEPPER, RED BULL/RB, SNAPPLE/SNAP.
      Items may only match within the SAME bucket.
      If one side is UNKNOWN and the other has a brand → do NOT match.
    2) Variant equality (inside the same brand):
      Extract variant as:
        contains "CREAM SODA" → CREAM SODA
        else contains "SUGAR FREE" → SUGAR FREE
        else contains "LIGHT"/"LGT"/"LIGTH" → LIGHT
        else → REGULAR
      Items can match ONLY if variantA == variantB.
    3) Size equality: sizes must be equal after normalization (ML/GR).

    CONCRETE DO/DON’T (apply literally)
    - DO:  "DR PEPPER CREAM SODA 0.355L" ↔ "DR PEPPER CREAM SODA 355 ML".
    - DON’T: "DR PEPPER CREAM SODA 0.355L" ↔ "DR PEPPER 0.355L" (REGULAR) or any other brand.
    - DO:  "PENAFIEL LIMONADA LIGHT 0.6L" ↔ "PENAFIEL LIMONADA LGT 600 ML".
    - DON’T: "PENAFIEL LIMONADA 0.6L" ↔ "PENAFIEL LIMONADA LIGHT 0.6L".
    - DO:  "RB SUGAR FREE 0.250L" ↔ "RED BULL LAT SUGAR FREE 250 ML".
    - DON’T: cross-brand matches.

    MATCHING (deterministic, one-to-one)
    1) Sort both lists by (brand, sizeInMl, normalized core+variant tokens, original order).
    2) Within SAME brand+variant+size, pair by:
      a) Exact KEY match → pair.
      b) Otherwise fuzzy similarity on core tokens (threshold ≥ 0.65). If multiple, pick highest similarity; tie-break by shortest edit distance, then earliest original order.
    3) Once paired, remove both from consideration (no reuse).
    4) Items that fail gates remain unmatched.

    COMPLETENESS (no disappearances)
    - Let N = max(len(invoiceList), len(deliveryOrderList)).
    - The final items array MUST have exactly N rows.
    - If an item has no valid partner, create a row with the opposite side empty ("") and set status:"error", priceMatch:"N/A".
    - Each original parsed line must appear in at most one row.

    PRICES
    - Compute line total = unitPrice × totalPieces when unit price exists.
    - Row "price" = invoice line total (or '' if unavailable).
    - metadata.priceMatch:
      • both totals exist and are equal → "match"
      • one/both missing → "N/A"
      • both exist and differ → "error"
    - Unmatched rows: priceMatch:"N/A", price:"".

    STATUS
    - "match": same brand, same variant, same size, equal quantities after conversions.
    - "warning": same product but quantities differ (explain in note).
    - "error": no valid partner per gates/rules.
    - If the split is unreliable or blocks can’t be determined, return items with status:"error" and priceMatch:"N/A" and explain briefly in "note".

    NOW PROCESS
    1) Parse fileText → split into invoiceText and deliveryOrderText (using the split rules).
    2) Build invoiceList and deliveryOrderList with normalized quantities and safe dedupe.
    3) Extract unit prices, compute line totals and overall totals.
    4) Match lists and produce "items", "metadata", and "summary".
    5) Return ONLY the JSON object (no extra text).
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
