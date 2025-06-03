var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// server/index.ts
import express2 from "express";

// server/routes.ts
import { createServer } from "http";

// shared/schema.ts
var schema_exports = {};
__export(schema_exports, {
  comparisonItems: () => comparisonItems,
  comparisonItemsRelations: () => comparisonItemsRelations,
  comparisonMetadata: () => comparisonMetadata,
  comparisonMetadataRelations: () => comparisonMetadataRelations,
  comparisons: () => comparisons,
  comparisonsRelations: () => comparisonsRelations,
  insertComparisonItemSchema: () => insertComparisonItemSchema,
  insertComparisonMetadataSchema: () => insertComparisonMetadataSchema,
  insertComparisonSchema: () => insertComparisonSchema,
  insertSessionSchema: () => insertSessionSchema,
  insertSettingsSchema: () => insertSettingsSchema,
  insertUserSchema: () => insertUserSchema,
  loginUserSchema: () => loginUserSchema,
  pgSessions: () => pgSessions,
  sessions: () => sessions,
  sessionsRelations: () => sessionsRelations,
  settings: () => settings,
  users: () => users,
  usersRelations: () => usersRelations
});
import { pgTable, text, serial, integer, boolean, timestamp, json } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { relations } from "drizzle-orm";
import { z } from "zod";
var users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  // Almacenará contraseña hasheada
  email: text("email").notNull().unique(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});
var insertUserSchema = createInsertSchema(users, {
  username: (schema) => schema.min(3, "El nombre de usuario debe tener al menos 3 caracteres"),
  password: (schema) => schema.min(6, "La contrase\xF1a debe tener al menos 6 caracteres"),
  email: (schema) => schema.email("Debe proporcionar un email v\xE1lido")
}).pick({
  username: true,
  password: true,
  email: true,
  firstName: true,
  lastName: true
});
var loginUserSchema = z.object({
  username: z.string().min(1, "El nombre de usuario es requerido"),
  password: z.string().min(1, "La contrase\xF1a es requerida")
});
var sessions = pgTable("sessions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  // Referencia al usuario que creó la sesión
  invoiceFilename: text("invoice_filename").notNull(),
  deliveryOrderFilename: text("delivery_order_filename").notNull(),
  status: text("status").notNull().default("processing"),
  // processing, completed, error
  matchCount: integer("match_count").notNull().default(0),
  warningCount: integer("warning_count").notNull().default(0),
  errorCount: integer("error_count").notNull().default(0),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at")
});
var comparisons = pgTable("comparisons", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  // Referencia al usuario que creó la comparación
  sessionId: integer("session_id").notNull().references(() => sessions.id),
  invoiceFilename: text("invoice_filename").notNull(),
  deliveryOrderFilename: text("delivery_order_filename").notNull(),
  matchCount: integer("match_count").notNull().default(0),
  warningCount: integer("warning_count").notNull().default(0),
  errorCount: integer("error_count").notNull().default(0),
  rawData: json("raw_data").default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  isPermanent: boolean("is_permanent").default(true)
  // Indica si es un guardado permanente o temporal
});
var comparisonItems = pgTable("comparison_items", {
  id: serial("id").primaryKey(),
  comparisonId: integer("comparison_id").notNull().references(() => comparisons.id),
  productName: text("product_name").notNull(),
  invoiceValue: text("invoice_value").notNull(),
  deliveryOrderValue: text("delivery_order_value").notNull(),
  status: text("status").notNull(),
  // match, warning, error
  note: text("note")
});
var comparisonMetadata = pgTable("comparison_metadata", {
  id: serial("id").primaryKey(),
  comparisonId: integer("comparison_id").notNull().references(() => comparisons.id),
  field: text("field").notNull(),
  invoiceValue: text("invoice_value").notNull(),
  deliveryOrderValue: text("delivery_order_value").notNull(),
  status: text("status").notNull()
  // match, warning, error
});
var pgSessions = pgTable("session", {
  sid: text("sid").primaryKey(),
  sess: json("sess").notNull(),
  expire: timestamp("expire", { withTimezone: true }).notNull()
});
var settings = pgTable("settings", {
  id: serial("id").primaryKey(),
  api4aiKey: text("api4ai_key"),
  openaiKey: text("openai_key"),
  openaiModel: text("openai_model").default("gpt-4o"),
  fallbackToMiniModel: boolean("fallback_to_mini_model").default(true),
  autoSaveResults: boolean("auto_save_results").default(false),
  maxFileSize: integer("max_file_size").default(10),
  // in MB
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});
var usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  comparisons: many(comparisons)
}));
var sessionsRelations = relations(sessions, ({ one, many }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id]
  }),
  comparisons: many(comparisons)
}));
var comparisonsRelations = relations(comparisons, ({ one, many }) => ({
  user: one(users, {
    fields: [comparisons.userId],
    references: [users.id]
  }),
  session: one(sessions, {
    fields: [comparisons.sessionId],
    references: [sessions.id]
  }),
  items: many(comparisonItems),
  metadata: many(comparisonMetadata)
}));
var comparisonItemsRelations = relations(comparisonItems, ({ one }) => ({
  comparison: one(comparisons, {
    fields: [comparisonItems.comparisonId],
    references: [comparisons.id]
  })
}));
var comparisonMetadataRelations = relations(comparisonMetadata, ({ one }) => ({
  comparison: one(comparisons, {
    fields: [comparisonMetadata.comparisonId],
    references: [comparisons.id]
  })
}));
var insertSessionSchema = createInsertSchema(sessions);
var insertComparisonSchema = createInsertSchema(comparisons);
var insertComparisonItemSchema = createInsertSchema(comparisonItems);
var insertComparisonMetadataSchema = createInsertSchema(comparisonMetadata);
var insertSettingsSchema = createInsertSchema(settings);

// db/index.ts
import dotenv from "dotenv";
dotenv.config();
var dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  throw new Error("DATABASE_URL must be set. Did you forget to provision a database?");
}
var db;
if (dbUrl.includes("localhost") || dbUrl.includes("127.0.0.1")) {
  const { Pool } = await import("pg");
  const { drizzle } = await import("drizzle-orm/node-postgres");
  const pool = new Pool({ connectionString: dbUrl });
  db = drizzle(pool, { schema: schema_exports });
  console.log("\u2705 Using local Postgres via pg");
} else {
  const { Pool, neonConfig } = await import("@neondatabase/serverless");
  const { drizzle } = await import("drizzle-orm/neon-serverless");
  const ws = (await import("ws")).default;
  neonConfig.webSocketConstructor = ws;
  const pool = new Pool({ connectionString: dbUrl });
  db = drizzle({ client: pool, schema: schema_exports });
  console.log("\u2705 Using Neon via WebSocket");
}

// server/storage.ts
import { eq, desc } from "drizzle-orm";
var StorageService = class {
  /**
   * Create a new processing session
   */
  async createSession(invoiceFilename, deliveryOrderFilename, userId) {
    const [session2] = await db.insert(sessions).values({
      userId,
      invoiceFilename,
      deliveryOrderFilename,
      status: "processing",
      matchCount: 0,
      warningCount: 0,
      errorCount: 0
    }).returning();
    return session2;
  }
  /**
   * Update session status
   */
  async updateSessionStatus(sessionId, status, errorMessage) {
    await db.update(sessions).set({
      status,
      errorMessage,
      completedAt: status === "completed" ? /* @__PURE__ */ new Date() : void 0
    }).where(eq(sessions.id, sessionId));
  }
  /**
   * Get session by ID
   */
  async getSession(sessionId) {
    const result = await db.query.sessions.findFirst({
      where: eq(sessions.id, sessionId)
    });
    return result;
  }
  /**
   * Get all sessions
   */
  async getAllSessions(limit, offset) {
    return await db.query.sessions.findMany({
      orderBy: desc(sessions.createdAt),
      limit: limit || void 0,
      offset: offset || void 0
    });
  }
  /**
   * Save comparison result
   */
  async saveComparisonResult(sessionId, result, userId) {
    const [comparison] = await db.insert(comparisons).values({
      sessionId,
      userId,
      invoiceFilename: result.invoiceFilename,
      deliveryOrderFilename: result.deliveryOrderFilename,
      matchCount: result.summary.matches,
      warningCount: result.summary.warnings,
      errorCount: result.summary.errors,
      rawData: result.rawData || {}
    }).returning();
    if (result.items && result.items.length > 0) {
      await db.insert(comparisonItems).values(
        result.items.map((item) => ({
          comparisonId: comparison.id,
          productName: item.productName,
          invoiceValue: item.invoiceValue,
          deliveryOrderValue: item.deliveryOrderValue,
          status: item.status,
          note: item.note || null
        }))
      );
    }
    if (result.metadata && result.metadata.length > 0) {
      await db.insert(comparisonMetadata).values(
        result.metadata.map((meta) => ({
          comparisonId: comparison.id,
          field: meta.field,
          invoiceValue: meta.invoiceValue,
          deliveryOrderValue: meta.deliveryOrderValue,
          status: meta.status
        }))
      );
    }
    await db.update(sessions).set({
      status: "completed",
      matchCount: result.summary.matches,
      warningCount: result.summary.warnings,
      errorCount: result.summary.errors,
      completedAt: /* @__PURE__ */ new Date()
    }).where(eq(sessions.id, sessionId));
    return comparison;
  }
  /**
   * Get comparison by ID with all related items and metadata
   */
  async getComparison(comparisonId) {
    const comparison = await db.query.comparisons.findFirst({
      where: eq(comparisons.id, comparisonId),
      with: {
        items: true,
        metadata: true
      }
    });
    if (!comparison) return null;
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
        errors: comparison.errorCount
      },
      items: comparison.items.map((item) => ({
        productName: item.productName,
        invoiceValue: item.invoiceValue,
        deliveryOrderValue: item.deliveryOrderValue,
        status: item.status,
        note: item.note || void 0
      })),
      metadata: comparison.metadata.map((meta) => ({
        field: meta.field,
        invoiceValue: meta.invoiceValue,
        deliveryOrderValue: meta.deliveryOrderValue,
        status: meta.status
      })),
      rawData: comparison.rawData
    };
  }
  /**
   * Get the latest comparison for a session
   */
  async getLatestComparison(sessionId) {
    const comparison = await db.query.comparisons.findFirst({
      where: eq(comparisons.sessionId, sessionId),
      orderBy: desc(comparisons.createdAt),
      with: {
        items: true,
        metadata: true
      }
    });
    if (!comparison) return null;
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
        errors: comparison.errorCount
      },
      items: comparison.items.map((item) => ({
        productName: item.productName,
        invoiceValue: item.invoiceValue,
        deliveryOrderValue: item.deliveryOrderValue,
        status: item.status,
        note: item.note || void 0
      })),
      metadata: comparison.metadata.map((meta) => ({
        field: meta.field,
        invoiceValue: meta.invoiceValue,
        deliveryOrderValue: meta.deliveryOrderValue,
        status: meta.status
      })),
      rawData: comparison.rawData
    };
  }
  /**
   * Get the most recent comparison overall
   */
  async getMostRecentComparison() {
    const comparison = await db.query.comparisons.findFirst({
      orderBy: desc(comparisons.createdAt),
      with: {
        items: true,
        metadata: true
      }
    });
    if (!comparison) return null;
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
        errors: comparison.errorCount
      },
      items: comparison.items.map((item) => ({
        productName: item.productName,
        invoiceValue: item.invoiceValue,
        deliveryOrderValue: item.deliveryOrderValue,
        status: item.status,
        note: item.note || void 0
      })),
      metadata: comparison.metadata.map((meta) => ({
        field: meta.field,
        invoiceValue: meta.invoiceValue,
        deliveryOrderValue: meta.deliveryOrderValue,
        status: meta.status
      })),
      rawData: comparison.rawData
    };
  }
  /**
   * Get all comparisons for a session
   */
  async getComparisonsBySessionId(sessionId) {
    const sessionComparisons = await db.query.comparisons.findMany({
      where: eq(comparisons.sessionId, sessionId),
      orderBy: desc(comparisons.createdAt),
      with: {
        items: true,
        metadata: true
      }
    });
    return sessionComparisons.map((comparison) => ({
      id: comparison.id.toString(),
      sessionId: comparison.sessionId,
      invoiceFilename: comparison.invoiceFilename,
      deliveryOrderFilename: comparison.deliveryOrderFilename,
      createdAt: comparison.createdAt.toISOString(),
      summary: {
        matches: comparison.matchCount,
        warnings: comparison.warningCount,
        errors: comparison.errorCount
      },
      items: comparison.items.map((item) => ({
        productName: item.productName,
        invoiceValue: item.invoiceValue,
        deliveryOrderValue: item.deliveryOrderValue,
        status: item.status,
        note: item.note || void 0
      })),
      metadata: comparison.metadata.map((meta) => ({
        field: meta.field,
        invoiceValue: meta.invoiceValue,
        deliveryOrderValue: meta.deliveryOrderValue,
        status: meta.status
      })),
      rawData: comparison.rawData,
      matchCount: comparison.matchCount,
      warningCount: comparison.warningCount,
      errorCount: comparison.errorCount
    }));
  }
  /**
   * Get all comparisons for a session
   */
  async getSessionComparisons(sessionId) {
    const comparisonList = await db.query.comparisons.findMany({
      where: eq(comparisons.sessionId, sessionId),
      orderBy: desc(comparisons.createdAt),
      with: {
        items: true,
        metadata: true
      }
    });
    return comparisonList.map((comparison) => ({
      id: comparison.id.toString(),
      invoiceFilename: comparison.invoiceFilename,
      deliveryOrderFilename: comparison.deliveryOrderFilename,
      createdAt: comparison.createdAt.toISOString(),
      summary: {
        matches: comparison.matchCount,
        warnings: comparison.warningCount,
        errors: comparison.errorCount
      },
      items: comparison.items.map((item) => ({
        productName: item.productName,
        invoiceValue: item.invoiceValue,
        deliveryOrderValue: item.deliveryOrderValue,
        status: item.status,
        note: item.note || void 0
      })),
      metadata: comparison.metadata.map((meta) => ({
        field: meta.field,
        invoiceValue: meta.invoiceValue,
        deliveryOrderValue: meta.deliveryOrderValue,
        status: meta.status
      })),
      rawData: comparison.rawData
    }));
  }
  /**
   * Save or update application settings
   */
  async saveSettings(settingsData) {
    const existingSettings = await db.query.settings.findFirst();
    if (existingSettings) {
      const [updated] = await db.update(settings).set(settingsData).where(eq(settings.id, existingSettings.id)).returning();
      return updated;
    } else {
      const [newSettings] = await db.insert(settings).values(settingsData).returning();
      return newSettings;
    }
  }
  /**
   * Get application settings
   */
  async getSettings() {
    const settingsData = await db.query.settings.findFirst();
    return settingsData || null;
  }
};
var storage = new StorageService();

// server/ocr.ts
import axios from "axios";
import FormData from "form-data";
import fs from "fs";
import path from "path";
import util from "util";
import { pipeline } from "stream";
import { v4 as uuidv4 } from "uuid";
import os from "os";
import dotenv2 from "dotenv";

// server/utils.ts
import puppeteer from "puppeteer";
import ExcelJS from "exceljs";
async function exportToPdf(comparison) {
  const htmlContent = createHtmlReport(comparison);
  const browser = await puppeteer.launch({
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });
  const page = await browser.newPage();
  await page.setContent(htmlContent);
  await page.addStyleTag({
    content: `
      body {
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        color: #333;
        margin: 0;
        padding: 20px;
      }
      .report-header {
        text-align: center;
        margin-bottom: 20px;
      }
      .report-title {
        font-size: 24px;
        font-weight: bold;
      }
      .report-subtitle {
        font-size: 16px;
        color: #666;
      }
      .summary-grid {
        display: flex;
        justify-content: space-between;
        margin-bottom: 20px;
      }
      .summary-card {
        border: 1px solid #ddd;
        border-radius: 4px;
        padding: 10px;
        width: 30%;
      }
      .summary-card h3 {
        margin-top: 0;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        margin-bottom: 20px;
      }
      th, td {
        border: 1px solid #ddd;
        padding: 8px;
        text-align: left;
      }
      th {
        background-color: #f2f2f2;
      }
      .match {
        background-color: #d4edda;
      }
      .warning {
        background-color: #fff3cd;
      }
      .error {
        background-color: #f8d7da;
      }
      .status-badge {
        padding: 3px 6px;
        border-radius: 3px;
        font-size: 12px;
      }
      .status-match {
        background-color: #28a745;
        color: white;
      }
      .status-warning {
        background-color: #ffc107;
        color: #333;
      }
      .status-error {
        background-color: #dc3545;
        color: white;
      }
      .report-footer {
        margin-top: 30px;
        font-size: 12px;
        color: #666;
        text-align: center;
      }
    `
  });
  const pdfBuffer = await page.pdf({
    format: "A4",
    printBackground: true,
    margin: {
      top: "20px",
      right: "20px",
      bottom: "20px",
      left: "20px"
    }
  });
  await browser.close();
  return pdfBuffer;
}
async function exportToExcel(comparison) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "OCR-Matcher AI";
  workbook.created = /* @__PURE__ */ new Date();
  const summarySheet = workbook.addWorksheet("Resumen");
  summarySheet.mergeCells("A1:E1");
  const titleCell = summarySheet.getCell("A1");
  titleCell.value = "Reporte de Comparaci\xF3n";
  titleCell.font = { size: 16, bold: true };
  titleCell.alignment = { horizontal: "center" };
  summarySheet.mergeCells("A2:E2");
  const subtitleCell = summarySheet.getCell("A2");
  subtitleCell.value = `${comparison.invoiceFilename} vs ${comparison.deliveryOrderFilename}`;
  subtitleCell.font = { size: 12 };
  subtitleCell.alignment = { horizontal: "center" };
  summarySheet.mergeCells("A3:E3");
  const dateCell = summarySheet.getCell("A3");
  dateCell.value = `Fecha: ${new Date(comparison.createdAt).toLocaleDateString()}`;
  dateCell.font = { size: 12 };
  dateCell.alignment = { horizontal: "center" };
  summarySheet.addRow([]);
  summarySheet.addRow(["Resumen de Resultados"]);
  summarySheet.getCell("A5").font = { bold: true, size: 14 };
  summarySheet.addRow(["Coincidencias", comparison.summary.matches]);
  summarySheet.addRow(["Advertencias", comparison.summary.warnings]);
  summarySheet.addRow(["Discrepancias", comparison.summary.errors]);
  const productsSheet = workbook.addWorksheet("Productos");
  productsSheet.columns = [
    { header: "Producto", key: "product", width: 30 },
    { header: "Factura", key: "invoice", width: 20 },
    { header: "Orden de Entrega", key: "deliveryOrder", width: 20 },
    { header: "Estado", key: "status", width: 15 },
    { header: "Nota", key: "note", width: 40 }
  ];
  productsSheet.getRow(1).font = { bold: true };
  productsSheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFD3D3D3" }
  };
  comparison.items.forEach((item) => {
    const row = productsSheet.addRow([
      item.productName,
      item.invoiceValue,
      item.deliveryOrderValue,
      getStatusText(item.status),
      item.note || ""
    ]);
    const fillColor = getStatusColor(item.status);
    row.getCell("D").fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: fillColor }
    };
    if (item.status === "warning" || item.status === "error") {
      row.getCell("B").fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFFFF0E0" }
      };
      row.getCell("C").fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFFFF0E0" }
      };
    }
  });
  const metadataSheet = workbook.addWorksheet("Metadatos");
  metadataSheet.columns = [
    { header: "Campo", key: "field", width: 30 },
    { header: "Factura", key: "invoice", width: 30 },
    { header: "Orden de Entrega", key: "deliveryOrder", width: 30 },
    { header: "Estado", key: "status", width: 15 }
  ];
  metadataSheet.getRow(1).font = { bold: true };
  metadataSheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFD3D3D3" }
  };
  comparison.metadata.forEach((meta) => {
    const row = metadataSheet.addRow([
      meta.field,
      meta.invoiceValue,
      meta.deliveryOrderValue,
      getStatusText(meta.status)
    ]);
    const fillColor = getStatusColor(meta.status);
    row.getCell("D").fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: fillColor }
    };
    if (meta.status === "warning" || meta.status === "error") {
      row.getCell("B").fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFFFF0E0" }
      };
      row.getCell("C").fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFFFF0E0" }
      };
    }
  });
  return await workbook.xlsx.writeBuffer();
}
function createHtmlReport(comparison) {
  const reportDate = new Date(comparison.createdAt).toLocaleDateString();
  let html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Comparison Report</title>
      <meta charset="UTF-8">
    </head>
    <body>
      <div class="report-header">
        <div class="report-title">Reporte de Comparaci\xF3n</div>
        <div class="report-subtitle">${comparison.invoiceFilename} vs ${comparison.deliveryOrderFilename}</div>
        <div>Fecha: ${reportDate}</div>
      </div>
      
      <div class="summary-grid">
        <div class="summary-card">
          <h3>Coincidencias</h3>
          <div>${comparison.summary.matches}</div>
        </div>
        <div class="summary-card">
          <h3>Advertencias</h3>
          <div>${comparison.summary.warnings}</div>
        </div>
        <div class="summary-card">
          <h3>Discrepancias</h3>
          <div>${comparison.summary.errors}</div>
        </div>
      </div>
      
      <h2>Productos</h2>
      <table>
        <thead>
          <tr>
            <th>Producto</th>
            <th>Factura</th>
            <th>Orden de Entrega</th>
            <th>Estado</th>
            <th>Nota</th>
          </tr>
        </thead>
        <tbody>
  `;
  comparison.items.forEach((item) => {
    const statusClass = item.status;
    const statusBadgeClass = `status-badge status-${item.status}`;
    html += `
      <tr>
        <td>${item.productName}</td>
        <td class="${statusClass === "match" ? "" : statusClass}">${item.invoiceValue}</td>
        <td class="${statusClass === "match" ? "" : statusClass}">${item.deliveryOrderValue}</td>
        <td><span class="${statusBadgeClass}">${getStatusText(item.status)}</span></td>
        <td>${item.note || "-"}</td>
      </tr>
    `;
  });
  html += `
        </tbody>
      </table>
      
      <h2>Metadatos</h2>
      <table>
        <thead>
          <tr>
            <th>Campo</th>
            <th>Factura</th>
            <th>Orden de Entrega</th>
            <th>Estado</th>
          </tr>
        </thead>
        <tbody>
  `;
  comparison.metadata.forEach((meta) => {
    const statusClass = meta.status;
    const statusBadgeClass = `status-badge status-${meta.status}`;
    html += `
      <tr>
        <td>${meta.field}</td>
        <td class="${statusClass === "match" ? "" : statusClass}">${meta.invoiceValue}</td>
        <td class="${statusClass === "match" ? "" : statusClass}">${meta.deliveryOrderValue}</td>
        <td><span class="${statusBadgeClass}">${getStatusText(meta.status)}</span></td>
      </tr>
    `;
  });
  html += `
        </tbody>
      </table>
      
      <div class="report-footer">
        <p>Generado por OCR-Matcher AI \u2022 ${(/* @__PURE__ */ new Date()).toLocaleString()}</p>
      </div>
    </body>
    </html>
  `;
  return html;
}
function getStatusText(status) {
  switch (status) {
    case "match":
      return "Coincidente";
    case "warning":
      return "Advertencia";
    case "error":
      return "Discrepancia";
    default:
      return status;
  }
}
function getStatusColor(status) {
  switch (status) {
    case "match":
      return "FF90EE90";
    // Light green
    case "warning":
      return "FFFFFFE0";
    // Light yellow
    case "error":
      return "FFFFCCCB";
    // Light red
    default:
      return "FFFFFFFF";
  }
}
function normalizeProductString(str) {
  return str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/(\d+)\s?ml/g, "$1").replace(/(\d+(\.\d+)?)\s?l\b/g, (_, val) => `${parseFloat(val) * 1e3}`).replace(/\bp\b|\bpz\b|\s+de\s+|\s+con\s+/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}

// server/ocr.ts
dotenv2.config();
var streamPipeline = util.promisify(pipeline);
var OcrService = class {
  apiKey;
  tempDir;
  constructor(apiKey, tempDir) {
    this.apiKey = apiKey;
    this.tempDir = tempDir || path.join(os.tmpdir(), "ocr-matcher");
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
      try {
        fs.chmodSync(this.tempDir, 511);
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
  async extractText(filePath) {
    try {
      console.log("Procesando archivo:", filePath);
      if (!fs.existsSync(filePath)) {
        console.error(`El archivo ${filePath} no existe`);
        return {
          text: "",
          error: `El archivo no existe o no es accesible: ${filePath}`
        };
      }
      const form = new FormData();
      try {
        const fileBuffer = fs.readFileSync(filePath);
        form.append("image", fileBuffer, path.basename(filePath));
      } catch (readError) {
        const errorMessage = readError instanceof Error ? readError.message : String(readError);
        console.error("Error al leer el archivo:", errorMessage);
        return {
          text: "",
          error: `Error al leer el archivo: ${errorMessage}`
        };
      }
      console.log("Enviando archivo a API4AI OCR...");
      const response = await axios({
        method: "post",
        url: "https://ocr43.p.rapidapi.com/v1/results",
        data: form,
        headers: {
          "x-rapidapi-key": this.apiKey,
          "x-rapidapi-host": "ocr43.p.rapidapi.com",
          "Content-Type": "multipart/form-data"
        }
      });
      const result = await response.data;
      if (!response.status) {
        console.error("API4AI OCR error:", result);
        return {
          text: "",
          error: `API4AI Error: ${result?.message || "Unknown error"}`
        };
      }
      const newRawText = newExtractRawText(result);
      return {
        text: newRawText
      };
    } catch (error) {
      console.error("OCR extraction error:", error);
      return {
        text: "",
        error: `OCR Error: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
  /**
   * Split a PDF file into individual pages for processing
   * @param filePath Path to PDF file
   * @returns Array of paths to individual page files
   */
  async splitPdf(filePath) {
    try {
      return [filePath];
    } catch (error) {
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
  async saveFile(buffer, originalFilename) {
    const filename = `${uuidv4()}-${originalFilename}`;
    const filePath = path.join(this.tempDir, filename);
    await fs.promises.writeFile(filePath, buffer);
    return filePath;
  }
  /**
   * Clean up temporary files
   * @param filePaths Array of file paths to delete
   */
  async cleanupFiles(filePaths) {
    for (const filePath of filePaths) {
      try {
        if (fs.existsSync(filePath)) {
          await fs.promises.unlink(filePath);
          console.log(`Archivo temporal eliminado: ${filePath}`);
        } else {
          console.warn(`El archivo ${filePath} no existe, no se puede eliminar`);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`Error al eliminar archivo ${filePath}: ${errorMessage}`);
      }
    }
  }
};
function newExtractRawText(result) {
  let fullText = "";
  if (result.results?.text_blocks) {
    console.log("Procesando texto extra\xEDdo usando formato text_blocks standard");
    result.results.text_blocks.forEach((block) => {
      if (block.text) {
        fullText += normalizeProductString(block.text) + "\n";
      }
    });
  } else if (Array.isArray(result.results)) {
    console.log("Procesando texto extra\xEDdo usando formato alternativo");
    result.results?.forEach((page) => {
      page.entities?.forEach((entity) => {
        entity.objects?.forEach((obj) => {
          obj.entities?.forEach((innerEntity) => {
            if (innerEntity.text) {
              fullText += normalizeProductString(innerEntity.text) + "\n";
            }
          });
        });
      });
    });
  }
  const trimmedText = fullText.trim();
  if (!trimmedText) {
    console.warn("No se pudo extraer texto del documento. Respuesta:", JSON.stringify(result).substring(0, 500) + "...");
  } else {
    console.log(`Texto extra\xEDdo exitosamente (${trimmedText.length} caracteres)`);
  }
  return trimmedText;
}
function getOcrService() {
  const apiKey = process.env.API4AI_KEY || "";
  if (!apiKey) {
    console.warn("API4AI_KEY environment variable is not set");
  }
  return new OcrService(apiKey);
}

// server/matcher.ts
import OpenAI from "openai";
import dotenv3 from "dotenv";
dotenv3.config();
var MatcherService = class {
  openai;
  primaryModel;
  fallbackModel;
  useFallback;
  constructor(apiKey, primaryModel = "gpt-4o", fallbackModel = "gpt-4o-mini", useFallback = true) {
    this.openai = new OpenAI({ apiKey });
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
  async compareDocuments(invoiceText, deliveryOrderText, invoiceFilename, deliveryOrderFilename) {
    try {
      const prompt = this.buildProductExtractionPrompt(
        invoiceText,
        deliveryOrderText
      );
      const response = await this.callOpenAI(prompt);
      const aiResult = JSON.parse(response);
      return this.formatComparisonResult(
        aiResult,
        invoiceFilename,
        deliveryOrderFilename
      );
    } catch (error) {
      console.error("AI comparison error:", error);
      throw new Error(
        `AI comparison failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
  /**
   * Call OpenAI API with fallback logic
   * @param prompt Prompt for OpenAI
   * @returns OpenAI response text
   */
  async callOpenAI(prompt) {
    try {
      const response = await this.openai.chat.completions.create({
        model: this.primaryModel,
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature: 0.1
        // Low temperature for more consistent results
      });
      return response.choices[0].message.content || "{}";
    } catch (error) {
      console.error(`Error with primary model (${this.primaryModel}):`, error);
      if (this.useFallback) {
        console.log(`Falling back to ${this.fallbackModel}`);
        try {
          const fallbackResponse = await this.openai.chat.completions.create({
            model: this.fallbackModel,
            messages: [{ role: "user", content: prompt }],
            response_format: { type: "json_object" },
            temperature: 0.1
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
  buildProductExtractionPrompt(invoiceText, deliveryOrderText) {
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
  formatComparisonResult(aiResult, invoiceFilename, deliveryOrderFilename) {
    const id = this.generateId();
    const createdAt = (/* @__PURE__ */ new Date()).toISOString();
    const items = Array.isArray(aiResult.items) ? aiResult.items.map((item) => ({
      productName: item.productName || "Unknown Product",
      invoiceValue: item.invoiceValue || "",
      deliveryOrderValue: item.deliveryOrderValue || "",
      status: this.validateStatus(item.status),
      note: item.note || ""
    })) : [];
    const metadata = Array.isArray(aiResult.metadata) ? aiResult.metadata.map((meta) => ({
      field: meta.field || "Unknown Field",
      invoiceValue: meta.invoiceValue || "",
      deliveryOrderValue: meta.deliveryOrderValue || "",
      status: this.validateStatus(meta.status)
    })) : [];
    const summary = {
      matches: items.filter((item) => item.status === "match").length + metadata.filter((meta) => meta.status === "match").length,
      warnings: items.filter((item) => item.status === "warning").length + metadata.filter((meta) => meta.status === "warning").length,
      errors: items.filter((item) => item.status === "error").length + metadata.filter((meta) => meta.status === "error").length
    };
    return {
      id,
      invoiceFilename,
      deliveryOrderFilename,
      createdAt,
      summary,
      items,
      metadata,
      rawData: aiResult
      // Store original AI response for debugging
    };
  }
  /**
   * Generate a unique ID for a comparison
   */
  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substring(2, 7);
  }
  /**
   * Validate status field to ensure it's one of the expected values
   */
  validateStatus(status) {
    const validStatuses = ["match", "warning", "error"];
    return validStatuses.includes(status) ? status : "error";
  }
};
function getMatcherService() {
  const apiKey = process.env.OPENAI_KEY || "";
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  const useFallback = process.env.OPENAI_USE_FALLBACK !== "false";
  if (!apiKey) {
    console.warn("OPENAI_KEY environment variable is not set");
  }
  return new MatcherService(apiKey, model, "gpt-4o-mini", useFallback);
}

// server/auth.ts
import bcrypt from "bcrypt";
import { eq as eq2 } from "drizzle-orm";
import { z as z2 } from "zod";
var SALT_ROUNDS = 10;
var AuthService = class {
  /**
   * Registra un nuevo usuario en el sistema
   * @param userData Datos del usuario a registrar
   * @returns El usuario creado sin la contraseña
   */
  async registerUser(userData) {
    try {
      const validatedData = insertUserSchema.parse(userData);
      const existingUser = await db.query.users.findFirst({
        where: eq2(users.username, validatedData.username)
      });
      if (existingUser) {
        throw new Error("El nombre de usuario ya est\xE1 en uso");
      }
      const existingEmail = await db.query.users.findFirst({
        where: eq2(users.email, validatedData.email)
      });
      if (existingEmail) {
        throw new Error("El email ya est\xE1 en uso");
      }
      const hashedPassword = await bcrypt.hash(validatedData.password, SALT_ROUNDS);
      const [newUser] = await db.insert(users).values({
        ...validatedData,
        password: hashedPassword
      }).returning({
        id: users.id,
        username: users.username,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt
      });
      return newUser;
    } catch (error) {
      if (error instanceof z2.ZodError) {
        throw new Error(`Error de validaci\xF3n: ${error.errors.map((e) => e.message).join(", ")}`);
      }
      throw error;
    }
  }
  /**
   * Autentica a un usuario en el sistema
   * @param loginData Datos de inicio de sesión
   * @returns El usuario autenticado sin la contraseña
   */
  async loginUser(loginData) {
    try {
      const validatedData = loginUserSchema.parse(loginData);
      const user = await db.query.users.findFirst({
        where: eq2(users.username, validatedData.username)
      });
      if (!user) {
        throw new Error("Nombre de usuario o contrase\xF1a incorrectos");
      }
      const passwordMatch = await bcrypt.compare(validatedData.password, user.password);
      if (!passwordMatch) {
        throw new Error("Nombre de usuario o contrase\xF1a incorrectos");
      }
      const { password, ...userWithoutPassword } = user;
      return userWithoutPassword;
    } catch (error) {
      if (error instanceof z2.ZodError) {
        throw new Error(`Error de validaci\xF3n: ${error.errors.map((e) => e.message).join(", ")}`);
      }
      throw error;
    }
  }
  /**
   * Obtiene un usuario por su ID
   * @param userId ID del usuario
   * @returns El usuario sin la contraseña
   */
  async getUserById(userId) {
    const user = await db.query.users.findFirst({
      where: eq2(users.id, userId)
    });
    if (!user) {
      return null;
    }
    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }
};
var authService = new AuthService();

// server/auth-config.ts
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
var PgSession = connectPgSimple(session);
var pgStoreConfig = {
  conString: process.env.DATABASE_URL,
  // Usa la URL de conexión directa
  tableName: "session",
  // Nombre de la tabla de sesiones (definida en schema.ts)
  createTableIfMissing: true,
  ttl: 7 * 24 * 60 * 60
  // 7 días en segundos
};
var sessionConfig = {
  store: new PgSession(pgStoreConfig),
  secret: process.env.SESSION_SECRET || "ocr-matcher-secret-key-default",
  // Forzar guardar la sesión para asegurar persistencia
  resave: true,
  // Permite mantener la sesión "viva" con cada petición
  rolling: false,
  // Solo guarda sesiones iniciadas (mejora rendimiento y seguridad)
  saveUninitialized: false,
  name: "connect.sid",
  // Nombre estándar de express-session
  cookie: {
    maxAge: 30 * 24 * 60 * 60 * 1e3,
    // 30 días para persistencia mayor
    httpOnly: false,
    // Cambiar a false para permitir acceso desde JavaScript si es necesario
    secure: false,
    // Deshabilitar en desarrollo para que funcione en localhost
    sameSite: "lax",
    path: "/",
    // Asegura que la cookie está disponible en toda la aplicación
    domain: void 0
    // No especificar dominio para que funcione en cualquier host
  }
};
function configureAuth(app2) {
  app2.set("trust proxy", 1);
  app2.use(session(sessionConfig));
  app2.use(passport.initialize());
  app2.use(passport.session());
  passport.use(new LocalStrategy(async (username, password, done) => {
    try {
      const user = await authService.loginUser({ username, password });
      return done(null, user);
    } catch (error) {
      return done(error);
    }
  }));
  passport.serializeUser((user, done) => {
    done(null, user.id);
  });
  passport.deserializeUser(async (id, done) => {
    try {
      const user = await authService.getUserById(id);
      if (!user) {
        return done(null, false);
      }
      done(null, user);
    } catch (error) {
      console.error("Error deserializando usuario:", error);
      done(null, false);
    }
  });
}
function isAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ message: "Necesita iniciar sesi\xF3n para acceder a este recurso" });
}
function getUserId(req) {
  return req.user?.id;
}

// server/routes.ts
import passport2 from "passport";
import multer from "multer";
import path2 from "path";
import fs2 from "fs";
import os2 from "os";
import { desc as desc2 } from "drizzle-orm";
var processingState = {
  ocrProgress: 0,
  aiProgress: 0,
  files: [],
  isProcessing: false
};
var createTempDir = () => {
  const tempDir = path2.join(os2.tmpdir(), "ocr-matcher-uploads");
  if (!fs2.existsSync(tempDir)) {
    fs2.mkdirSync(tempDir, { recursive: true });
    try {
      fs2.chmodSync(tempDir, 511);
    } catch (error) {
      console.warn("No se pudieron establecer permisos en directorio temporal:", error);
    }
  }
  console.log("Directorio temporal para uploads:", tempDir);
  return tempDir;
};
var upload = multer({
  dest: createTempDir(),
  limits: {
    fileSize: 10 * 1024 * 1024
    // 10MB
  }
});
async function registerRoutes(app2) {
  const httpServer = createServer(app2);
  app2.use((req, res, next) => {
    const startTime = Date.now();
    console.log(`=== INCOMING REQUEST ===`);
    console.log(`${req.method} ${req.path}`);
    console.log(`Headers:`, JSON.stringify(req.headers, null, 2));
    console.log(`Query:`, req.query);
    console.log(`Body:`, req.body);
    console.log(`User Agent:`, req.get("User-Agent"));
    console.log(`IP:`, req.ip);
    console.log(`========================`);
    res.on("finish", () => {
      const duration = Date.now() - startTime;
      console.log(`=== RESPONSE COMPLETED ===`);
      console.log(`${req.method} ${req.path} -> ${res.statusCode} (${duration}ms)`);
      console.log(`==========================`);
    });
    next();
  });
  app2.get("/api/health", (req, res) => {
    const healthData = {
      status: "ok",
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      environment: process.env.NODE_ENV || "development",
      nodeVersion: process.version,
      database: {
        connected: true
        // We'll assume connected if no error
      },
      server: {
        port: process.env.PORT || 3e3,
        pid: process.pid
      }
    };
    console.log("Health check requested:", healthData);
    res.json(healthData);
  });
  app2.get("/api/health/db", async (req, res) => {
    try {
      const result = await db.query.users.findFirst();
      res.json({
        status: "ok",
        database: "connected",
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      });
    } catch (error) {
      console.error("Database health check failed:", error);
      res.status(500).json({
        status: "error",
        database: "disconnected",
        error: error instanceof Error ? error.message : String(error),
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      });
    }
  });
  app2.post("/api/auth/register", async (req, res) => {
    try {
      const newUser = await authService.registerUser(req.body);
      res.status(201).json(newUser);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  });
  app2.post("/api/auth/login", (req, res, next) => {
    passport2.authenticate("local", (err, user) => {
      if (err) {
        return res.status(500).json({ message: "Error en el servidor" });
      }
      if (!user) {
        return res.status(401).json({ message: "Credenciales inv\xE1lidas" });
      }
      req.logIn(user, (loginErr) => {
        if (loginErr) {
          return res.status(500).json({ message: "Error al iniciar sesi\xF3n" });
        }
        return res.status(200).json(user);
      });
    })(req, res, next);
  });
  app2.post("/api/auth/logout", (req, res) => {
    req.logout((err) => {
      if (err) {
        return res.status(500).json({ message: "Error al cerrar sesi\xF3n" });
      }
      res.status(200).json({ message: "Sesi\xF3n cerrada correctamente" });
    });
  });
  app2.get("/api/auth/me", (req, res) => {
    if (req.isAuthenticated && req.isAuthenticated()) {
      res.status(200).json(req.user);
    } else {
      res.status(401).json({ message: "No autenticado" });
    }
  });
  app2.get("/api/settings", async (req, res) => {
    try {
      const settings2 = await storage.getSettings();
      if (!settings2) {
        return res.json({
          api4aiKey: "",
          openaiKey: "",
          openaiModel: "gpt-4o",
          fallbackToMiniModel: true,
          autoSaveResults: false,
          maxFileSize: 10
        });
      }
      return res.json({
        api4aiKey: settings2.api4aiKey || "",
        openaiKey: settings2.openaiKey || "",
        openaiModel: settings2.openaiModel || "gpt-4o",
        fallbackToMiniModel: settings2.fallbackToMiniModel,
        autoSaveResults: settings2.autoSaveResults,
        maxFileSize: settings2.maxFileSize || 10
      });
    } catch (error) {
      console.error("Error fetching settings:", error);
      return res.status(500).json({
        message: `Error fetching settings: ${error instanceof Error ? error.message : String(error)}`
      });
    }
  });
  app2.post("/api/settings", async (req, res) => {
    try {
      const settingsData = req.body;
      const existingSettings = await storage.getSettings();
      const settingsToSave = {
        api4aiKey: settingsData.api4aiKey || "",
        openaiKey: settingsData.openaiKey || "",
        openaiModel: settingsData.openaiModel || "gpt-4o",
        fallbackToMiniModel: settingsData.fallbackToMiniModel || true,
        autoSaveResults: settingsData.autoSaveResults || false,
        maxFileSize: settingsData.maxFileSize || 10
      };
      if (existingSettings && existingSettings.id) {
        settingsToSave.id = existingSettings.id;
      }
      const updatedSettings = await storage.saveSettings(settingsToSave);
      if (settingsData.api4aiKey) {
        process.env.API4AI_KEY = settingsData.api4aiKey;
      }
      if (settingsData.openaiKey) {
        process.env.OPENAI_KEY = settingsData.openaiKey;
      }
      return res.json({ success: true, settings: updatedSettings });
    } catch (error) {
      console.error("Error updating settings:", error);
      return res.status(500).json({
        message: `Error updating settings: ${error instanceof Error ? error.message : String(error)}`
      });
    }
  });
  app2.post(
    "/api/upload",
    upload.fields([
      { name: "invoices", maxCount: 10 },
      { name: "deliveryOrders", maxCount: 10 }
    ]),
    async (req, res) => {
      try {
        const files = req.files;
        if (!files.invoices || !files.deliveryOrders) {
          return res.status(400).json({
            message: "You must upload at least one invoice and one delivery order"
          });
        }
        if (processingState.isProcessing) {
          return res.status(409).json({
            message: "Ya hay un procesamiento en curso. Por favor espere o cancele el procesamiento actual."
          });
        }
        const numPairs = Math.min(files.invoices.length, files.deliveryOrders.length);
        if (files.invoices.length !== files.deliveryOrders.length) {
          console.warn(`N\xFAmero de archivos no coincide: ${files.invoices.length} facturas vs ${files.deliveryOrders.length} \xF3rdenes. Se procesar\xE1n ${numPairs} pares.`);
        }
        console.log(`Iniciando procesamiento de ${numPairs} pares de documentos`);
        processingState.isProcessing = true;
        processingState.ocrProgress = 0;
        processingState.aiProgress = 0;
        processingState.files = [];
        processingState.error = void 0;
        processingState.sessionId = void 0;
        files.invoices.forEach((file) => {
          processingState.files.push({
            name: file.originalname,
            type: "invoice",
            size: file.size,
            status: "pending"
          });
        });
        files.deliveryOrders.forEach((file) => {
          processingState.files.push({
            name: file.originalname,
            type: "deliveryOrder",
            size: file.size,
            status: "pending"
          });
        });
        const userId = getUserId(req) || void 0;
        processFiles(files.invoices, files.deliveryOrders, userId || void 0).catch(
          (error) => {
            const errorMsg = error instanceof Error ? error.message : String(error);
            console.error("Error processing files:", errorMsg);
            processingState.isProcessing = false;
            processingState.error = `Error processing files: ${errorMsg}`;
          }
        );
        return res.status(202).json({
          message: `Lote de ${numPairs} pares iniciado exitosamente`,
          totalPairs: numPairs
        });
      } catch (error) {
        console.error("Error uploading files:", error);
        return res.status(500).json({
          message: `Error uploading files: ${error instanceof Error ? error.message : String(error)}`
        });
      }
    }
  );
  app2.get("/api/processing/status", (req, res) => {
    const status = {
      ocrProgress: processingState.ocrProgress,
      aiProgress: processingState.aiProgress,
      currentOcrFile: processingState.currentOcrFile,
      currentAiStage: processingState.currentAiStage,
      files: processingState.files,
      isProcessing: processingState.isProcessing,
      error: processingState.error
    };
    return res.json(status);
  });
  app2.post("/api/processing/cancel", async (req, res) => {
    if (!processingState.isProcessing) {
      return res.status(400).json({
        message: "No hay ning\xFAn procesamiento activo en este momento"
      });
    }
    processingState.isProcessing = false;
    processingState.ocrProgress = 0;
    processingState.aiProgress = 0;
    processingState.error = "Procesamiento cancelado por el usuario";
    console.log("Procesamiento cancelado correctamente");
    return res.json({
      message: "Procesamiento cancelado correctamente",
      success: true
    });
  });
  app2.get("/api/sessions", async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit) : 5;
      const sessions2 = await storage.getAllSessions(limit);
      return res.json(sessions2);
    } catch (error) {
      console.error("Error fetching sessions:", error);
      return res.status(500).json({
        message: `Error fetching sessions: ${error instanceof Error ? error.message : String(error)}`
      });
    }
  });
  app2.get("/api/sessions/all", async (req, res) => {
    try {
      const sessions2 = await storage.getAllSessions();
      return res.json(sessions2);
    } catch (error) {
      console.error("Error fetching all sessions:", error);
      return res.status(500).json({
        message: `Error fetching all sessions: ${error instanceof Error ? error.message : String(error)}`
      });
    }
  });
  app2.get("/api/sessions/:id", async (req, res) => {
    try {
      const sessionId = parseInt(req.params.id);
      if (isNaN(sessionId)) {
        return res.status(400).json({
          message: "Invalid session ID"
        });
      }
      const session2 = await storage.getSession(sessionId);
      if (!session2) {
        return res.status(404).json({
          message: "Session not found"
        });
      }
      return res.json(session2);
    } catch (error) {
      console.error("Error fetching session:", error);
      return res.status(500).json({
        message: `Error fetching session: ${error instanceof Error ? error.message : String(error)}`
      });
    }
  });
  app2.get("/api/comparisons/latest", async (req, res) => {
    try {
      const comparison = await storage.getMostRecentComparison();
      if (!comparison) {
        return res.status(404).json({
          message: "No comparisons found"
        });
      }
      return res.json(comparison);
    } catch (error) {
      console.error("Error fetching latest comparison:", error);
      return res.status(500).json({
        message: `Error fetching latest comparison: ${error instanceof Error ? error.message : String(error)}`
      });
    }
  });
  app2.get("/api/comparisons/recent", async (req, res) => {
    try {
      const latestComparison = await db.query.comparisons.findFirst({
        orderBy: desc2(comparisons.createdAt),
        with: {
          session: true
        }
      });
      console.log("DEBUG: Comparaci\xF3n m\xE1s reciente:", latestComparison ? {
        id: latestComparison.id,
        sessionId: latestComparison.sessionId,
        invoiceFilename: latestComparison.invoiceFilename,
        createdAt: latestComparison.createdAt
      } : "No encontrada");
      if (!latestComparison || !latestComparison.sessionId) {
        console.log("DEBUG: No hay comparaciones o sesiones disponibles");
        return res.json([]);
      }
      const sessionComparisons = await storage.getComparisonsBySessionId(latestComparison.sessionId);
      console.log(`DEBUG: Encontradas ${sessionComparisons.length} comparaciones de la sesi\xF3n ${latestComparison.sessionId}`);
      console.log("DEBUG: IDs de comparaciones:", sessionComparisons.map((c) => ({ id: c.id, invoice: c.invoiceFilename })));
      return res.json(sessionComparisons);
    } catch (error) {
      console.error("Error fetching recent comparisons:", error);
      return res.status(500).json({
        message: `Error fetching recent comparisons: ${error instanceof Error ? error.message : String(error)}`
      });
    }
  });
  app2.get("/api/comparisons/:id", isAuthenticated, async (req, res) => {
    try {
      const comparisonId = parseInt(req.params.id);
      if (isNaN(comparisonId)) {
        console.error(`ID de comparaci\xF3n inv\xE1lido recibido: "${req.params.id}"`);
        return res.status(400).json({
          message: "ID de comparaci\xF3n inv\xE1lido"
        });
      }
      console.log(`Solicitando comparaci\xF3n ID: ${comparisonId}`);
      const authReq = req;
      const userId = getUserId(authReq);
      if (!userId) {
        console.error("Solicitud sin usuario autenticado");
        return res.status(401).json({
          message: "Sesi\xF3n no v\xE1lida. Por favor inicie sesi\xF3n nuevamente."
        });
      }
      console.log(`Usuario ${userId} solicitando comparaci\xF3n ${comparisonId}`);
      const comparison = await storage.getComparison(comparisonId);
      if (!comparison) {
        console.error(`Comparaci\xF3n ID ${comparisonId} no encontrada en la base de datos`);
        return res.status(404).json({
          message: `Comparaci\xF3n con ID ${comparisonId} no encontrada. Por favor verifique que el ID es correcto.`
        });
      }
      const comparisonUserId = comparison.userId;
      if (comparisonUserId !== void 0 && comparisonUserId !== userId) {
        console.error(`Usuario ${userId} intent\xF3 acceder a comparaci\xF3n ${comparisonId} que pertenece a usuario ${comparisonUserId}`);
        return res.status(403).json({
          message: "No tienes permiso para acceder a esta comparaci\xF3n"
        });
      }
      console.log(`Comparaci\xF3n ${comparisonId} enviada exitosamente al usuario ${userId}`);
      return res.json(comparison);
    } catch (error) {
      console.error(`Error procesando solicitud de comparaci\xF3n:`, error);
      return res.status(500).json({
        message: `Error al obtener la comparaci\xF3n: ${error instanceof Error ? error.message : String(error)}`
      });
    }
  });
  app2.post("/api/comparisons/save", async (req, res) => {
    try {
      const { comparisonId } = req.body;
      if (!comparisonId) {
        return res.status(400).json({
          message: "Comparison ID is required"
        });
      }
      return res.json({
        message: "Comparison saved successfully",
        success: true
      });
    } catch (error) {
      console.error("Error saving comparison:", error);
      return res.status(500).json({
        message: `Error saving comparison: ${error instanceof Error ? error.message : String(error)}`
      });
    }
  });
  app2.get(
    "/api/comparisons/:id/export",
    async (req, res) => {
      try {
        const comparisonId = parseInt(req.params.id);
        if (isNaN(comparisonId)) {
          return res.status(400).json({
            message: "Invalid comparison ID"
          });
        }
        const format = req.query.format;
        if (!format || !["pdf", "excel"].includes(format)) {
          return res.status(400).json({
            message: "Invalid export format. Use 'pdf' or 'excel'"
          });
        }
        const comparison = await storage.getComparison(comparisonId);
        if (!comparison) {
          return res.status(404).json({
            message: "Comparison not found"
          });
        }
        if (format === "pdf") {
          const pdfBuffer = await exportToPdf(comparison);
          res.setHeader("Content-Type", "application/pdf");
          res.setHeader(
            "Content-Disposition",
            `attachment; filename=comparison-${comparisonId}.pdf`
          );
          return res.send(pdfBuffer);
        } else {
          const excelBuffer = await exportToExcel(comparison);
          res.setHeader(
            "Content-Type",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          );
          res.setHeader(
            "Content-Disposition",
            `attachment; filename=comparison-${comparisonId}.xlsx`
          );
          return res.send(excelBuffer);
        }
      } catch (error) {
        console.error("Error exporting comparison:", error);
        return res.status(500).json({
          message: `Error exporting comparison: ${error instanceof Error ? error.message : String(error)}`
        });
      }
    }
  );
  return httpServer;
}
async function processFiles(invoiceFiles, deliveryOrderFiles, userId) {
  const ocrService = getOcrService();
  const matcherService = getMatcherService();
  const allTempFiles = [];
  try {
    const numPairs = Math.min(invoiceFiles.length, deliveryOrderFiles.length);
    console.log(`Procesando ${numPairs} pares de documentos independientes`);
    for (let i = 0; i < numPairs; i++) {
      if (!processingState.isProcessing) {
        console.log("Procesamiento cancelado, deteniendo el bucle");
        break;
      }
      const invoiceFile = invoiceFiles[i];
      const deliveryFile = deliveryOrderFiles[i];
      console.log(`
=== Procesando par ${i + 1}/${numPairs} ===`);
      console.log(`Factura: ${invoiceFile.originalname}`);
      console.log(`Orden de entrega: ${deliveryFile.originalname}`);
      console.log(`Creando sesi\xF3n completamente nueva para par ${i + 1}: ${invoiceFile.originalname} + ${deliveryFile.originalname}`);
      const session2 = await storage.createSession(
        invoiceFile.originalname,
        deliveryFile.originalname,
        userId
      );
      const sessionId = session2.id;
      console.log(`\u2713 SESI\xD3N INDEPENDIENTE CREADA - ID: ${sessionId} para par ${i + 1}`);
      console.log(`   Factura: ${invoiceFile.originalname}`);
      console.log(`   Orden: ${deliveryFile.originalname}`);
      const invoiceFileEntry = processingState.files.find((f) => f.name === invoiceFile.originalname && f.type === "invoice");
      const deliveryFileEntry = processingState.files.find((f) => f.name === deliveryFile.originalname && f.type === "deliveryOrder");
      if (invoiceFileEntry) invoiceFileEntry.status = "processing";
      if (deliveryFileEntry) deliveryFileEntry.status = "processing";
      processingState.currentOcrFile = invoiceFile.originalname;
      try {
        console.log(`OCR: Procesando factura ${invoiceFile.originalname}`);
        const invoiceOcrResult = await ocrService.extractText(invoiceFile.path);
        if (invoiceOcrResult.error) {
          throw new Error(`OCR error en factura: ${invoiceOcrResult.error}`);
        }
        const invoiceText = invoiceOcrResult.text;
        const ocrCompletedFiles = i * 2 + 1;
        const totalFilesInBatch = numPairs * 2;
        processingState.ocrProgress = Math.floor(ocrCompletedFiles / totalFilesInBatch * 100);
        if (invoiceFileEntry) invoiceFileEntry.status = "completed";
        processingState.currentOcrFile = deliveryFile.originalname;
        console.log(`OCR: Procesando orden de entrega ${deliveryFile.originalname}`);
        const deliveryOcrResult = await ocrService.extractText(deliveryFile.path);
        if (deliveryOcrResult.error) {
          throw new Error(`OCR error en orden de entrega: ${deliveryOcrResult.error}`);
        }
        const deliveryText = deliveryOcrResult.text;
        const ocrCompletedFilesAfterDelivery = i * 2 + 2;
        processingState.ocrProgress = Math.floor(ocrCompletedFilesAfterDelivery / totalFilesInBatch * 100);
        if (deliveryFileEntry) deliveryFileEntry.status = "completed";
        processingState.currentOcrFile = void 0;
        const aiStartedPairs = i;
        processingState.aiProgress = Math.floor(aiStartedPairs / numPairs * 10);
        processingState.currentAiStage = `Analizando par ${i + 1}/${numPairs}`;
        console.log(`IA: Comparando documentos del par ${i + 1}`);
        const comparisonResult = await matcherService.compareDocuments(
          invoiceText,
          deliveryText,
          invoiceFile.originalname,
          deliveryFile.originalname
        );
        const aiCompletedPairs = i + 1;
        processingState.aiProgress = Math.floor(aiCompletedPairs / numPairs * 100);
        await storage.saveComparisonResult(sessionId, comparisonResult, userId);
        console.log(`Par ${i + 1} guardado exitosamente con sesi\xF3n ${sessionId}`);
        await ocrService.cleanupFiles([invoiceFile.path, deliveryFile.path]);
        await storage.updateSessionStatus(sessionId, "completed");
      } catch (pairError) {
        console.error(`Error procesando par ${i + 1}:`, pairError);
        await storage.updateSessionStatus(sessionId, "error", pairError instanceof Error ? pairError.message : String(pairError));
        if (invoiceFileEntry) invoiceFileEntry.status = "error";
        if (deliveryFileEntry) deliveryFileEntry.status = "error";
        const errorMessage = pairError instanceof Error ? pairError.message : String(pairError);
        processingState.error = `Error en par ${i + 1}: ${errorMessage}`;
        try {
          await ocrService.cleanupFiles([invoiceFile.path, deliveryFile.path]);
        } catch (cleanupError) {
          console.error("Error limpiando archivos del par con error:", cleanupError);
        }
      }
      allTempFiles.push(invoiceFile.path, deliveryFile.path);
    }
    processingState.isProcessing = false;
    if (!processingState.error) {
      processingState.ocrProgress = 100;
      processingState.aiProgress = 100;
      processingState.currentAiStage = "Procesamiento completado";
      console.log(`
=== Lote completado: ${numPairs} pares procesados ===`);
    } else {
      console.log(`
=== Lote completado con errores ===`);
    }
  } catch (error) {
    console.error("Error fatal durante el procesamiento del lote:", error);
    processingState.isProcessing = false;
    processingState.error = error instanceof Error ? error.message : String(error);
    if (allTempFiles.length > 0) {
      try {
        await ocrService.cleanupFiles(allTempFiles);
      } catch (cleanupError) {
        console.error("Error en limpieza final de archivos:", cleanupError);
      }
    }
    throw error;
  }
}

// server/vite.ts
import express from "express";
import fs3 from "fs";
import path4 from "path";
import { createServer as createViteServer, createLogger } from "vite";

// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path3 from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
var vite_config_default = defineConfig({
  plugins: [
    react(),
    runtimeErrorOverlay(),
    ...process.env.NODE_ENV !== "production" && process.env.REPL_ID !== void 0 ? [
      await import("@replit/vite-plugin-cartographer").then(
        (m) => m.cartographer()
      )
    ] : []
  ],
  resolve: {
    alias: {
      "@db": path3.resolve(import.meta.dirname, "db"),
      "@": path3.resolve(import.meta.dirname, "client", "src"),
      "@shared": path3.resolve(import.meta.dirname, "shared"),
      "@assets": path3.resolve(import.meta.dirname, "attached_assets")
    }
  },
  root: path3.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path3.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true
  }
});

// server/vite.ts
import { nanoid } from "nanoid";
var viteLogger = createLogger();
function log(message, source = "express") {
  const formattedTime = (/* @__PURE__ */ new Date()).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}
async function setupVite(app2, server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true
  };
  const vite = await createViteServer({
    ...vite_config_default,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      }
    },
    server: serverOptions,
    appType: "custom"
  });
  app2.use(vite.middlewares);
  app2.use("*", async (req, res, next) => {
    const url = req.originalUrl;
    try {
      const clientTemplate = path4.resolve(
        import.meta.dirname,
        "..",
        "client",
        "index.html"
      );
      let template = await fs3.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e);
      next(e);
    }
  });
}
function serveStatic(app2) {
  const distPath = path4.resolve(import.meta.dirname, "public");
  if (!fs3.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }
  app2.use(express.static(distPath));
  app2.use("*", (_req, res) => {
    res.sendFile(path4.resolve(distPath, "index.html"));
  });
}

// server/index.ts
import dotenv4 from "dotenv";
import path5 from "path";
import fs4 from "fs";
dotenv4.config();
var app = express2();
app.use(express2.json());
app.use(express2.urlencoded({ extended: false }));
configureAuth(app);
app.use((req, res, next) => {
  const start = Date.now();
  const path6 = req.path;
  let capturedJsonResponse = void 0;
  const originalResJson = res.json;
  res.json = function(bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path6.startsWith("/api")) {
      let logLine = `${req.method} ${path6} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "\u2026";
      }
      log(logLine);
    }
  });
  next();
});
app.get("/api/health", (req, res) => {
  res.status(200).json({
    status: "OK",
    message: "OCR Intelligence API is running",
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    environment: process.env.NODE_ENV || "development"
  });
});
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "healthy",
    uptime: process.uptime(),
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  });
});
(async () => {
  const server = await registerRoutes(app);
  app.use((err, req, res, _next) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    console.error("=== ERROR HANDLER TRIGGERED ===");
    console.error("URL:", req.method, req.url);
    console.error("Status:", status);
    console.error("Message:", message);
    console.error("Error Stack:", err.stack);
    console.error("Request Headers:", req.headers);
    console.error("Request Body:", req.body);
    console.error("================================");
    res.status(status).json({
      message,
      error: process.env.NODE_ENV === "development" ? err.stack : void 0
    });
  });
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    const distPath = path5.resolve(import.meta.dirname, "..", "dist", "public");
    if (fs4.existsSync(distPath)) {
      app.use(express2.static(distPath));
      app.get("*", (req, res) => {
        if (req.path.startsWith("/api")) {
          return res.status(404).json({ error: "API endpoint not found" });
        }
        res.sendFile(path5.resolve(distPath, "index.html"));
      });
    } else {
      console.error(`Build directory not found: ${distPath}`);
      serveStatic(app);
    }
  }
  const port = process.env.PORT ? parseInt(process.env.PORT) : 3e3;
  if (!process.env.NODE_ENV && process.env.PORT) {
    process.env.NODE_ENV = "production";
  }
  process.on("uncaughtException", (error) => {
    console.error("=== UNCAUGHT EXCEPTION ===");
    console.error("Error:", error);
    console.error("Stack:", error.stack);
    console.error("===========================");
  });
  process.on("unhandledRejection", (reason, promise) => {
    console.error("=== UNHANDLED REJECTION ===");
    console.error("Promise:", promise);
    console.error("Reason:", reason);
    console.error("============================");
  });
  server.listen(port, "0.0.0.0", () => {
    log(`Servidor OCR Intelligence iniciado en puerto ${port}`);
    log("Aplicaci\xF3n OCR Intelligence lista para usar");
    log(`Acceda a la aplicaci\xF3n a trav\xE9s de la pesta\xF1a WebView o en http://localhost:${port}`);
    log(`Process ID: ${process.pid}`);
    log(`Node.js version: ${process.version}`);
    log(`Environment: ${process.env.NODE_ENV || "development"}`);
  });
  setInterval(() => {
    const memUsage = process.memoryUsage();
    console.log(`=== SERVER HEALTH ===`);
    console.log(`Uptime: ${Math.floor(process.uptime())} seconds`);
    console.log(`Memory: RSS ${Math.round(memUsage.rss / 1024 / 1024)}MB, Heap ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`);
    console.log(`====================`);
  }, 6e4);
})();
