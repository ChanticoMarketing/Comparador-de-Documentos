/**
 * API client library for interacting with the server
 */

import { apiRequest } from "./queryClient";
import { ComparisonResult, ProcessingStatus, Session, Settings } from "@/types";

// Upload files for OCR processing
export async function uploadFiles(
  invoiceFiles: File[],
  deliveryFiles: File[]
): Promise<{ sessionId: string }> {
  const formData = new FormData();
  
  invoiceFiles.forEach((file) => {
    formData.append("invoices", file);
  });
  
  deliveryFiles.forEach((file) => {
    formData.append("deliveryOrders", file);
  });
  
  const response = await fetch("/api/upload", {
    method: "POST",
    body: formData,
    credentials: "include",
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || "Error al subir los archivos");
  }
  
  return await response.json();
}

// Get current processing status
export async function getProcessingStatus(): Promise<ProcessingStatus> {
  const response = await apiRequest("GET", "/api/processing/status");
  return await response.json();
}

// Cancel current processing
export async function cancelProcessing(): Promise<{ success: boolean }> {
  const response = await apiRequest("POST", "/api/processing/cancel");
  return await response.json();
}

// Get all sessions
export async function getAllSessions(): Promise<Session[]> {
  const response = await apiRequest("GET", "/api/sessions");
  return await response.json();
}

// Get a specific comparison result
export async function getComparisonResult(id: string): Promise<ComparisonResult> {
  const response = await apiRequest("GET", `/api/comparisons/${id}`);
  return await response.json();
}

// Get the latest comparison result
export async function getLatestComparisonResult(): Promise<ComparisonResult> {
  const response = await apiRequest("GET", "/api/comparisons/latest");
  return await response.json();
}

// Save a comparison result
export async function saveComparisonResult(
  comparisonId: string
): Promise<{ success: boolean }> {
  const response = await apiRequest("POST", "/api/comparisons/save", { comparisonId });
  return await response.json();
}

// Export comparison result to PDF
export async function exportToPdf(comparisonId: string): Promise<Blob> {
  const response = await fetch(`/api/comparisons/${comparisonId}/export?format=pdf`, {
    method: "GET",
    credentials: "include",
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || "Error exporting to PDF");
  }
  
  return await response.blob();
}

// Export comparison result to Excel
export async function exportToExcel(comparisonId: string): Promise<Blob> {
  const response = await fetch(`/api/comparisons/${comparisonId}/export?format=excel`, {
    method: "GET",
    credentials: "include",
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || "Error exporting to Excel");
  }
  
  return await response.blob();
}

// Get application settings
export async function getSettings(): Promise<Settings> {
  const response = await apiRequest("GET", "/api/settings");
  return await response.json();
}

// Update application settings
export async function updateSettings(settings: Settings): Promise<{ success: boolean }> {
  const response = await apiRequest("POST", "/api/settings", settings);
  return await response.json();
}
