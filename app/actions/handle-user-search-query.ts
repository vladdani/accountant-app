'use server';

import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { CoreMessage, generateText, tool } from 'ai';
import { z } from 'zod';
import { queryStructuredDocumentsAction } from './query-structured-documents';
import { createClient } from '@/utils/supabase/server';

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
// Remove unused constant
// const TEMP_TEST_USER_ID = '0d4f5e60-258a-46ea-92ce-c0ffc9263e1b';

// ... (Google API Key Check, AI Client Init) ...
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) { throw new Error('Missing GOOGLE_GENERATIVE_AI_API_KEY environment variable.'); }
if (!supabaseUrl || !supabaseAnonKey) { throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable.'); }
const google = createGoogleGenerativeAI({ apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY });
const model = google('models/gemini-1.5-flash');
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
  // Execute function: This might not be strictly necessary if we handle execution
  // directly based on toolCall.toolName below, but keep for potential future use/clarity.
  // Removed unused _context argument.
  execute: async (args): Promise<StructuredToolExecuteSuccessResult | { queryResults: string, error: string }> => {
    console.log(`AI requested structured query with args (in execute):`, args);
    // This execute function *should* ideally contain the logic to call queryStructuredDocumentsAction,
    // but we are handling it directly in the main action flow for now.
    // To avoid duplication, we can call the action here.
    const result = await queryStructuredDocumentsAction(args);
    if (!result.success) {
      console.error('queryStructuredDocumentsAction failed (in execute):', result.error);
      return { queryResults: "", error: `Failed to query documents: ${result.error || 'Unknown database error'}` };
    }
    if (!result.data || result.data.length === 0) {
      console.log('queryStructuredDocumentsAction returned no results (in execute).');
      return { queryResults: "No documents found matching those criteria." };
    }
    console.log(`queryStructuredDocumentsAction returned ${result.data.length} results (in execute).`);
    return { queryResults: result.data };
  },
});
// ---++++++++++++++++++++++++++++++++++++++++++++---

// --- Main Action ---
export async function handleUserSearchQueryAction(
  input: z.infer<typeof querySchema>
): Promise<{ success: boolean; response?: string; error?: string }> {

  // --- Authentication ---
  let currentUserId: string | null = null;
  try {
      // Ensure we properly await the client creation
      const supabase = await createClient();
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) { throw new Error("Authentication failed"); }
      currentUserId = user.id;
      console.log(`Using real ID: ${currentUserId}`);
  } catch (catchError) {
      console.error('Auth Error in handleUserSearchQueryAction:', catchError);
      return { success: false, error: 'User identification failed.' };
  }
  // ------------------------------------------

  // --- Input Validation ---
  const validationResult = querySchema.safeParse(input);
  if (!validationResult.success) { return { success: false, error: validationResult.error.errors.map(e => e.message).join(', ') }; }
  const { userQuery, chatHistory = [] } = validationResult.data;
  // ------------------------------------------

  // --- Initial Message History ---
  const messages: CoreMessage[] = [
    { role: 'system', content: 'You are a helpful assistant for managing documents. You can query documents based on structured fields like vendor, date, type, amount, and currency using the provided tool.' },
    ...chatHistory,
    { role: 'user', content: userQuery },
  ];
  // -----------------------------

  try {
    // --- First AI Call (Determine if tool is needed) ---
    console.log("--- Sending to AI (First Call) ---");
    console.log(JSON.stringify(messages, null, 2));
    let result = await generateText({
      model: model,
      messages: messages,
      tools: { query_documents: queryDocumentsTool },
    });
    console.log("--- Received from AI (First Call) ---", result);
    // ----------------------------------------------------

    // --- Handle Tool Calls (Standard Pattern) ---
    while (result.finishReason === 'tool-calls') {
      console.log('AI wants to call tools:', result.toolCalls);
      const toolCallResults: CoreMessage[] = [];

      // Define an interface for the tool result content
      interface ToolResultContent {
        results?: string;
        error?: string;
      }

      for (const toolCall of result.toolCalls) {
        let toolCallResultContent: ToolResultContent; // Use the interface here
        const toolName = toolCall.toolName; // Use const instead of let

        console.log(`Processing tool call: ${toolName} with args:`, toolCall.args);

        try {
          if (toolName === 'query_documents') {
            // Directly call the action, passing validated args
            // Ensure args match the Zod schema defined in the tool
            const validatedArgs = queryDocumentsTool.parameters.parse(toolCall.args);
            const actionResult = await queryStructuredDocumentsAction(validatedArgs);

            if (!actionResult.success) {
              console.error('queryStructuredDocumentsAction failed:', actionResult.error);
              toolCallResultContent = { error: `Failed to query documents: ${actionResult.error || 'Unknown database error'}` };
            } else if (!actionResult.data || actionResult.data.length === 0) {
              console.log('queryStructuredDocumentsAction returned no results.');
              toolCallResultContent = { results: "No documents found matching those criteria." };
            } else {
              console.log(`queryStructuredDocumentsAction returned ${actionResult.data.length} results.`);
              // Summarize results for the AI
               const summary = `Query found ${actionResult.data.length} document(s):\n` +
                 actionResult.data.map(doc =>
                     `- ${doc.name || `ID ${doc.id.substring(0,8)}...`}: Vendor=${doc.vendor || 'N/A'}, Date=${doc.document_date || 'N/A'}, Amt=${doc.total_amount !== null ? `${doc.total_amount} ${doc.currency || ''}`.trim() : 'N/A'}`
                 ).join('\n');
              toolCallResultContent = { results: summary };
            }
          } else {
            console.warn(`Unsupported tool requested: ${toolName}`);
            toolCallResultContent = { error: `Unsupported tool: ${toolName}` };
          }
        } catch (error) {
          console.error(`Error executing tool ${toolName}:`, error);
          toolCallResultContent = { error: `Error processing tool ${toolName}: ${error instanceof Error ? error.message : String(error)}` };
        }

        // Append the tool result message with the correct content structure
        toolCallResults.push({
          role: 'tool',
          content: [ // Content IS an array here
            { 
              type: 'tool-result', // Specify the type
              toolCallId: toolCall.toolCallId, // Include toolCallId inside
              toolName: toolName, // Add toolName here
              result: toolCallResultContent // The result object (not stringified)
            }
          ]
        });
      }

      // Append the AI's text response and the tool results
      messages.push({ // Create assistant message manually
        role: 'assistant',
        content: result.text || '' // Use the text response
      });
      messages.push(...toolCallResults); // Add the tool results separately
      
      // Remove the incorrect attempt to push result.message
      // messages.push(result.message); 

      console.log("--- Sending to AI (Next Call with Tool Results) ---");
      console.log(JSON.stringify(messages, null, 2));

      // Call generateText again with the updated messages
      result = await generateText({
        model: model,
        messages: messages,
        tools: { query_documents: queryDocumentsTool }, // Keep tools available if needed again
      });

      console.log("--- Received from AI (After Tool Call) ---", result);
    }
    // -------------------------------------------

    // --- Final Response --- 
    if (result.finishReason === 'stop') {
      console.log('AI stopped, final response:', result.text);
      return { success: true, response: result.text };
    } else {
      console.error('Unexpected final finish reason:', result.finishReason, result.toolCalls);
      return { success: false, error: `AI processing ended unexpectedly with reason: ${result.finishReason}.` };
    }
    // ----------------------

  } catch (err) {
    // --- Handle Top-Level Errors ---
    console.error('Error in handleUserSearchQueryAction:', err);
    const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred.';
    if (errorMessage.includes('API key') || errorMessage.includes('quota')) { return { success: false, error: `AI API Error: ${errorMessage}`}; }
    return { success: false, error: errorMessage };
  }
} 