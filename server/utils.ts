import { ComparisonResult } from "../client/src/types";
import puppeteer from "puppeteer";
import ExcelJS from "exceljs";

/**
 * Export comparison results to PDF
 * @param comparison The comparison result to export
 * @returns PDF buffer
 */
export async function exportToPdf(comparison: ComparisonResult): Promise<Buffer> {
  // Create HTML content for the PDF
  const htmlContent = createHtmlReport(comparison);
  
  // Launch a headless browser
  const browser = await puppeteer.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  
  // Set content and generate PDF
  await page.setContent(htmlContent);
  
  // Add styles to make it look good when printed
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
  
  // Generate PDF
  const pdfBuffer = await page.pdf({
    format: 'A4',
    printBackground: true,
    margin: {
      top: '20px',
      right: '20px',
      bottom: '20px',
      left: '20px'
    }
  });
  
  await browser.close();
  return pdfBuffer;
}

/**
 * Export comparison results to Excel
 * @param comparison The comparison result to export
 * @returns Excel buffer
 */
export async function exportToExcel(comparison: ComparisonResult): Promise<Buffer> {
  // Create a new workbook
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'OCR-Matcher AI';
  workbook.created = new Date();
  
  // Add a summary worksheet
  const summarySheet = workbook.addWorksheet('Resumen');
  
  // Add title and subtitle
  summarySheet.mergeCells('A1:E1');
  const titleCell = summarySheet.getCell('A1');
  titleCell.value = 'Reporte de Comparación';
  titleCell.font = { size: 16, bold: true };
  titleCell.alignment = { horizontal: 'center' };
  
  summarySheet.mergeCells('A2:E2');
  const subtitleCell = summarySheet.getCell('A2');
  subtitleCell.value = `${comparison.invoiceFilename} vs ${comparison.deliveryOrderFilename}`;
  subtitleCell.font = { size: 12 };
  subtitleCell.alignment = { horizontal: 'center' };
  
  // Add date
  summarySheet.mergeCells('A3:E3');
  const dateCell = summarySheet.getCell('A3');
  dateCell.value = `Fecha: ${new Date(comparison.createdAt).toLocaleDateString()}`;
  dateCell.font = { size: 12 };
  dateCell.alignment = { horizontal: 'center' };
  
  // Add summary
  summarySheet.addRow([]);
  summarySheet.addRow(['Resumen de Resultados']);
  summarySheet.getCell('A5').font = { bold: true, size: 14 };
  
  summarySheet.addRow(['Coincidencias', comparison.summary.matches]);
  summarySheet.addRow(['Advertencias', comparison.summary.warnings]);
  summarySheet.addRow(['Discrepancias', comparison.summary.errors]);
  
  // Add products worksheet
  const productsSheet = workbook.addWorksheet('Productos');
  
  // Add headers
  productsSheet.columns = [
    { header: 'Producto', key: 'product', width: 30 },
    { header: 'Factura', key: 'invoice', width: 20 },
    { header: 'Orden de Entrega', key: 'deliveryOrder', width: 20 },
    { header: 'Estado', key: 'status', width: 15 },
    { header: 'Nota', key: 'note', width: 40 }
  ];
  
  // Style the header row
  productsSheet.getRow(1).font = { bold: true };
  productsSheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFD3D3D3' }
  };
  
  // Add data rows
  comparison.items.forEach(item => {
    const row = productsSheet.addRow([
      item.productName,
      item.invoiceValue,
      item.deliveryOrderValue,
      getStatusText(item.status),
      item.note || ''
    ]);
    
    // Apply status-based formatting
    const fillColor = getStatusColor(item.status);
    row.getCell('D').fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: fillColor }
    };
    
    // Highlight differences
    if (item.status === 'warning' || item.status === 'error') {
      row.getCell('B').fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFFF0E0' }
      };
      row.getCell('C').fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFFF0E0' }
      };
    }
  });
  
  // Add metadata worksheet
  const metadataSheet = workbook.addWorksheet('Metadatos');
  
  // Add headers
  metadataSheet.columns = [
    { header: 'Campo', key: 'field', width: 30 },
    { header: 'Factura', key: 'invoice', width: 30 },
    { header: 'Orden de Entrega', key: 'deliveryOrder', width: 30 },
    { header: 'Estado', key: 'status', width: 15 }
  ];
  
  // Style the header row
  metadataSheet.getRow(1).font = { bold: true };
  metadataSheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFD3D3D3' }
  };
  
  // Add data rows
  comparison.metadata.forEach(meta => {
    const row = metadataSheet.addRow([
      meta.field,
      meta.invoiceValue,
      meta.deliveryOrderValue,
      getStatusText(meta.status)
    ]);
    
    // Apply status-based formatting
    const fillColor = getStatusColor(meta.status);
    row.getCell('D').fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: fillColor }
    };
    
    // Highlight differences
    if (meta.status === 'warning' || meta.status === 'error') {
      row.getCell('B').fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFFF0E0' }
      };
      row.getCell('C').fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFFF0E0' }
      };
    }
  });
  
  // Generate Excel buffer
  return await workbook.xlsx.writeBuffer();
}

/**
 * Create HTML content for the PDF report
 * @param comparison The comparison result to export
 * @returns HTML string
 */
function createHtmlReport(comparison: ComparisonResult): string {
  // Format date
  const reportDate = new Date(comparison.createdAt).toLocaleDateString();
  
  // Create HTML header
  let html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Comparison Report</title>
      <meta charset="UTF-8">
    </head>
    <body>
      <div class="report-header">
        <div class="report-title">Reporte de Comparación</div>
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
  
  // Add products
  comparison.items.forEach(item => {
    const statusClass = item.status;
    const statusBadgeClass = `status-badge status-${item.status}`;
    
    html += `
      <tr>
        <td>${item.productName}</td>
        <td class="${statusClass === 'match' ? '' : statusClass}">${item.invoiceValue}</td>
        <td class="${statusClass === 'match' ? '' : statusClass}">${item.deliveryOrderValue}</td>
        <td><span class="${statusBadgeClass}">${getStatusText(item.status)}</span></td>
        <td>${item.note || '-'}</td>
      </tr>
    `;
  });
  
  // Close products table and add metadata table
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
  
  // Add metadata
  comparison.metadata.forEach(meta => {
    const statusClass = meta.status;
    const statusBadgeClass = `status-badge status-${meta.status}`;
    
    html += `
      <tr>
        <td>${meta.field}</td>
        <td class="${statusClass === 'match' ? '' : statusClass}">${meta.invoiceValue}</td>
        <td class="${statusClass === 'match' ? '' : statusClass}">${meta.deliveryOrderValue}</td>
        <td><span class="${statusBadgeClass}">${getStatusText(meta.status)}</span></td>
      </tr>
    `;
  });
  
  // Close the HTML
  html += `
        </tbody>
      </table>
      
      <div class="report-footer">
        <p>Generado por OCR-Matcher AI • ${new Date().toLocaleString()}</p>
      </div>
    </body>
    </html>
  `;
  
  return html;
}

/**
 * Get status text for display
 * @param status Status value
 * @returns Formatted status text
 */
function getStatusText(status: string): string {
  switch (status) {
    case 'match':
      return 'Coincidente';
    case 'warning':
      return 'Advertencia';
    case 'error':
      return 'Discrepancia';
    default:
      return status;
  }
}

/**
 * Get color for status in Excel
 * @param status Status value
 * @returns Color in ARGB format
 */
function getStatusColor(status: string): string {
  switch (status) {
    case 'match':
      return 'FF90EE90'; // Light green
    case 'warning':
      return 'FFFFFFE0'; // Light yellow
    case 'error':
      return 'FFFFCCCB'; // Light red
    default:
      return 'FFFFFFFF'; // White
  }
}

/**
 * Get a special and normalized product string
 * @param str The product string to normalize
 * @returns The normalized product string
 */
export function normalizeProductString(str: string): string {
  return str
    .toLowerCase()                                                            // Parse to lower
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")                         // remove accents
    .replace(/\bp\b|\bpz\b|\s+de\s+|\s+con\s+/g, "")
    .replace(/[^a-z0-9]+/g, " ")                                              // Remove special characters
    .trim()                                                                   // optional: sort words
}

/**
 * Check if the mode is single
 * @param mode The mode to check
 * @returns True if the mode is single, false otherwise
 */
export function isSingleMode(mode: string): boolean {
  return mode === "single";
}


type OcrGateResult = {
  isProductDoc: boolean;
  score: number;
  reasons: string[];
  stats: {
    totalLines: number;
    productLikeLines: number;
    tableHeaderHits: number;
    priceQtyColumnHits: number;
    repetitionRatio: number;
  };
};

const RE_TABLE_HEADERS = [
  /\b(material|codigo\s+de\s+(barras|producto)|sku)\b.*\b(descripcion|description)\b.*\b(cantidad|quantity|pz|pzas|unidad)\b/i,
  /\b(descripcion|description)\b.*\b(cantidad|quantity)\b/i,
  /\b(unidad|u\.)\b.*\b(total|piezas|pz)\b/i,
];

const RE_PRICE_QTY_COLUMNS = [
  /\b(precio\s+unitario|unit\s*price|importe|subtotal|total)\b/i,
  /\b(cantidad|qty|total\s+piezas|pz|pzas)\b/i,
];

const RE_PRODUCT_LINE = [
  // units and sizes
  /\b\d+(?:[.,]\d+)?\s*(?:ml|l|lt|lts|litro?s?|kg|g|gr)\b/i,
  // pack patterns
  /\bp\s*\d+\s*p\b/i,       // "P 12P"
  /\bpk\s*\d+\b/i,          // "pk12"
  /\b\d+\s*pz(?:as)?\b/i,   // "12 PZ", "12 pzas"
  // packaging tokens
  /\b(?:pet|lat|nr|vnr)\b/i,
];

const RE_BRANDISH = /\b(red\s*bull|dr\s*pepper|snapple|pen[a|e]fiel|aguafiel|mineral|limonada|naranjada|toronjada|manzanada|mangada|pi[ñn]ada|twist)\b/i;

// obvious noise/repetition terms
const RE_NOISE = /\b(regimen(?:\s+fiscal)?|referencia|folio\s+fiscal|uso\s+cfdi|domicilio|expedido|r\.?f\.?c\.?|certificado|moneda|forma\s+de\s+pago|tipo\s+comprobante)\b/i;

export function gateOcrForProductList(markdown: string, {
  minProductLines = 3,
  repetitionLimit = 0.45, // 45% or more repeated lines => likely noise
  passScore = 5,
} = {}): OcrGateResult {
  const lines = markdown
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(Boolean);

  const totalLines = lines.length;

  // Normalize lines for repetition check (case/accents/punct)
  const norm = (s: string) =>
    s.toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9 ]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  const normCounts = new Map<string, number>();
  for (const l of lines) {
    const k = norm(l);
    if (!k) continue;
    normCounts.set(k, (normCounts.get(k) || 0) + 1);
  }
  const maxRepeat = Math.max(0, ...Array.from(normCounts.values()));
  const repetitionRatio = totalLines ? maxRepeat / totalLines : 0;

  // Signals
  let tableHeaderHits = 0;
  for (const re of RE_TABLE_HEADERS) {
    if (re.test(markdown)) tableHeaderHits++;
  }

  let priceQtyColumnHits = 0;
  for (const re of RE_PRICE_QTY_COLUMNS) {
    if (re.test(markdown)) priceQtyColumnHits++;
  }

  let productLikeLines = 0;
  for (const raw of lines) {
    const line = raw.replace(/\|/g, " ").trim(); // handle md table rows
    if (RE_NOISE.test(line)) continue;

    const productSignals = RE_PRODUCT_LINE.some(re => re.test(line));
    const brandSignal = RE_BRANDISH.test(line);
    // A line counts if it has units/packs/packaging OR a brand term + a qty token
    if (productSignals || (brandSignal && /\b\d/.test(line))) {
      productLikeLines++;
    }
  }

  // Score (tune as you like)
  let score = 0;
  score += tableHeaderHits * 2;
  score += priceQtyColumnHits * 2;
  score += Math.min(productLikeLines, 10); // cap so long docs don’t dominate
  if (repetitionRatio > 0.35) score -= 2;
  if (repetitionRatio > 0.45) score -= 4;

  const reasons: string[] = [];
  if (tableHeaderHits) reasons.push(`Detected ${tableHeaderHits} product table header(s).`);
  if (priceQtyColumnHits) reasons.push(`Found ${priceQtyColumnHits} price/qty columns.`);
  reasons.push(`Product-like lines: ${productLikeLines}.`);
  reasons.push(`Repetition ratio: ${(repetitionRatio * 100).toFixed(1)}%.`);
  if (productLikeLines < minProductLines) reasons.push(`Too few product lines (< ${minProductLines}).`);
  if (repetitionRatio >= repetitionLimit) reasons.push(`High repetition (>= ${(repetitionLimit * 100).toFixed(0)}%).`);

  const isProductDoc = score >= passScore && productLikeLines >= minProductLines && repetitionRatio < repetitionLimit;

  return {
    isProductDoc,
    score,
    reasons,
    stats: { totalLines, productLikeLines, tableHeaderHits, priceQtyColumnHits, repetitionRatio },
  };
}
