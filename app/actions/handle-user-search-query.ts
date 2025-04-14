'use server';

import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { CoreMessage, generateText, tool } from 'ai';
import { z } from 'zod';
import { createServerActionClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { queryStructuredDocumentsAction } from './query-structured-documents';

// --- Types ---
// Define structure for the results we *expect* from the (yet to be created) structured query action
interface StructuredQueryResult {
  id: string;
  name: string | null; // original_filename
  url: string | null; // document_url
  vendor: string | null;
  document_date: string | null; // YYYY-MM-DD
  document_type: string | null;
  total_amount: number | null;
  currency: string | null;
}
// Define shape of the successful tool execution result for structured query
type StructuredToolExecuteSuccessResult = {
  queryResults: StructuredQueryResult[] | string; // Can be results or "not found" string
  error?: undefined;
};

// --- Constants and Setup ---
const TEMP_TEST_USER_ID = '0d4f5e60-258a-46ea-92ce-c0ffc9263e1b';
// ... (Google API Key Check, AI Client Init) ...
if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) { throw new Error('Missing GOOGLE_GENERATIVE_AI_API_KEY environment variable.'); }
const google = createGoogleGenerativeAI({ apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY });
const model = google('models/gemini-2.0-flash');
const querySchema = z.object({ userQuery: z.string().min(1), chatHistory: z.array(z.custom<CoreMessage>()).optional(), });

// ---+++ NEW Structured Query Tool Definition +++---
const queryDocumentsTool = tool({
  description: "Query the user's processed documents based on structured criteria like vendor, date range, document type, amount, or currency. Use this when the user asks to find or filter documents using these kinds of specific fields.",
  parameters: z.object({
    vendor: z.string().optional().describe("The vendor or supplier name to filter by (partial or full match)."),
    document_type: z.string().optional().describe("The type of document to filter by (e.g., 'invoice', 'receipt')."),
    start_date: z.string().optional().describe("The start date for filtering (inclusive), format YYYY-MM-DD."),
    end_date: z.string().optional().describe("The end date for filtering (inclusive), format YYYY-MM-DD."),
    min_amount: z.number().optional().describe("The minimum total amount to filter by."),
    max_amount: z.number().optional().describe("The maximum total amount to filter by."),
    currency: z.string().optional().describe("The 3-letter currency code to filter by (e.g., 'IDR', 'USD')."),
  }),
  // Execute function will call the new structured query action (to be created)
  execute: async (args, { userId }: { userId: string | null }): Promise<StructuredToolExecuteSuccessResult | { queryResults: string, error: string }> => {
    console.log(`AI requested structured query with args:`, args);

    if (!userId) {
      console.error('Structured Query Tool Error: userId not provided.');
      return { queryResults: "", error: 'Authentication context missing.' };
    }

    // ---+++ Call the actual structured query action +++---
    const result = await queryStructuredDocumentsAction({ ...args, userId });
    
    if (!result.success) {
      console.error('queryStructuredDocumentsAction failed:', result.error);
      return { queryResults: "", error: `Failed to query documents: ${result.error || 'Unknown database error'}` };
    }
    
    if (!result.data || result.data.length === 0) {
      console.log('queryStructuredDocumentsAction returned no results.');
      return { queryResults: "No documents found matching those criteria." }; // Return success with message
    }
    
    console.log(`queryStructuredDocumentsAction returned ${result.data.length} results.`);
    // Return success with the structured data array
    return { queryResults: result.data }; 
    // ---+++++++++++++++++++++++++++++++++++++++++++++++---
  },
});
// ---++++++++++++++++++++++++++++++++++++++++++++---

// --- Main Action --- 
export async function handleUserSearchQueryAction(
  input: z.infer<typeof querySchema>
): Promise<{ success: boolean; response?: string; error?: string }> {

  // --- Authentication (Keep Bypass Logic) ---
  let currentUserId: string | null = null;
  try { 
      const cookieStore = cookies();
      const supabase = createServerActionClient({ cookies: () => cookieStore });
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) { currentUserId = TEMP_TEST_USER_ID; console.warn(`Using TEMP ID: ${currentUserId}`); }
      else { currentUserId = user.id; console.log(`Using real ID: ${currentUserId}`);}
  } catch (catchError) { currentUserId = TEMP_TEST_USER_ID; console.error(`Auth Error, Using TEMP ID: ${currentUserId}`, catchError); }
  if (!currentUserId) { return { success: false, error: 'User identification failed.' }; }
  // ------------------------------------------

  // --- Input Validation (Keep) ---
  const validationResult = querySchema.safeParse(input);
  if (!validationResult.success) { return { success: false, error: validationResult.error.errors.map(e => e.message).join(', ') }; }
  const { userQuery, chatHistory = [] } = validationResult.data;
  // ------------------------------------------

  // --- Initial Message History ---
  const initialMessages: CoreMessage[] = [
    // Update system prompt to mention structured fields
    { role: 'system', content: 'You are a helpful assistant for managing documents. You can query documents based on structured fields like vendor, date, type, amount, and currency using the provided tool. (Auth Bypass Active)' },
    ...chatHistory,
    { role: 'user', content: userQuery },
  ];
  // -----------------------------

  try {
    // --- First AI Call (Determine if tool is needed) ---
    console.log("--- Sending to AI (First Call) ---");
    console.log(JSON.stringify(initialMessages, null, 2));
    const initialResult = await generateText({
      model: model,
      messages: initialMessages,
      // Provide the NEW tool
      tools: { query_documents: queryDocumentsTool }, 
    });
    console.log("--- Received from AI (First Call) ---", initialResult);
    // ----------------------------------------------------

    // --- Handle Tool Call OR Direct Response ---
    let finalResponseText: string | undefined;

    if (initialResult.finishReason === 'tool-calls' && initialResult.toolCalls) {
      console.log('AI wants to call tools:', initialResult.toolCalls);
      const toolCall = initialResult.toolCalls[0]; 
      let queryResultSummary: string;
      // Use z.infer to get the correct type for the tool arguments
      let toolArgs: z.infer<typeof queryDocumentsTool.parameters>; 

      // Ensure the correct tool is being called
      if (toolCall.toolName === 'query_documents') { 
        // Assign and type check toolCall.args
        // Add validation here if needed, though Zod in tool definition should handle it
        toolArgs = toolCall.args as z.infer<typeof queryDocumentsTool.parameters>; 
        try {
          // --- Execute the NEW tool --- 
          if (!currentUserId) throw new Error("Authentication context lost before tool execution.");
          // Pass the typed toolArgs, remove the userId parameter
          const rawToolResult = await queryDocumentsTool.execute(
              toolArgs 
          );
          // ----------------------------- 
          
          // Format the result into a simple string summary
          if (rawToolResult.error) {
            queryResultSummary = `An error occurred during the query: ${rawToolResult.error}`;
          } else if (typeof rawToolResult.queryResults === 'string') {
             queryResultSummary = `Query completed: ${rawToolResult.queryResults}`; 
          } else if (Array.isArray(rawToolResult.queryResults)) {
             queryResultSummary = `Query found ${rawToolResult.queryResults.length} document(s):\n` +
               rawToolResult.queryResults.map(doc => 
                   `- ${doc.name || `ID ${doc.id.substring(0,8)}...`}: Vendor=${doc.vendor || 'N/A'}, Date=${doc.document_date || 'N/A'}, Amt=${doc.total_amount !== null ? `${doc.total_amount} ${doc.currency || ''}`.trim() : 'N/A'}`
               ).join('\n');
          } else {
             queryResultSummary = "Received an unexpected result format from the query tool.";
          }
        } catch (toolExecError) {
           console.error(`Error executing tool ${toolCall.toolName}:`, toolExecError);
           queryResultSummary = `A critical error occurred while trying to execute the query: ${toolExecError instanceof Error ? toolExecError.message : String(toolExecError)}`;
        }
      } else {
        console.warn(`Unknown tool requested: ${toolCall.toolName}`);
        queryResultSummary = `An unknown tool '${toolCall.toolName}' was requested.`;
      }
      
      console.log("--- Query Result Summary ---");
      console.log(queryResultSummary);
      console.log("----------------------------");

      // --- Second AI Call (Synthesize response using summary) ---
      console.log("--- Sending to AI (Second Call - Simplified) ---");
      const messagesForSecondCall: CoreMessage[] = [
          { role: 'system', content: 'You are a helpful assistant. Formulate a response to the user\'s original query based on the provided query results context.' },
          { role: 'user', content: `My original query was: "${userQuery}"` }, 
          { role: 'assistant', content: `Query context:\n${queryResultSummary}` }, 
      ];
      console.log(JSON.stringify(messagesForSecondCall, null, 2));

      const finalResult = await generateText({ model: model, messages: messagesForSecondCall });
      console.log("--- Received from AI (Second Call) --- ", finalResult);
      finalResponseText = finalResult.text;
      // ---------------------------------------------------------- 

    } else if (initialResult.finishReason === 'stop') {
      console.log('AI responded directly (First Call):', initialResult.text);
      finalResponseText = initialResult.text;
    } else {
      console.error('Unexpected initial finish reason:', initialResult.finishReason, initialResult.toolCalls);
      return { success: false, error: `AI processing failed with reason: ${initialResult.finishReason}.` };
    }

    // --- Return Success --- 
    if (finalResponseText !== undefined) { return { success: true, response: finalResponseText }; } 
    else { return { success: false, error: 'Failed to generate final response.' }; }
    // ----------------------

  } catch (err) {
    // --- Handle Top-Level Errors ---
    console.error('Error in handleUserSearchQueryAction:', err);
    const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred.';
    if (errorMessage.includes('API key') || errorMessage.includes('quota')) { return { success: false, error: `AI API Error: ${errorMessage}`}; }
    return { success: false, error: errorMessage };
  }
} 