'use server';

import { z } from 'zod';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

// Define the expected input parameters based on the tool definition
const queryParamsSchema = z.object({
  vendor: z.string().optional(),
  document_type: z.string().optional(),
  start_date: z.string().optional(), // Expecting YYYY-MM-DD
  end_date: z.string().optional(),   // Expecting YYYY-MM-DD
  min_amount: z.number().optional(),
  max_amount: z.number().optional(),
  currency: z.string().optional(),
});

// Define the structure of the data returned
interface StructuredQueryResult {
  id: string;
  name: string | null; // original_filename
  url: string | null; // document_url
  vendor: string | null;
  document_date: string | null; // Stored as DATE, selected as string
  document_type: string | null;
  total_amount: number | null;
  currency: string | null;
}

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

  // Validate input parameters
  const validationResult = queryParamsSchema.safeParse(params);
  if (!validationResult.success) {
    return { success: false, error: validationResult.error.errors.map(e => e.message).join(', ') };
  }
  const { vendor, document_type, start_date, end_date, min_amount, max_amount, currency } = validationResult.data;

  try {
    // Use createServerClient from @supabase/ssr for authentication
    const cookieStore = await cookies();
    const supabase = createServerClient(
      supabaseUrl!, // Use loaded env vars
      supabaseAnonKey!, 
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
          // Set and remove might be needed if the session is refreshed during the action
          set(name: string, value: string, options: CookieOptions) {
             cookieStore.set({ name, value, ...options });
          },
          remove(name: string, options: CookieOptions) {
             cookieStore.set({ name, value: '', ...options });
          },
        },
      }
    );

    // Perform authentication check
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    // Check for errors OR if no user is found
    if (authError || !user) {
        console.error("Auth error in queryStructuredDocumentsAction", authError);
        return { success: false, error: "User authentication failed." };
    }
    
    const authenticatedUserId = user.id;

    // Start building the query dynamically
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
        currency
      `)
      .eq('uploaded_by', authenticatedUserId);

    // Apply filters based on provided parameters
    if (vendor) {
      // Use ilike for case-insensitive partial matching
      query = query.ilike('vendor', `%${vendor}%`);
    }
    if (document_type) {
      query = query.eq('document_type', document_type);
    }
    if (start_date) {
      query = query.gte('document_date', start_date);
    }
    if (end_date) {
      query = query.lte('document_date', end_date);
    }
    if (min_amount !== undefined) {
      query = query.gte('total_amount', min_amount);
    }
    if (max_amount !== undefined) {
      query = query.lte('total_amount', max_amount);
    }
    if (currency) {
      query = query.eq('currency', currency.toUpperCase()); // Match standardized currency
    }

    // Add ordering and limit
    query = query.order('document_date', { ascending: false, nullsFirst: false }).limit(50); // Order by date desc, limit results

    // Execute the query
    console.log("Executing structured query for user:", authenticatedUserId);
    const { data, error } = await query;

    if (error) {
      console.error('Supabase structured query error:', error);
      return { success: false, error: `Database query failed: ${error.message}` };
    }

    console.log(`Structured query returned ${data?.length ?? 0} results.`);
    // Explicitly cast data to the expected type for safety
    const resultData: StructuredQueryResult[] = data as StructuredQueryResult[] || [];
    return { success: true, data: resultData };

  } catch (err) {
    console.error('Unexpected error in queryStructuredDocumentsAction:', err);
    const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred.';
    return { success: false, error: errorMessage };
  }
} 