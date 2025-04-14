"use client"; // Needed because FileUpload uses client hooks

import { FileUpload } from "@/components/file-upload";
import { useState } from "react";

export default function UploadPage() {
  const [uploadStatus, setUploadStatus] = useState<string>("");

  const handleUploadSuccess = (url: string) => {
    console.log("Upload successful on page:", url);
    setUploadStatus(`Upload successful! URL: ${url}`);
    // TODO: Maybe redirect user or show link to document list
  };

  return (
    <main className="flex min-h-screen flex-col items-center p-12 md:p-24">
      <h1 className="text-2xl font-semibold mb-8">Upload Document</h1>
      <FileUpload onUploadSuccess={handleUploadSuccess} />
      {uploadStatus && (
        <p className="mt-6 p-4 bg-green-100 text-green-800 rounded-md">
          {uploadStatus}
        </p>
      )}
    </main>
  );
} 