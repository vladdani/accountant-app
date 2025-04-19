'use server';

import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { CoreMessage, generateText, tool } from 'ai';
import { z } from 'zod';
import { queryStructuredDocumentsAction, queryParamsSchema } from '@/app/actions/query-structured-documents';
import { createClient } from '@/utils/supabase/server';

// --- Types ---
// (Removed unused StructuredQueryResult interface)

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
const mainActionInputSchema = z.object({ userQuery: z.string().min(1), chatHistory: z.array(z.custom<CoreMessage>()).optional(), });

// ---+++ SINGLE Tool Definition +++---
const searchDocumentsTool = tool({
  description: "Search for documents based on keywords, concepts, or specific filters like vendor, date range, or document type.",
  parameters: z.object({
    search_terms: z.array(z.string()).optional().describe("Keywords or concepts extracted from the user query (e.g., ['chicken wings'], ['booking.com', 'invoice']). Provide if the user uses general terms."),
    filter_vendor: z.string().optional().describe("Specific vendor name identified."),
    filter_type: z.string().optional().describe("Specific document type identified (e.g., invoice, receipt)."),
    filter_start_date: z.string().optional().describe("Start date filter (YYYY-MM-DD)."),
    filter_end_date: z.string().optional().describe("End date filter (YYYY-MM-DD)."),
  }),
});

// Combine the single tool for the AI
const tools = { searchDocuments: searchDocumentsTool };

// Tool result content interface
interface ToolResultContent {
  results?: string; // Pre-formatted summary or error message
  error?: string;
}

// --- Main Action ---
export async function handleUserSearchQueryAction(
  input: z.infer<typeof mainActionInputSchema>
): Promise<{ success: boolean; response?: string; error?: string }> {

  // --- Authentication ---
  let currentUserId: string | null = null;
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) { throw new Error("Authentication failed"); }
    currentUserId = user.id;
    console.log(`Authenticated user: ${currentUserId}`);
  } catch (catchError) {
    console.error('Auth Error:', catchError);
    return { success: false, error: 'User identification failed.' };
  }

  // --- Input Validation ---
  const validationResult = mainActionInputSchema.safeParse(input);
  if (!validationResult.success) { return { success: false, error: validationResult.error.errors.map(e => e.message).join(', ') }; }
  const { userQuery, chatHistory = [] } = validationResult.data;

  // --- System Prompt (Updated for Single Tool) ---
  const systemInstruction = `
You are a helpful assistant for managing documents. You have one tool: \`searchDocuments\`.

IMPORTANT SEARCH RULES:
1. ALWAYS prioritize identifying vendor/company names from the query and place them in 'filter_vendor', not in 'search_terms'.
2. When a vendor name is detected, search with the SHORTEST possible version (e.g., for "Jaens Spa Shanti Ubud", use just "Jaens Spa" or even just "Jaens").
3. Never include generic terms like "transactions", "documents", "records", or "receipts" in search_terms.
4. Only use 'search_terms' for specific keywords that are NOT vendor names, document types, or dates.
5. When a vendor name contains multiple words, recognize it as a SINGLE entity (e.g., "Amazon Prime" is one vendor).

Example query: "Show me transactions from Jaens Spa"
Correct parameters: { filter_vendor: "Jaens Spa", search_terms: [] }
INCORRECT parameters: { search_terms: ["Jaens", "Spa", "transactions"] }

Example query: "Find invoices from Microsoft dated January"
Correct parameters: { filter_vendor: "Microsoft", filter_type: "invoice", filter_start_date: "2025-01-01", filter_end_date: "2025-01-31" }

Use the tool to perform the search. 
When the tool returns results, generate a natural, conversational response based on the summary.
Base your response entirely on the summary provided by the tool result. DO NOT add info not present in the summary.
If the tool returns an error or no documents found, inform the user clearly.
`;

  const messages: CoreMessage[] = [
    { role: 'system', content: systemInstruction },
    ...chatHistory,
    { role: 'user', content: userQuery },
  ];

  try {
    // --- First AI Call (Determine args for searchDocuments tool) ---
    console.log("--- Sending to AI (First Call) ---");
    let result = await generateText({
      model: model,
      messages: messages,
      tools: tools, // Pass the single tool definition
    });
    console.log("--- Received from AI (First Call) ---", result);

    // --- Handle Tool Calls ---
    while (result.finishReason === 'tool-calls') {
      console.log('AI wants to call tools:', result.toolCalls);
      const toolCallResults: CoreMessage[] = [];

      for (const toolCall of result.toolCalls) {
        let toolCallResultContent: ToolResultContent;
        const toolName = toolCall.toolName as keyof typeof tools;

        console.log(`[AI Search] Attempting Tool Call: ${toolName}`);
        console.log(`[AI Search] Raw Args from AI:`, JSON.stringify(toolCall.args, null, 2));

        try {
          if (toolName === 'searchDocuments') {
            // Parse the arguments provided by the AI for the search tool
            const parsedArgs = searchDocumentsTool.parameters.parse(toolCall.args);
            
            // Prepare parameters for the backend action, mapping filter_ names
            const backendParams: z.infer<typeof queryParamsSchema> = {
                search_terms: parsedArgs.search_terms,
                vendor: parsedArgs.filter_vendor,
                document_type: parsedArgs.filter_type,
                start_date: parsedArgs.filter_start_date,
                end_date: parsedArgs.filter_end_date,
                // Add amount/currency if they were kept in the tool schema
            };
            console.log(`[AI Search] Mapped Args for Backend Query:`, JSON.stringify(backendParams, null, 2));

            // --- Call Backend Action ---
            const actionResult = await queryStructuredDocumentsAction(backendParams);

            // --- Process Result & Create Summary String for AI ---
            if (!actionResult.success) {
              console.error('searchDocuments action failed:', actionResult.error);
              toolCallResultContent = { error: `Tool Error: Failed query (${actionResult.error || 'Unknown error'})` };
            } else if (!actionResult.data || actionResult.data.length === 0) {
              console.log('searchDocuments returned no results.');
              toolCallResultContent = { results: "No documents found matching the criteria." };
            } else {
              console.log(`searchDocuments returned ${actionResult.data.length} results.`);
              // Format summary (using the enhanced multi-line version from previous step)
              const formattedSummary = actionResult.data.map(doc => {
                  const name = doc.name || 'Untitled Document';
                  const vendor = doc.vendor ? ` from ${doc.vendor}` : '';
                  const date = doc.document_date ? `\n    Date: ${new Date(doc.document_date).toLocaleDateString()}` : '';
                  const amount = doc.total_amount !== null ? `\n    Amount: ${doc.total_amount.toLocaleString()} ${doc.currency || ''}`.trim() : '';
                  const desc = doc.description ? `\n    Description: ${doc.description.substring(0, 150)}${doc.description.length > 150 ? '...' : ''}` : '';
                  return `*   **${name}**${vendor}${date}${amount}${desc}`;
              }).join('\n\n');
              const summaryIntro = actionResult.data.length === 1 ? `Found 1 document:` : `Found ${actionResult.data.length} documents:`;
              toolCallResultContent = { results: `${summaryIntro}\n\n${formattedSummary}` };
            }
          } else {
             console.warn(`Unsupported tool called by AI: ${toolName}`);
             throw new Error(`Unsupported tool: ${toolName}`);
          }
        } catch (error) {
          console.error(`Error processing tool ${toolName}:`, error);
          const errorMsg = error instanceof Error ? error.message : String(error);
          toolCallResultContent = { error: `Tool Error: ${errorMsg}` }; 
        }

        toolCallResults.push({
          role: 'tool',
          content: [{ type: 'tool-result', toolCallId: toolCall.toolCallId, toolName: toolName, result: toolCallResultContent }]
        });
      } // End for loop

      // --- Let AI Process Tool Results ---
      const assistantMessageWithToolCalls: CoreMessage = {
        role: 'assistant',
        content: [
          ...(result.text ? [{ type: 'text' as const, text: result.text }] : []),
          ...result.toolCalls.map((tc) => ({
            type: 'tool-call' as const,
            toolCallId: tc.toolCallId,
            toolName: tc.toolName,
            args: tc.args,
          })),
        ],
      };
      messages.push(assistantMessageWithToolCalls);
      messages.push(...toolCallResults);
      console.log("--- Sending to AI (Next Call with Tool Results) ---");
      result = await generateText({ model: model, messages: messages, tools: tools });
      console.log("--- Received from AI (After Tool Call) ---", result);

    } // End while loop

    // --- Final Response Handling (AI generates this) ---
    if (result.finishReason === 'stop' && result.text) {
      console.log('AI stopped, returning AI text:', result.text);
      return { success: true, response: result.text };
    } 
    
    console.error('AI processing ended unexpectedly or without text:', result.finishReason);
    return { success: false, error: `AI processing ended unexpectedly: ${result.finishReason}.` };

  } catch (err) {
    console.error('Top-level error in handleUserSearchQueryAction:', err);
    const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred.';
    return { success: false, error: errorMessage };
  }
}