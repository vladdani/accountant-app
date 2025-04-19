import { z } from 'zod';

// Define and EXPORT the expected input parameters schema for queryStructuredDocumentsAction
export const queryParamsSchema = z.object({
  documentId: z.string().optional().describe("The exact database ID of a specific document."),
  filename: z.string().optional().describe("The exact original filename of a specific document."),
  search_terms: z.array(z.string()).optional().describe("Keywords for searching document content, filename, and vendor"),
  vendor: z.string().optional(),
  document_type: z.string().optional(),
  start_date: z.string().optional(), // Expecting YYYY-MM-DD
  end_date: z.string().optional(),   // Expecting YYYY-MM-DD
  min_amount: z.number().optional(),
  max_amount: z.number().optional(),
  currency: z.string().optional(),
});

// Define the structure of the data returned by queryStructuredDocumentsAction
// Exporting this too for potential use elsewhere
export interface StructuredQueryResult {
  id: string;
  name: string | null; // original_filename
  url: string | null; // document_url
  vendor: string | null;
  document_date: string | null; // Stored as DATE, selected as string
  document_type: string | null;
  total_amount: number | null;
  currency: string | null;
  description: string | null;
  discount: number | null;
} 