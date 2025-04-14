'use server';

// Remove Supabase client imports as auth is handled by the caller
// import { createServerActionClient } from '@supabase/auth-helpers-nextjs';
// import { cookies } from 'next/headers';
import { z } from 'zod';
// Import the global client for the query itself
// Make sure this client is configured correctly for your environment
import { supabase } from '@/utils/supabase'; 

// Define the expected structure returned by the RPC function
interface SearchResult {
  id: string; // Changed to string if your DB function returns uuid as string
  original_filename: string | null;
  document_url: string;
}

// Update input schema - userId is still needed for the RPC call
const searchSchema = z.object({
  searchTerm: z.string().min(1, 'Search term cannot be empty.'),
  userId: z.string().uuid('Invalid User ID format.'),
});

// formatSearchQuery is NO LONGER NEEDED here as formatting happens in SQL function
// function formatSearchQuery(term: string): string { ... }

// Update function signature
export async function searchDocumentsAction(
  input: { searchTerm: string; userId: string } 
): Promise<{ success: boolean; data?: SearchResult[]; error?: string }> {
  
  // Validate input
  const validationResult = searchSchema.safeParse(input);
  if (!validationResult.success) {
    return { success: false, error: validationResult.error.errors.map(e => e.message).join(', ') };
  }

  const { searchTerm, userId } = validationResult.data;

  // Remove query formatting call
  // const formattedQuery = formatSearchQuery(searchTerm); ...

  try {
    // Call the RPC function instead of using .filter()
    const { data, error } = await supabase
      .rpc('search_documents_fts', { 
        user_id_param: userId,
        search_term: searchTerm
      });

    if (error) {
      console.error('Supabase RPC Query Error:', error);
      // Note: FTS syntax errors might be caught inside the function now, 
      // but db errors can still occur.
      return { success: false, error: `Database error during search: ${error.message}` };
    }

    // Ensure data is treated as an array even if null/undefined
    const results: SearchResult[] = (data || []) as SearchResult[];

    return { success: true, data: results };

  } catch (err) {
    console.error('Unexpected Search Error:', err);
    const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred.';
    return { success: false, error: errorMessage };
  }
} 