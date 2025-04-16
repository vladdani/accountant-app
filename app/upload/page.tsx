"use client"; // Needed because FileUpload uses client hooks

import { FileUpload } from "@/components/file-upload";
import { useState } from "react";

// Define the expected result type (can be imported if shared)
interface UploadResult {
  success: boolean;
  url?: string;
  filePath?: string; 
  dbRecordId?: string; 
  error?: string;
  duplicateOf?: { id: string; name: string | null };
}

export default function UploadPage() {
  const [uploadStatus, setUploadStatus] = useState<string>("");

  // Update handler function signature and logic
  const handleUploadSuccess = (result: UploadResult) => { 
    if (result.success && result.url) {
      console.log("Upload successful on page:", result.url);
      setUploadStatus(`Upload successful! URL: ${result.url}`);
      // TODO: Maybe redirect user or show link to document list
    } else if (result.duplicateOf) {
      console.warn("Duplicate file detected on page:", result.duplicateOf);
      const duplicateName = result.duplicateOf.name || 'an existing document';
      setUploadStatus(`File already exists: ${duplicateName}.`);
    } else {
      console.error("Upload failed on page:", result.error);
      setUploadStatus(`Error: ${result.error || 'Failed to upload file.'}`);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center p-12 md:p-24">
      <h1 className="text-2xl font-semibold mb-8">Upload Document</h1>
      {/* Update prop name */}
      <FileUpload onUploadComplete={handleUploadSuccess} />
      {uploadStatus && (
        // Add conditional styling for different statuses
        <p className={`mt-6 p-4 rounded-md text-sm font-medium ${ 
          uploadStatus.startsWith('Upload successful') ? 'bg-green-100 text-green-800' : 
          uploadStatus.startsWith('File already exists') ? 'bg-yellow-100 text-yellow-800' : 
          'bg-red-100 text-red-800' // Default to error style
        }`}>
          {uploadStatus}
        </p>
      )}
    </main>
  );
} 