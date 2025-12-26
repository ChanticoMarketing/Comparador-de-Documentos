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
  AppSettings,
  emailVerificationTokens,
  passwordResetTokens,
  twoFactorCodes,
  notificationPreferences,
  EmailVerificationToken,
  PasswordResetToken,
  TwoFactorCode,
  NotificationPreference
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
    deliveryOrderFilename: string,
    userId?: number
  ): Promise<Session> {
    const [session] = await db.insert(sessions).values({
      userId,
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
    result: ComparisonResult,
    userId?: number
  ): Promise<Comparison> {
    // First, create the comparison record
    const [comparison] = await db.insert(comparisons).values({
      sessionId,
      userId,
      invoiceFilename: result.invoiceFilename,
      deliveryOrderFilename: result.deliveryOrderFilename,
      matchCount: result.summary.matches,
      warningCount: result.summary.warnings,
      errorCount: result.summary.errors,
      rawData: result.rawData || {},
    }).returning();

    // Extract priceMatch from metadata (actual value, not field name)
    const priceMatchMeta = result.metadata.find(meta => meta.priceMatch !== undefined);
    const priceMatch = priceMatchMeta?.priceMatch || "N/A";

    // Then, insert all items
    if (result.items && result.items.length > 0) {
      await db.insert(comparisonItems).values(
        result.items.map(item => ({
          comparisonId: comparison.id,
          productName: item.productName,
          invoiceValue: item.invoiceValue,
          deliveryOrderValue: item.deliveryOrderValue,
          status: item.status,
          priceMatch: priceMatch,
          price: item.price || null,
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
          priceMatch: meta.priceMatch
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
        priceMatch: priceMatch,
        completedAt: new Date(),
      })
      .where(eq(sessions.id, sessionId));

    return comparison;
  }

  /**
   * Get comparison by ID with all related items and metadata
   */
  async getComparison(comparisonId: number): Promise<ComparisonResult | null> {
    console.log(`comparisonId:  ${comparisonId}`);
    const comparison = await db.query.comparisons.findFirst({
      where: eq(comparisons.sessionId, comparisonId),
      with: {
        items: true,
        metadata: true,
      },
    });

    if (!comparison) return null;

    // Convert to our application's result structure
    return {
      id: comparison.id.toString(),
      sessionId: comparison.sessionId,
      invoiceFilename: comparison.invoiceFilename,
      deliveryOrderFilename: comparison.deliveryOrderFilename,
      createdAt: comparison.createdAt.toISOString(),
      matchCount: comparison.matchCount,
      warningCount: comparison.warningCount,
      errorCount: comparison.errorCount,
      summary: {
        matches: comparison.matchCount,
        warnings: comparison.warningCount,
        errors: comparison.errorCount,
      },
      items: comparison.items.map((item: any) => ({
        productName: item.productName,
        invoiceValue: item.invoiceValue,
        deliveryOrderValue: item.deliveryOrderValue,
        status: item.status as "match" | "warning" | "error",
        priceMatch: item.priceMatch || "N/A",
        price: item.price || "",
        note: item.note || undefined,
      })),
      metadata: comparison.metadata.map((meta: any) => ({
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
      sessionId: comparison.sessionId,
      invoiceFilename: comparison.invoiceFilename,
      deliveryOrderFilename: comparison.deliveryOrderFilename,
      createdAt: comparison.createdAt.toISOString(),
      matchCount: comparison.matchCount,
      warningCount: comparison.warningCount,
      errorCount: comparison.errorCount,
      summary: {
        matches: comparison.matchCount,
        warnings: comparison.warningCount,
        errors: comparison.errorCount,
      },
      items: comparison.items.map((item: any) => ({
        productName: item.productName,
        invoiceValue: item.invoiceValue,
        deliveryOrderValue: item.deliveryOrderValue,
        status: item.status as "match" | "warning" | "error",
        priceMatch: item.priceMatch || "N/A",
        note: item.note || undefined,
      })),
      metadata: comparison.metadata.map((meta: any) => ({
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
      sessionId: comparison.sessionId,
      invoiceFilename: comparison.invoiceFilename,
      deliveryOrderFilename: comparison.deliveryOrderFilename,
      createdAt: comparison.createdAt.toISOString(),
      matchCount: comparison.matchCount,
      warningCount: comparison.warningCount,
      errorCount: comparison.errorCount,
      summary: {
        matches: comparison.matchCount,
        warnings: comparison.warningCount,
        errors: comparison.errorCount,
      },
      items: comparison.items.map((item: any) => ({
        productName: item.productName,
        invoiceValue: item.invoiceValue,
        deliveryOrderValue: item.deliveryOrderValue,
        status: item.status as "match" | "warning" | "error",
        priceMatch: item.priceMatch || "N/A",
        note: item.note || undefined,
      })),
      metadata: comparison.metadata.map((meta: any) => ({
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
  async getComparisonsBySessionId(sessionId: number): Promise<ComparisonResult[]> {
    const sessionComparisons = await db.query.comparisons.findMany({
      where: eq(comparisons.sessionId, sessionId),
      orderBy: desc(comparisons.createdAt),
      with: {
        items: true,
        metadata: true,
      },
    });

    return sessionComparisons.map((comparison: any) => ({
      id: comparison.id.toString(),
      sessionId: comparison.sessionId,
      invoiceFilename: comparison.invoiceFilename,
      deliveryOrderFilename: comparison.deliveryOrderFilename,
      createdAt: comparison.createdAt.toISOString(),
      summary: {
        matches: comparison.matchCount,
        warnings: comparison.warningCount,
        errors: comparison.errorCount,
      },
      items: comparison.items.map((item: any) => ({
        productName: item.productName,
        invoiceValue: item.invoiceValue,
        deliveryOrderValue: item.deliveryOrderValue,
        status: item.status as "match" | "warning" | "error",
        note: item.note || undefined,
      })),
      metadata: comparison.metadata.map((meta: any) => ({
        field: meta.field,
        invoiceValue: meta.invoiceValue,
        deliveryOrderValue: meta.deliveryOrderValue,
        status: meta.status as "match" | "warning" | "error",
      })),
      rawData: comparison.rawData,
      matchCount: comparison.matchCount,
      warningCount: comparison.warningCount,
      errorCount: comparison.errorCount,
    }));
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

  // ===========================
  // Email Verification Tokens
  // ===========================

  /**
   * Create email verification token
   */
  async createEmailVerificationToken(
    userId: number,
    token: string,
    expiresAt: Date
  ): Promise<EmailVerificationToken> {
    // Delete any existing tokens for this user
    await db.delete(emailVerificationTokens)
      .where(eq(emailVerificationTokens.userId, userId));

    const [verificationToken] = await db.insert(emailVerificationTokens)
      .values({ userId, token, expiresAt })
      .returning();

    return verificationToken;
  }

  /**
   * Get email verification token
   */
  async getEmailVerificationToken(token: string): Promise<EmailVerificationToken | null> {
    const result = await db.query.emailVerificationTokens.findFirst({
      where: eq(emailVerificationTokens.token, token)
    });

    return result || null;
  }

  /**
   * Delete email verification token
   */
  async deleteEmailVerificationToken(tokenId: number): Promise<void> {
    await db.delete(emailVerificationTokens)
      .where(eq(emailVerificationTokens.id, tokenId));
  }

  // ===========================
  // Password Reset Tokens
  // ===========================

  /**
   * Create password reset token
   */
  async createPasswordResetToken(
    userId: number,
    token: string,
    expiresAt: Date
  ): Promise<PasswordResetToken> {
    // Delete any existing unused tokens for this user
    await db.delete(passwordResetTokens)
      .where(and(
        eq(passwordResetTokens.userId, userId),
        eq(passwordResetTokens.used, false)
      ));

    const [resetToken] = await db.insert(passwordResetTokens)
      .values({ userId, token, expiresAt })
      .returning();

    return resetToken;
  }

  /**
   * Get password reset token
   */
  async getPasswordResetToken(token: string): Promise<PasswordResetToken | null> {
    const result = await db.query.passwordResetTokens.findFirst({
      where: and(
        eq(passwordResetTokens.token, token),
        eq(passwordResetTokens.used, false)
      )
    });

    return result || null;
  }

  /**
   * Mark password reset token as used
   */
  async markPasswordResetTokenAsUsed(tokenId: number): Promise<void> {
    await db.update(passwordResetTokens)
      .set({ used: true })
      .where(eq(passwordResetTokens.id, tokenId));
  }

  // ===========================
  // Two-Factor Authentication Codes
  // ===========================

  /**
   * Create 2FA code
   */
  async create2FACode(
    userId: number,
    code: string,
    expiresAt: Date
  ): Promise<TwoFactorCode> {
    // Delete any existing unused codes for this user
    await db.delete(twoFactorCodes)
      .where(and(
        eq(twoFactorCodes.userId, userId),
        eq(twoFactorCodes.used, false)
      ));

    const [twoFactorCode] = await db.insert(twoFactorCodes)
      .values({ userId, code, expiresAt })
      .returning();

    return twoFactorCode;
  }

  /**
   * Get and verify 2FA code
   */
  async get2FACode(userId: number, code: string): Promise<TwoFactorCode | null> {
    const result = await db.query.twoFactorCodes.findFirst({
      where: and(
        eq(twoFactorCodes.userId, userId),
        eq(twoFactorCodes.code, code),
        eq(twoFactorCodes.used, false)
      )
    });

    return result || null;
  }

  /**
   * Mark 2FA code as used
   */
  async mark2FACodeAsUsed(codeId: number): Promise<void> {
    await db.update(twoFactorCodes)
      .set({ used: true })
      .where(eq(twoFactorCodes.id, codeId));
  }

  // ===========================
  // Notification Preferences
  // ===========================

  /**
   * Get notification preferences for a user
   */
  async getNotificationPreferences(userId: number): Promise<NotificationPreference | null> {
    const result = await db.query.notificationPreferences.findFirst({
      where: eq(notificationPreferences.userId, userId)
    });

    return result || null;
  }

  /**
   * Update notification preferences
   */
  async updateNotificationPreferences(
    userId: number,
    preferences: Partial<NotificationPreference>
  ): Promise<NotificationPreference> {
    const existing = await this.getNotificationPreferences(userId);

    if (existing) {
      // Update existing preferences
      const [updated] = await db.update(notificationPreferences)
        .set({ ...preferences, updatedAt: new Date() })
        .where(eq(notificationPreferences.userId, userId))
        .returning();
      return updated;
    } else {
      // Create new preferences with defaults
      const [newPrefs] = await db.insert(notificationPreferences)
        .values({
          userId,
          emailOnComparison: preferences.emailOnComparison ?? true,
          emailOnError: preferences.emailOnError ?? true,
          emailWeeklySummary: preferences.emailWeeklySummary ?? false,
        })
        .returning();
      return newPrefs;
    }
  }
}

// Export a singleton instance of the storage service
export const storage = new StorageService();
