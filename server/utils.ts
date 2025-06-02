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
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
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
    .replace(/(\d+)\s?ml/g, "$1")                                             // 600 ml -> 600
    .replace(/(\d+(\.\d+)?)\s?l\b/g, (_, val) => `${parseFloat(val) * 1000}`) // 0.6L -> 600
    .replace(/\bp\b|\bpz\b|\s+de\s+|\s+con\s+/g, "")
    .replace(/[^a-z0-9]+/g, " ")                                              // Remove special characters
    .trim()                                          // optional: sort words
}