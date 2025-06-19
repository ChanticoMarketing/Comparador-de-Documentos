import { db } from "./index";
import * as schema from "@shared/schema";

async function seed() {
  try {
    console.log("Starting database seed...");

    // Check if there's already data in the settings table
    const existingSettings = await db.query.settings.findFirst();
    
    // Only insert settings if none exist
    if (!existingSettings) {
      console.log("Creating default settings...");
      await db.insert(schema.settings).values({
        api4aiKey: "",
        openaiKey: "",
        openaiModel: "gpt-4o",
        fallbackToMiniModel: true,
        autoSaveResults: false,
        maxFileSize: 10,
      });
    }

    // Check if there are already sessions
    const existingSessions = await db.query.sessions.findMany({
      limit: 1,
    });

    // Only seed sample data if no sessions exist
    if (existingSessions.length === 0) {
      console.log("Creating sample sessions and comparisons...");
      
      // Insert sample sessions
      const [session1] = await db.insert(schema.sessions).values({
        invoiceFilename: "factura_001.pdf",
        deliveryOrderFilename: "orden_entrega_001.pdf",
        status: "completed",
        matchCount: 12,
        warningCount: 3,
        errorCount: 2,
        createdAt: new Date(new Date().getTime() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
        completedAt: new Date(new Date().getTime() - 2 * 24 * 60 * 60 * 1000 + 10 * 60 * 1000), // 10 minutes after creation
      }).returning();

      const [session2] = await db.insert(schema.sessions).values({
        invoiceFilename: "factura_xyz.pdf",
        deliveryOrderFilename: "orden_001.pdf",
        status: "completed",
        matchCount: 8,
        warningCount: 1,
        errorCount: 0,
        createdAt: new Date(new Date().getTime() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
        completedAt: new Date(new Date().getTime() - 3 * 24 * 60 * 60 * 1000 + 8 * 60 * 1000), // 8 minutes after creation
      }).returning();

      const [session3] = await db.insert(schema.sessions).values({
        invoiceFilename: "factura_mayo.pdf",
        deliveryOrderFilename: "orden_entrega_mayo.pdf",
        status: "completed",
        matchCount: 15,
        warningCount: 2,
        errorCount: 4,
        createdAt: new Date(new Date().getTime() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
        completedAt: new Date(new Date().getTime() - 5 * 24 * 60 * 60 * 1000 + 15 * 60 * 1000), // 15 minutes after creation
      }).returning();

      // Insert sample comparisons
      const [comparison1] = await db.insert(schema.comparisons).values({
        sessionId: session1.id,
        invoiceFilename: session1.invoiceFilename,
        deliveryOrderFilename: session1.deliveryOrderFilename,
        matchCount: 12,
        warningCount: 3,
        errorCount: 2,
        createdAt: session1.completedAt || new Date(),
        rawData: {
          // Simplified raw data
          summaryText: "Comparison between factura_001.pdf and orden_entrega_001.pdf",
        },
      }).returning();

      // Insert sample comparison items for comparison1
      await db.insert(schema.comparisonItems).values([
        {
          comparisonId: comparison1.id,
          productName: "Teclado Mecánico RGB",
          invoiceValue: "5 unidades",
          deliveryOrderValue: "5 unidades",
          status: "match",
          note: null,
        },
        {
          comparisonId: comparison1.id,
          productName: "Monitor LED 24\"",
          invoiceValue: "2 cajas",
          deliveryOrderValue: "48 unidades",
          status: "warning",
          note: "Posible equivalencia: 1 caja = 24 unidades",
        },
        {
          comparisonId: comparison1.id,
          productName: "Mouse Inalámbrico Pro",
          invoiceValue: "10 unidades",
          deliveryOrderValue: "8 unidades",
          status: "error",
          note: "Diferencia de 2 unidades",
        },
        {
          comparisonId: comparison1.id,
          productName: "Auriculares Bluetooth",
          invoiceValue: "3 unidades",
          deliveryOrderValue: "3 unidades",
          status: "match",
          note: null,
        },
        {
          comparisonId: comparison1.id,
          productName: "Adaptador USB-C",
          invoiceValue: "Adaptador USB-C multifunción",
          deliveryOrderValue: "Adaptador USB Tipo C",
          status: "warning",
          note: "Coincidencia de texto parcial (similitud 85%)",
        },
      ]);

      // Insert sample comparison metadata for comparison1
      await db.insert(schema.comparisonMetadata).values([
        {
          comparisonId: comparison1.id,
          field: "Fecha",
          invoiceValue: "09/05/2023",
          deliveryOrderValue: "09/05/2023",
          status: "match",
        },
        {
          comparisonId: comparison1.id,
          field: "Número de Factura",
          invoiceValue: "F-2023-001",
          deliveryOrderValue: "N/A",
          status: "match",
        },
        {
          comparisonId: comparison1.id,
          field: "Número de Pedido",
          invoiceValue: "P-2023-001",
          deliveryOrderValue: "P-2023-001",
          status: "match",
        },
        {
          comparisonId: comparison1.id,
          field: "Total",
          invoiceValue: "1,250.00 €",
          deliveryOrderValue: "1,230.00 €",
          status: "error",
        },
      ]);

      // Insert sample comparisons for other sessions
      const [comparison2] = await db.insert(schema.comparisons).values({
        sessionId: session2.id,
        invoiceFilename: session2.invoiceFilename,
        deliveryOrderFilename: session2.deliveryOrderFilename,
        matchCount: 8,
        warningCount: 1,
        errorCount: 0,
        createdAt: session2.completedAt || new Date(),
        rawData: {
          // Simplified raw data
          summaryText: "Comparison between factura_xyz.pdf and orden_001.pdf",
        },
      }).returning();

      const [comparison3] = await db.insert(schema.comparisons).values({
        sessionId: session3.id,
        invoiceFilename: session3.invoiceFilename,
        deliveryOrderFilename: session3.deliveryOrderFilename,
        matchCount: 15,
        warningCount: 2,
        errorCount: 4,
        createdAt: session3.completedAt || new Date(),
        rawData: {
          // Simplified raw data
          summaryText: "Comparison between factura_mayo.pdf and orden_entrega_mayo.pdf",
        },
      }).returning();
    }

    console.log("Database seed completed successfully!");
  } catch (error) {
    console.error("Error seeding database:", error);
  }
}

seed();
