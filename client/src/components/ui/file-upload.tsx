import React, { useState, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface FileUploadProps {
  onFilesSelected: (files: File[]) => void;
  label: string;
  description: string;
  accept?: string;
  icon?: React.ReactNode;
  buttonText?: string;
  className?: string;
  maxSize?: number; // in MB
}

export function FileUpload({
  onFilesSelected,
  label,
  description,
  accept = "application/pdf,image/jpeg,image/png",
  icon,
  buttonText = "Seleccionar archivos",
  className,
  maxSize = 10, // Default 10MB
}: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const processFiles = useCallback(
    (fileList: FileList) => {
      const newFiles = Array.from(fileList).filter((file) => {
        // Check file size
        if (file.size > maxSize * 1024 * 1024) {
          alert(`El archivo ${file.name} excede el tamaño máximo permitido (${maxSize}MB)`);
          return false;
        }
        return true;
      });

      if (newFiles.length > 0) {
        setFiles(newFiles);
        onFilesSelected(newFiles);
      }
    },
    [maxSize, onFilesSelected],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      if (e.dataTransfer.files.length > 0) {
        processFiles(e.dataTransfer.files);
      }
    },
    [processFiles],
  );

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        processFiles(e.target.files);
      }
    },
    [processFiles],
  );

  const handleButtonClick = useCallback(() => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  }, []);

  return (
    <div
      className={cn(
        "border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center transition-colors",
        isDragging ? "border-primary" : "border-gray-600 hover:border-primary-500",
        className
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="text-center">
        {files.length > 0 ? (
          <>
            <div className="h-12 w-12 text-primary mx-auto mb-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-full w-full" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 15l6-6 6 6"/>
                <path d="M8 9h8"/>
              </svg>
            </div>
            <h4 className="text-lg font-medium text-white">{label}</h4>
            <p className="mt-1 text-sm text-gray-400">
              {files.length} {files.length === 1 ? "archivo seleccionado" : "archivos seleccionados"}
            </p>
          </>
        ) : (
          <>
            <div className="h-12 w-12 text-gray-400 mx-auto mb-2">
              {icon || (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-full w-full" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                  <line x1="12" y1="18" x2="12" y2="12"/>
                  <line x1="9" y1="15" x2="15" y2="15"/>
                </svg>
              )}
            </div>
            <h4 className="text-lg font-medium text-white">{label}</h4>
            <p className="mt-1 text-sm text-gray-400">{description}</p>
          </>
        )}
        
        <input
          type="file"
          className="hidden"
          accept={accept}
          multiple
          onChange={handleFileInputChange}
          ref={fileInputRef}
        />
        
        <Button 
          type="button" 
          variant="outline" 
          className="mt-4"
          onClick={handleButtonClick}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 11v2a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3v-2"/>
            <path d="M12 17V6"/>
            <path d="m9 9 3-3 3 3"/>
          </svg>
          {buttonText}
        </Button>
      </div>
    </div>
  );
}
