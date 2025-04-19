"use client";

import React, { useCallback, useState } from 'react';
import { useDropzone, FileRejection, Accept, ErrorCode } from 'react-dropzone';
import { UploadCloud, X, File as FileIcon } from 'lucide-react';
import { uploadFile } from '@/app/actions/upload-file'; // Import the server action
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button'; // Import Button component

// Define accepted file types based on PRD
const acceptedFileTypes: Accept = {
  'application/pdf': ['.pdf'],
  'text/csv': ['.csv'],
  'application/vnd.ms-excel': ['.xls'], // Older Excel format
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'], // Newer Excel format - added for broader compatibility
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/heic': ['.heic'],
  'image/heif': ['.heif'], // Often associated with HEIC
};

const ACCEPTED_FORMATS_STRING = "PDF, CSV, XLS/X, JPG, PNG, HEIC";
const MAX_FILE_SIZE_MB = 10;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

// Define the structure for the upload result object
interface UploadResult {
  success: boolean;
  url?: string;
  filePath?: string; 
  dbRecordId?: string; 
  error?: string;
  duplicateOf?: { id: string; name: string | null };
}

interface FileUploadProps {
  // Update the callback prop type to accept the full result
  onUploadComplete?: (result: UploadResult) => void; 
}

export function FileUpload({ onUploadComplete }: FileUploadProps) {
  const [acceptedFiles, setAcceptedFiles] = useState<File[]>([]);
  const [rejectedFiles, setRejectedFiles] = useState<FileRejection[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const onDrop = useCallback(
    async (accepted: File[], rejected: FileRejection[]) => {
      // Append new files instead of replacing
      setAcceptedFiles(prev => [...prev, ...accepted]);
      setRejectedFiles(prev => [...prev, ...rejected]);

      if (accepted.length > 0) {
        setIsUploading(true);
        console.log(`Processing ${accepted.length} accepted file(s)...`);
        
        // Process each accepted file
        const uploadPromises = accepted.map(async (fileToUpload) => {
          console.log('Uploading:', fileToUpload.name);
          try {
            const formData = new FormData();
            formData.append('file', fileToUpload);
            const result = await uploadFile(formData); // result is now UploadResult

            // Call the new callback with the full result
            if (onUploadComplete) {
              onUploadComplete(result);
            }
            
            // Remove file from list only if the upload action didn't detect a duplicate or other non-success
            // We rely on the dashboard handler to show appropriate status messages
            if (result.success) {
                 setAcceptedFiles(prev => prev.filter(f => f !== fileToUpload));
                 return { success: true, file: fileToUpload.name };
            } else if (result.duplicateOf) {
                 setAcceptedFiles(prev => prev.filter(f => f !== fileToUpload));
                 return { success: false, file: fileToUpload.name, duplicate: true }; // Indicate duplicate
            } else {
                 // Keep the file in accepted list for potential retry?
                 // Or move to a new "failed" list?
                 // For now, just log error and return failure status
                 console.error(`Upload action failed for ${fileToUpload.name}:`, result.error);
                 return { success: false, file: fileToUpload.name, error: result.error };
            }
            
          } catch (error) {
            // Catch errors from the uploadFile action itself (network, etc.)
            console.error(`Upload failed for ${fileToUpload.name}:`, error);
            const message = error instanceof Error ? error.message : 'File upload failed.';
            
            // Call callback with error status
            if (onUploadComplete) {
                 onUploadComplete({ success: false, error: message });
            }
            
            // Keep file in acceptedFiles for now, let user decide to remove/retry
            return { success: false, file: fileToUpload.name, error: message };
          }
        });

        // Wait for all uploads to attempt completion
        await Promise.all(uploadPromises);
        
        setIsUploading(false);
        console.log("Finished processing batch.");
      }
    },
    [onUploadComplete]
  );

  const { 
    getRootProps, 
    getInputProps, 
    open, // Destructure the open function
    isDragActive, 
    isFocused, 
    isDragAccept, 
    isDragReject 
  } = useDropzone({
    onDrop,
    accept: acceptedFileTypes,
    multiple: true, // <-- CHANGE: Allow multiple files
    maxSize: MAX_FILE_SIZE_BYTES, // Use constant
    disabled: isUploading, // Disable dropzone while uploading
  });

  // Dynamic styling based on dropzone state
  const baseStyle = 'flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-lg cursor-pointer bg-background hover:bg-muted/50 transition-colors duration-200 ease-in-out';
  const activeStyle = 'border-primary';
  const acceptStyle = 'border-green-500';
  const rejectStyle = 'border-destructive';
  const disabledStyle = 'opacity-50 cursor-not-allowed';

  const style = React.useMemo(() => (
     `${baseStyle} ${isUploading ? disabledStyle : ''} ${isDragActive ? activeStyle : ''} ${isDragAccept ? acceptStyle : ''} ${isDragReject ? rejectStyle : ''} ${isFocused && !isUploading ? 'border-primary' : 'border-border'}`
  ), [isUploading, isDragActive, isDragAccept, isDragReject, isFocused]);

  const removeFile = (fileToRemove: File | FileRejection) => {
    if (isUploading) return; // Don't allow removal during upload
    if ('file' in fileToRemove && 'errors' in fileToRemove) { // Type guard for FileRejection
      setRejectedFiles(prev => prev.filter(rf => rf.file.name !== fileToRemove.file.name || rf.file.lastModified !== fileToRemove.file.lastModified)); // Match precisely
    } else if (fileToRemove instanceof File) { // Type guard for File
      setAcceptedFiles(prev => prev.filter(f => f.name !== fileToRemove.name || f.lastModified !== fileToRemove.lastModified)); // Match precisely
    }
  }

  // Helper to generate specific error messages
  // Accept readonly array for errors
  const getFileRejectionMessage = (errors: readonly { code: string; message: string }[]): string => {
    const messages = errors.map(e => {
      if (e.code === ErrorCode.FileTooLarge) {
        return `File is larger than ${MAX_FILE_SIZE_MB}MB limit.`;
      }
      if (e.code === ErrorCode.FileInvalidType) {
        return `Invalid file type. Accepted: ${ACCEPTED_FORMATS_STRING}.`;
      }
      return e.message; // Fallback for other errors
    });
    // Remove duplicates and join
    return [...new Set(messages)].join(', '); 
  };

  return (
    <div className="w-full max-w-lg mx-auto">
      {/* Hide the visual dropzone box on mobile, retain underlying input functionality */}
      <div {...getRootProps({ className: cn(style, "hidden md:flex") })}>
        <input {...getInputProps()} disabled={isUploading}/>
        <div className="flex flex-col items-center justify-center pt-5 pb-6 text-center">
          <UploadCloud className={`w-10 h-10 mb-4 ${isUploading ? 'text-muted-foreground' : isDragAccept ? 'text-green-500' : isDragReject ? 'text-destructive' : 'text-muted-foreground'}`} />
          {isUploading ? (
             <p className="mb-2 text-sm font-semibold text-muted-foreground">Uploading...</p>
          ) : isDragAccept ? (
            <p className="mb-2 text-sm font-semibold text-green-500">Drop the file here!</p>
          ) : isDragReject ? (
            <p className="mb-2 text-sm font-semibold text-destructive">File type not supported or too large.</p>
          ) : (
            <>
              <p className="mb-2 text-sm text-muted-foreground">
                <span className="font-semibold">Click to upload</span> or drag and drop
              </p>
              <p className="text-xs text-muted-foreground/80">{ACCEPTED_FORMATS_STRING} (Max {MAX_FILE_SIZE_MB}MB)</p>
            </>
          )}
        </div>
      </div>

      {/* Mobile Upload Button */} 
      <Button 
        onClick={open} 
        disabled={isUploading}
        className="w-full md:hidden mt-4" // Visible only on mobile, full width, margin top
        variant="outline" // Or use default variant
      >
        <UploadCloud className="mr-2 h-4 w-4" />
        {isUploading ? 'Uploading...' : 'Upload File'}
      </Button>

      {/* Display accepted files - show files waiting to be uploaded */}
      {acceptedFiles.length > 0 && (
        <div className="mt-4 space-y-2">
          <h4 className="text-sm font-medium text-primary">Files ready to upload:</h4>
          {acceptedFiles.map(file => (
            <div key={`${file.name}-${file.lastModified}`} className="flex items-center justify-between p-2 border rounded-md bg-blue-50 border-blue-200">
              <div className="flex items-center gap-2">
                  <FileIcon className="h-5 w-5 text-blue-600" />
                  <span className="text-sm text-blue-800">{file.name} ({Math.round(file.size / 1024)} KB)</span>
              </div>
              <button onClick={() => removeFile(file)} disabled={isUploading}>
                 <X className={`h-4 w-4 text-blue-600 ${isUploading ? 'opacity-50' : 'hover:text-blue-800'}`} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Display rejected files with specific messages */}
      {rejectedFiles.length > 0 && (
        <div className="mt-4 space-y-2">
          <h4 className="text-sm font-medium text-destructive">Rejected file(s):</h4>
          {rejectedFiles.map(({ file, errors }, index) => (
            <div key={`${file.name}-${file.lastModified}-${index}`} className="flex items-center justify-between p-2 border rounded-md bg-red-50 border-red-200">
                 <div className="flex items-center gap-2 overflow-hidden">
                    <FileIcon className="h-5 w-5 text-red-600 flex-shrink-0" />
                    <div className="min-w-0">
                        <span className="text-sm text-red-800 block truncate" title={file.name}>{file.name} ({Math.round(file.size / 1024)} KB)</span>
                        <p className="text-xs text-red-700">{getFileRejectionMessage(errors)}</p>
                    </div>
                 </div>
              <button onClick={() => removeFile({file, errors})} className="flex-shrink-0">
                  <X className="h-4 w-4 text-red-600 hover:text-red-800" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
} 