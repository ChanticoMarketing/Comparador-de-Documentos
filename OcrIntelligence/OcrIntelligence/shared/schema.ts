import { pgTable, text, serial, integer, boolean, timestamp, json } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { relations } from "drizzle-orm";
import { z } from "zod";

// Users (base schema from template)
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Sessions table for tracking comparison sessions
export const sessions = pgTable("sessions", {
  id: serial("id").primaryKey(),
  invoiceFilename: text("invoice_filename").notNull(),
  deliveryOrderFilename: text("delivery_order_filename").notNull(),
  status: text("status").notNull().default("processing"), // processing, completed, error
  matchCount: integer("match_count").notNull().default(0),
  warningCount: integer("warning_count").notNull().default(0),
  errorCount: integer("error_count").notNull().default(0),
  errorMessage: text("error_message"),
  priceMatch: text("price_match").notNull().default("N/A"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});

export type Session = typeof sessions.$inferSelect;
export type InsertSession = typeof sessions.$inferInsert;

// Comparisons table for storing comparison results
export const comparisons = pgTable("comparisons", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").notNull().references(() => sessions.id),
  invoiceFilename: text("invoice_filename").notNull(),
  deliveryOrderFilename: text("delivery_order_filename").notNull(),
  matchCount: integer("match_count").notNull().default(0),
  warningCount: integer("warning_count").notNull().default(0),
  errorCount: integer("error_count").notNull().default(0),
  rawData: json("raw_data").default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Comparison = typeof comparisons.$inferSelect;
export type InsertComparison = typeof comparisons.$inferInsert;

// Comparison items (products being compared)
export const comparisonItems = pgTable("comparison_items", {
  id: serial("id").primaryKey(),
  comparisonId: integer("comparison_id").notNull().references(() => comparisons.id),
  productName: text("product_name").notNull(),
  invoiceValue: text("invoice_value").notNull(),
  deliveryOrderValue: text("delivery_order_value").notNull(),
  status: text("status").notNull(), // match, warning, error
  note: text("note"),
});

export type ComparisonItem = typeof comparisonItems.$inferSelect;
export type InsertComparisonItem = typeof comparisonItems.$inferInsert;

// Comparison metadata (dates, numbers, etc.)
export const comparisonMetadata = pgTable("comparison_metadata", {
  id: serial("id").primaryKey(),
  comparisonId: integer("comparison_id").notNull().references(() => comparisons.id),
  field: text("field").notNull(),
  invoiceValue: text("invoice_value").notNull(),
  deliveryOrderValue: text("delivery_order_value").notNull(),
  status: text("status").notNull(), // match, warning, error
  priceMatch: text("price_match").notNull().default("N/A"),
});

export type ComparisonMetadata = typeof comparisonMetadata.$inferSelect;
export type InsertComparisonMetadata = typeof comparisonMetadata.$inferInsert;

// Application settings
export const settings = pgTable("settings", {
  id: serial("id").primaryKey(),
  api4aiKey: text("api4ai_key"),
  openaiKey: text("openai_key"),
  openaiModel: text("openai_model").default("gpt-4o"),
  fallbackToMiniModel: boolean("fallback_to_mini_model").default(true),
  autoSaveResults: boolean("auto_save_results").default(false),
  maxFileSize: integer("max_file_size").default(10), // in MB
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type AppSettings = typeof settings.$inferSelect;
export type InsertAppSettings = typeof settings.$inferInsert;

// Define relationships
export const sessionsRelations = relations(sessions, ({ many }) => ({
  comparisons: many(comparisons),
}));

export const comparisonsRelations = relations(comparisons, ({ one, many }) => ({
  session: one(sessions, {
    fields: [comparisons.sessionId],
    references: [sessions.id],
  }),
  items: many(comparisonItems),
  metadata: many(comparisonMetadata),
}));

export const comparisonItemsRelations = relations(comparisonItems, ({ one }) => ({
  comparison: one(comparisons, {
    fields: [comparisonItems.comparisonId],
    references: [comparisons.id],
  }),
}));

export const comparisonMetadataRelations = relations(comparisonMetadata, ({ one }) => ({
  comparison: one(comparisons, {
    fields: [comparisonMetadata.comparisonId],
    references: [comparisons.id],
  }),
}));

// Schemas for validation
export const insertSessionSchema = createInsertSchema(sessions);
export const insertComparisonSchema = createInsertSchema(comparisons);
export const insertComparisonItemSchema = createInsertSchema(comparisonItems);
export const insertComparisonMetadataSchema = createInsertSchema(comparisonMetadata);
export const insertSettingsSchema = createInsertSchema(settings);
