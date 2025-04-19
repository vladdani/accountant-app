'use server';

import { z } from 'zod';
import { createClient } from '@/utils/supabase/server';
// Import the shared schema and result type from the correct location
import { queryParamsSchema, StructuredQueryResult } from '@/types/actions'; 

// Ensure necessary env vars are loaded (should be already from global scope, but good practice)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase URL or Anon Key for query action');
  // Optional: Throw an error if you want to prevent the action from running without config
  // throw new Error("Supabase URL/Anon Key not defined for query action.");
}

export async function queryStructuredDocumentsAction(
  params: z.infer<typeof queryParamsSchema>
): Promise<{ success: boolean; data?: StructuredQueryResult[]; error?: string }> {

  const validationResult = queryParamsSchema.safeParse(params);
  if (!validationResult.success) {
    return { success: false, error: validationResult.error.errors.map(e => e.message).join(', ') };
  }
  const validatedData = validationResult.data;
  const { search_terms, vendor, document_type, start_date, end_date, min_amount, max_amount, currency } = validatedData;

  // Basic check - use validatedData
  if ((!search_terms || search_terms.length === 0) && 
      !vendor && 
      !document_type && 
      !start_date && 
      !end_date && 
      min_amount === undefined && 
      max_amount === undefined && 
      !currency) {
      return { success: false, error: "Search requires keywords or specific filters." };
  }

  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
        console.error("Auth error in queryStructuredDocumentsAction", authError);
        return { success: false, error: "User authentication failed." };
    }
    const authenticatedUserId = user.id;

    let query = supabase
      .from('documents')
      .select(`
        id,
        original_filename,
        document_url,
        vendor,
        document_date,
        document_type,
        total_amount,
        currency,
        description,
        discount
      `)
      .eq('uploaded_by', authenticatedUserId); // Always filter by user

    // --- Build dynamic WHERE clause ---

    // 1. Add keyword search conditions
    if (search_terms && search_terms.length > 0) {
        for (const term of search_terms) {
            // Clean and prep the term for SQL LIKE
            const cleanTerm = term.trim().toLowerCase();
            // Escape special characters for PostgreSQL LIKE pattern
            const escapedTerm = cleanTerm.replace(/[\\%_]/g, '\\$&');
            console.log(`Searching for term: "${escapedTerm}"`);
            
            // Create a filter for each term individually
            query = query.or(`vendor.ilike.%${escapedTerm}%,original_filename.ilike.%${escapedTerm}%,description.ilike.%${escapedTerm}%`);
        }
        
        console.log(`Structured query: Added keyword search for terms: ${search_terms.join(', ')}`);
    }

    // 2. Add specific filter conditions (AND)
    if (vendor) {
      // For vendor, use a more flexible search approach
      const cleanVendor = vendor.trim();
      console.log(`Searching for vendor: "${cleanVendor}"`);
      query = query.ilike('vendor', `%${cleanVendor}%`);
      console.log(`Structured query: Added filter vendor=${cleanVendor}`);
    }
    if (document_type) {
      query = query.eq('document_type', document_type);
      console.log(`Structured query: Added filter type=${document_type}`);
    }
    if (start_date) {
      query = query.gte('document_date', start_date);
      console.log(`Structured query: Added filter start_date=${start_date}`);
    }
    if (end_date) {
      query = query.lte('document_date', end_date);
       console.log(`Structured query: Added filter end_date=${end_date}`);
    }
    if (min_amount !== undefined) {
      query = query.gte('total_amount', min_amount);
       console.log(`Structured query: Added filter min_amount=${min_amount}`);
    }
    if (max_amount !== undefined) {
      query = query.lte('total_amount', max_amount);
      console.log(`Structured query: Added filter max_amount=${max_amount}`);
    }
    if (currency) {
      query = query.eq('currency', currency.toUpperCase());
      console.log(`Structured query: Added filter currency=${currency}`);
    }
    // ------------------------------------

    // Add ordering and limit
    query = query.order('document_date', { ascending: false, nullsFirst: false }).limit(20); // Limit results

    // Execute the query
    console.log("Executing combined query for user:", authenticatedUserId);
    const { data, error } = await query;

    if (error) {
      console.error('Supabase combined query error:', error);
      return { success: false, error: `Database query failed: ${error.message}` };
    }

    console.log(`Combined query returned ${data?.length ?? 0} results.`);
    
    // Transform the data (remains the same)
    const resultData: StructuredQueryResult[] = data ? data.map(item => ({
      id: item.id,
      name: item.original_filename,
      url: item.document_url,
      vendor: item.vendor,
      document_date: item.document_date,
      document_type: item.document_type,
      total_amount: item.total_amount,
      currency: item.currency,
      description: item.description,
      discount: item.discount
    })) : [];
    
    return { success: true, data: resultData };

  } catch (err) {
    console.error('Unexpected error in queryStructuredDocumentsAction:', err);
    const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred.';
    return { success: false, error: errorMessage };
  }
} 