import { pgTable, text, serial, integer, boolean, timestamp, json } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { relations } from "drizzle-orm";
import { z } from "zod";

// Users
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(), // Almacenará contraseña hasheada
  email: text("email").notNull().unique(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertUserSchema = createInsertSchema(users, {
  username: (schema) => schema.min(3, "El nombre de usuario debe tener al menos 3 caracteres"),
  password: (schema) => schema.min(6, "La contraseña debe tener al menos 6 caracteres"),
  email: (schema) => schema.email("Debe proporcionar un email válido"),
}).pick({
  username: true,
  password: true,
  email: true,
  firstName: true,
  lastName: true,
});

export const loginUserSchema = z.object({
  username: z.string().min(1, "El nombre de usuario es requerido"),
  password: z.string().min(1, "La contraseña es requerida"),
});

export type LoginUser = z.infer<typeof loginUserSchema>;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Sessions table for tracking comparison sessions
export const sessions = pgTable("sessions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id), // Referencia al usuario que creó la sesión
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
  userId: integer("user_id").references(() => users.id), // Referencia al usuario que creó la comparación
  sessionId: integer("session_id").notNull().references(() => sessions.id),
  invoiceFilename: text("invoice_filename").notNull(),
  deliveryOrderFilename: text("delivery_order_filename").notNull(),
  matchCount: integer("match_count").notNull().default(0),
  warningCount: integer("warning_count").notNull().default(0),
  errorCount: integer("error_count").notNull().default(0),
  rawData: json("raw_data").default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  isPermanent: boolean("is_permanent").default(true), // Indica si es un guardado permanente o temporal
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

// Tabla para sesiones de Express (connect-pg-simple)
export const pgSessions = pgTable("session", {
  sid: text("sid").primaryKey(),
  sess: json("sess").notNull(),
  expire: timestamp("expire", { withTimezone: true }).notNull(),
});

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
export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  comparisons: many(comparisons),
}));

export const sessionsRelations = relations(sessions, ({ one, many }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
  comparisons: many(comparisons),
}));

export const comparisonsRelations = relations(comparisons, ({ one, many }) => ({
  user: one(users, {
    fields: [comparisons.userId],
    references: [users.id],
  }),
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
