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
    { role: 'system', content: 'You are a helpful assistant for managing documents. You can query documents based on structured fields like vendor, date, type, amount, and currency using the provided tool. When the user asks for specific data points (like transactions, amounts, dates for a vendor), extract and list that information clearly from the tool results. When the user asks for documents, provide a list of matching documents with key details (name, vendor, date, amount) based on the tool results. Always base your response on the data returned by the tool.' },
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

      // Define an interface for the tool result content (can contain results or error)
      interface ToolResultContent {
        results?: string; // JSON string of StructuredQueryResult[]
        error?: string;
      }

      for (const toolCall of result.toolCalls) {
        let toolCallResultContent: ToolResultContent; 
        const toolName = toolCall.toolName;

        console.log(`Processing tool call: ${toolName} with args:`, toolCall.args);

        try {
          if (toolName === 'query_documents') {
            const validatedArgs = queryDocumentsTool.parameters.parse(toolCall.args);
            const actionResult = await queryStructuredDocumentsAction(validatedArgs);

            if (!actionResult.success) {
              console.error('queryStructuredDocumentsAction failed:', actionResult.error);
              toolCallResultContent = { error: `Failed to query documents: ${actionResult.error || 'Unknown database error'}` };
            } else if (!actionResult.data || actionResult.data.length === 0) {
              console.log('queryStructuredDocumentsAction returned no results.');
              toolCallResultContent = { results: "[]" }; // Send empty array as JSON string
            } else {
              console.log(`queryStructuredDocumentsAction returned ${actionResult.data.length} results.`);
              // Pass the actual structured data back to the AI as a JSON string.
              const resultsJsonString = JSON.stringify(actionResult.data, null, 2);
              toolCallResultContent = { results: resultsJsonString }; 
            }
          } else {
            console.warn(`Unsupported tool requested: ${toolName}`);
            toolCallResultContent = { error: `Unsupported tool: ${toolName}` };
          }
        } catch (error) {
          console.error(`Error executing tool ${toolName}:`, error);
          toolCallResultContent = { error: `Error processing tool ${toolName}: ${error instanceof Error ? error.message : String(error)}` };
        }

        // Append the tool result message
        toolCallResults.push({
          role: 'tool',
          content: [
            { 
              type: 'tool-result',
              toolCallId: toolCall.toolCallId,
              toolName: toolName,
              result: toolCallResultContent // Contains { results: "[...]" } or { error: "..." }
            }
          ]
        });
      } // End for loop over toolCalls

      // Construct the assistant message containing the initial response + tool calls
      const assistantMessageWithToolCalls: CoreMessage = {
        role: 'assistant',
        content: [
          // Include assistant's text response (if any)
          ...(result.text ? [{ type: 'text' as const, text: result.text }] : []), 
          // Map the tool calls into the content array
          ...result.toolCalls.map((tc) => ({
            type: 'tool-call' as const, 
            toolCallId: tc.toolCallId,
            toolName: tc.toolName,
            args: tc.args,
          })),
        ],
      };
      
      // Add assistant message and tool results to history
      messages.push(assistantMessageWithToolCalls); 
      messages.push(...toolCallResults); 

      console.log("--- Sending to AI (Next Call with Tool Results) ---");
      console.log(JSON.stringify(messages, null, 2));

      // Call generateText again
      result = await generateText({
        model: model,
        messages: messages,
        tools: { query_documents: queryDocumentsTool }, 
      });

      console.log("--- Received from AI (After Tool Call) ---", result);
    } // End while loop (tool-calls)
    // -------------------------------------------

    // --- Final Response --- 
    if (result.finishReason === 'stop') {
      console.log('AI stopped, final response:', result.text);
      // Ensure result.text is not null or undefined before returning
      if (result.text) {
          return { success: true, response: result.text };
      } else {
          console.error('AI stopped but provided no text response.');
          return { success: false, error: 'AI completed processing but did not provide a response.' };
      }
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
    // Add a specific check for the empty content error
    if (errorMessage.includes('GenerateContentRequest.content.contents.parts must not be empty')) {
        console.error('Detected empty content error. Review message history construction.');
        return { success: false, error: 'AI request failed due to empty content. Please check the logs.' };
    }
    return { success: false, error: errorMessage };
  }
} // End of handleUserSearchQueryAction