import { db } from "@db";
import { eq, desc, and } from "drizzle-orm";
import { 
  sessions,
  comparisons,
  settings,
  Session,
  Comparison,
  comparisonItems,
  comparisonMetadata,
  AppSettings
} from "@shared/schema";
import { ComparisonResult, ResultItem, MetadataItem } from "../client/src/types";

/**
 * Storage service for the application
 * Handles database operations for sessions, comparisons, and settings
 */
export class StorageService {

  /**
   * Create a new processing session
   */
  async createSession(
    invoiceFilename: string,
    deliveryOrderFilename: string
  ): Promise<Session> {
    const [session] = await db.insert(sessions).values({
      invoiceFilename,
      deliveryOrderFilename,
      status: "processing",
      matchCount: 0,
      warningCount: 0,
      errorCount: 0,
    }).returning();

    return session;
  }

  /**
   * Update session status
   */
  async updateSessionStatus(
    sessionId: number,
    status: "processing" | "completed" | "error",
    errorMessage?: string
  ): Promise<void> {
    await db.update(sessions)
      .set({ 
        status, 
        errorMessage,
        completedAt: status === "completed" ? new Date() : undefined
      })
      .where(eq(sessions.id, sessionId));
  }

  /**
   * Get session by ID
   */
  async getSession(sessionId: number): Promise<Session | undefined> {
    const result = await db.query.sessions.findFirst({
      where: eq(sessions.id, sessionId)
    });
    
    return result;
  }

  /**
   * Get all sessions
   */
  async getAllSessions(limit?: number, offset?: number): Promise<Session[]> {
    return await db.query.sessions.findMany({
      orderBy: desc(sessions.createdAt),
      limit: limit || undefined,
      offset: offset || undefined,
    });
  }

  /**
   * Save comparison result
   */
  async saveComparisonResult(
    sessionId: number,
    result: ComparisonResult
  ): Promise<Comparison> {
    // First, create the comparison record
    const [comparison] = await db.insert(comparisons).values({
      sessionId,
      invoiceFilename: result.invoiceFilename,
      deliveryOrderFilename: result.deliveryOrderFilename,
      matchCount: result.summary.matches,
      warningCount: result.summary.warnings,
      errorCount: result.summary.errors,
      rawData: result.rawData || {},
    }).returning();

    // Then, insert all items
    if (result.items && result.items.length > 0) {
      await db.insert(comparisonItems).values(
        result.items.map(item => ({
          comparisonId: comparison.id,
          productName: item.productName,
          invoiceValue: item.invoiceValue,
          deliveryOrderValue: item.deliveryOrderValue,
          status: item.status,
          note: item.note || null,
        }))
      );
    }

    // Finally, insert all metadata
    if (result.metadata && result.metadata.length > 0) {
      await db.insert(comparisonMetadata).values(
        result.metadata.map(meta => ({
          comparisonId: comparison.id,
          field: meta.field,
          invoiceValue: meta.invoiceValue,
          deliveryOrderValue: meta.deliveryOrderValue,
          status: meta.status,
        }))
      );
    }

    // Update the session with the result summary
    await db.update(sessions)
      .set({
        status: "completed",
        matchCount: result.summary.matches,
        warningCount: result.summary.warnings,
        errorCount: result.summary.errors,
        completedAt: new Date(),
      })
      .where(eq(sessions.id, sessionId));

    return comparison;
  }

  /**
   * Get comparison by ID with all related items and metadata
   */
  async getComparison(comparisonId: number): Promise<ComparisonResult | null> {
    const comparison = await db.query.comparisons.findFirst({
      where: eq(comparisons.id, comparisonId),
      with: {
        items: true,
        metadata: true,
      },
    });

    if (!comparison) return null;

    // Convert to our application's result structure
    return {
      id: comparison.id.toString(),
      invoiceFilename: comparison.invoiceFilename,
      deliveryOrderFilename: comparison.deliveryOrderFilename,
      createdAt: comparison.createdAt.toISOString(),
      summary: {
        matches: comparison.matchCount,
        warnings: comparison.warningCount,
        errors: comparison.errorCount,
      },
      items: comparison.items.map(item => ({
        productName: item.productName,
        invoiceValue: item.invoiceValue,
        deliveryOrderValue: item.deliveryOrderValue,
        status: item.status as "match" | "warning" | "error",
        note: item.note || undefined,
      })),
      metadata: comparison.metadata.map(meta => ({
        field: meta.field,
        invoiceValue: meta.invoiceValue,
        deliveryOrderValue: meta.deliveryOrderValue,
        status: meta.status as "match" | "warning" | "error",
      })),
      rawData: comparison.rawData,
    };
  }

  /**
   * Get the latest comparison for a session
   */
  async getLatestComparison(sessionId: number): Promise<ComparisonResult | null> {
    const comparison = await db.query.comparisons.findFirst({
      where: eq(comparisons.sessionId, sessionId),
      orderBy: desc(comparisons.createdAt),
      with: {
        items: true,
        metadata: true,
      },
    });

    if (!comparison) return null;

    // Convert to our application's result structure
    return {
      id: comparison.id.toString(),
      invoiceFilename: comparison.invoiceFilename,
      deliveryOrderFilename: comparison.deliveryOrderFilename,
      createdAt: comparison.createdAt.toISOString(),
      summary: {
        matches: comparison.matchCount,
        warnings: comparison.warningCount,
        errors: comparison.errorCount,
      },
      items: comparison.items.map(item => ({
        productName: item.productName,
        invoiceValue: item.invoiceValue,
        deliveryOrderValue: item.deliveryOrderValue,
        status: item.status as "match" | "warning" | "error",
        note: item.note || undefined,
      })),
      metadata: comparison.metadata.map(meta => ({
        field: meta.field,
        invoiceValue: meta.invoiceValue,
        deliveryOrderValue: meta.deliveryOrderValue,
        status: meta.status as "match" | "warning" | "error",
      })),
      rawData: comparison.rawData,
    };
  }

  /**
   * Get the most recent comparison overall
   */
  async getMostRecentComparison(): Promise<ComparisonResult | null> {
    const comparison = await db.query.comparisons.findFirst({
      orderBy: desc(comparisons.createdAt),
      with: {
        items: true,
        metadata: true,
      },
    });

    if (!comparison) return null;

    // Convert to our application's result structure
    return {
      id: comparison.id.toString(),
      invoiceFilename: comparison.invoiceFilename,
      deliveryOrderFilename: comparison.deliveryOrderFilename,
      createdAt: comparison.createdAt.toISOString(),
      summary: {
        matches: comparison.matchCount,
        warnings: comparison.warningCount,
        errors: comparison.errorCount,
      },
      items: comparison.items.map(item => ({
        productName: item.productName,
        invoiceValue: item.invoiceValue,
        deliveryOrderValue: item.deliveryOrderValue,
        status: item.status as "match" | "warning" | "error",
        note: item.note || undefined,
      })),
      metadata: comparison.metadata.map(meta => ({
        field: meta.field,
        invoiceValue: meta.invoiceValue,
        deliveryOrderValue: meta.deliveryOrderValue,
        status: meta.status as "match" | "warning" | "error",
      })),
      rawData: comparison.rawData,
    };
  }

  /**
   * Get all comparisons for a session
   */
  async getSessionComparisons(sessionId: number): Promise<ComparisonResult[]> {
    const comparisonList = await db.query.comparisons.findMany({
      where: eq(comparisons.sessionId, sessionId),
      orderBy: desc(comparisons.createdAt),
      with: {
        items: true,
        metadata: true,
      },
    });

    return comparisonList.map(comparison => ({
      id: comparison.id.toString(),
      invoiceFilename: comparison.invoiceFilename,
      deliveryOrderFilename: comparison.deliveryOrderFilename,
      createdAt: comparison.createdAt.toISOString(),
      summary: {
        matches: comparison.matchCount,
        warnings: comparison.warningCount,
        errors: comparison.errorCount,
      },
      items: comparison.items.map(item => ({
        productName: item.productName,
        invoiceValue: item.invoiceValue,
        deliveryOrderValue: item.deliveryOrderValue,
        status: item.status as "match" | "warning" | "error",
        note: item.note || undefined,
      })),
      metadata: comparison.metadata.map(meta => ({
        field: meta.field,
        invoiceValue: meta.invoiceValue,
        deliveryOrderValue: meta.deliveryOrderValue,
        status: meta.status as "match" | "warning" | "error",
      })),
      rawData: comparison.rawData,
    }));
  }

  /**
   * Save or update application settings
   */
  async saveSettings(settingsData: AppSettings): Promise<AppSettings> {
    // Check if settings already exist
    const existingSettings = await db.query.settings.findFirst();

    if (existingSettings) {
      // Update existing settings
      const [updated] = await db.update(settings)
        .set(settingsData)
        .where(eq(settings.id, existingSettings.id))
        .returning();
      return updated;
    } else {
      // Create new settings
      const [newSettings] = await db.insert(settings)
        .values(settingsData)
        .returning();
      return newSettings;
    }
  }

  /**
   * Get application settings
   */
  async getSettings(): Promise<AppSettings | null> {
    const settingsData = await db.query.settings.findFirst();
    return settingsData || null;
  }
}

// Export a singleton instance of the storage service
export const storage = new StorageService();
