'use server';

import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import { queryStructuredDocumentsAction } from './query-structured-documents';
import { StructuredQueryResult } from '@/types/actions';

// Initialize the Gemini API
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

interface AiSearchResponse {
  success: boolean;
  data?: StructuredQueryResult[];
  error?: string;
  interpretation?: string;
}

export async function aiSearchDocumentsAction(
  query: string
): Promise<AiSearchResponse> {
  if (!query || query.trim() === '') {
    return { success: false, error: 'Please provide a search query' };
  }

  try {
    // Get the model
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-2.0-flash',
      safetySettings: [
        { 
          category: HarmCategory.HARM_CATEGORY_HARASSMENT, 
          threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE 
        },
        { 
          category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, 
          threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE 
        },
        { 
          category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, 
          threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE 
        },
        { 
          category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, 
          threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE 
        }
      ]
    });

    // The prompt for Gemini
    const prompt = `
    You are a document search system expert that helps extract accurate search parameters from natural language queries.
    
    Analyze this document search query: "${query}"
    
    Extract the following information and format as a structured JSON:
    
    1. search_terms: An array of specific keywords that should be searched verbatim, including:
       - Important terms from the query that should be matched exactly
       - Any specialized terminology or proper nouns
       - Avoid common/generic words like "show", "find", "get", etc.
    
    2. vendor: Any company, business, supplier name, or merchant mentioned. Extract the EXACT name as written with NO modifications.
    
    3. document_type: The type of document being searched for. Map general terms to specific document types:
       - "bills", "charges", "purchases" → "invoice"
       - "receipts", "sales slips" → "receipt"
       - "contracts", "agreements" → "contract"
       - etc.
    
    4. start_date: Convert any date reference to YYYY-MM-DD format, including:
       - Exact dates mentioned ("January 15, 2023" → "2023-01-15")
       - Relative periods ("last month" → first day of previous month)
       - Year only ("2023" → "2023-01-01")
       - Quarters ("Q2 2023" → "2023-04-01")
    
    5. end_date: Similar to start_date, but for end range
    
    6. min_amount: Any minimum transaction amount mentioned
    
    7. max_amount: Any maximum transaction amount mentioned
    
    8. currency: Currency code (USD, EUR, etc.)
    
    ONLY include fields where information is EXPLICITLY stated or STRONGLY implied.
    PRESERVE exact spelling and phrasing for vendor names and specialized terms.
    DO NOT make assumptions about what the user might have meant.
    DO NOT correct or modify names/terms that appear to be misspelled.
    
    Return valid JSON only, no explanations or additional text.
    `;

    // Generate the structured parameters
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    
    // Parse the JSON result
    let parsedParams;
    try {
      // Extract JSON if it's wrapped in code blocks or has extra text
      const jsonMatch = responseText.match(/```json\s*([\s\S]+?)\s*```/) || 
                        responseText.match(/```\s*([\s\S]+?)\s*```/) ||
                        responseText.match(/(\{[\s\S]+\})/);
      
      const jsonStr = jsonMatch ? jsonMatch[1] : responseText;
      parsedParams = JSON.parse(jsonStr);
      
      console.log('AI interpreted search parameters:', parsedParams);
    } catch {
      console.error('Failed to parse AI response:', responseText);
      return { 
        success: false, 
        error: 'Failed to interpret search query', 
        interpretation: responseText 
      };
    }

    // Call the structured search with the parameters
    const searchResult = await queryStructuredDocumentsAction(parsedParams);
    
    // Return results with interpretation
    return {
      ...searchResult,
      interpretation: `I searched for ${
        parsedParams.document_type ? parsedParams.document_type + ' ' : ''
      }${
        parsedParams.vendor ? 'from ' + parsedParams.vendor + ' ' : ''
      }${
        parsedParams.start_date || parsedParams.end_date ? 'dated ' : ''
      }${
        parsedParams.start_date ? 'from ' + parsedParams.start_date + ' ' : ''
      }${
        parsedParams.end_date ? 'to ' + parsedParams.end_date + ' ' : ''
      }${
        parsedParams.min_amount !== undefined || parsedParams.max_amount !== undefined ? 'with amount ' : ''
      }${
        parsedParams.min_amount !== undefined ? 'from ' + parsedParams.min_amount + ' ' : ''
      }${
        parsedParams.max_amount !== undefined ? 'to ' + parsedParams.max_amount + ' ' : ''
      }${
        parsedParams.currency ? parsedParams.currency : ''
      }${
        parsedParams.search_terms && parsedParams.search_terms.length > 0 ? 
          ' containing keywords: ' + parsedParams.search_terms.join(', ') : ''
      }`
    };
  } catch (error: unknown) {
    console.error('AI search error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An error occurred during AI search';
    return { 
      success: false, 
      error: errorMessage
    };
  }
}