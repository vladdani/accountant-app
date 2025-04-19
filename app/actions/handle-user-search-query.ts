'use server';

import type { CoreMessage } from 'ai';
import { createClient } from '@supabase/supabase-js';

// --- Constants and Setup ---
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) { 
  throw new Error('Missing GOOGLE_GENERATIVE_AI_API_KEY environment variable.'); 
}

const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

// Define interfaces for document types
interface Document {
  id: string;
  file_path?: string;
  document_url?: string;
  uploaded_at?: string;
  original_filename?: string | null;
  document_type?: string | null;
  document_date?: string | null;
  total_amount?: number | null;
  vendor?: string | null;
  description?: string | null;
}

// Main action for handling user search queries
export async function handleUserSearchQueryAction({
  userQuery,
  userId
}: {
  userQuery: string;
  chatHistory?: CoreMessage[]; // Keep as optional but unused parameter
  userId?: string;
}): Promise<{ success: boolean; response?: string; error?: string }> {
  try {
    // Extract user ID from auth if not provided
    let searchUserId = userId;
    if (!searchUserId) {
      const { data: { user } } = await supabase.auth.getUser();
      searchUserId = user?.id;
    }

    if (!searchUserId) {
      return {
        success: false,
        error: "User not authenticated"
      };
    }

    // 1. Generate embedding for the search query using Google's embedding model
    const queryEmbedding = await generateEmbedding(userQuery);
    if (!queryEmbedding) {
      return {
        success: false,
        error: "Failed to generate embedding for search query"
      };
    }

    // 2. Perform semantic search
    const searchResults = await performSemanticSearch(
      searchUserId,
      queryEmbedding,
      userQuery
    );

    // 3. Generate a response based on the search results
    const response = await generateSearchResponse(
      userQuery, 
      searchResults
    );

    // 4. Log this interaction to improve future searches
    await logSearchInteraction(
      searchUserId,
      userQuery,
      searchResults.map((r: Document) => r.id),
      queryEmbedding
    );

    return {
      success: true,
      response
    };
  } catch (error) {
    console.error('Error in search query action:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error in search'
    };
  }
}

// Generate embedding for a text string using Google's embedding model
async function generateEmbedding(text: string): Promise<number[] | null> {
  try {
    // Use Google's embedding model via the embedding API
    const embeddingResponse = await fetch('https://generativelanguage.googleapis.com/v1/models/embedding-001:embedContent', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': process.env.GOOGLE_GENERATIVE_AI_API_KEY || '',
      },
      body: JSON.stringify({
        model: 'models/embedding-001',
        content: {
          parts: [{ text: text.replace(/\n/g, " ") }]
        }
      })
    });

    if (!embeddingResponse.ok) {
      throw new Error(`Embedding API error: ${embeddingResponse.status} ${embeddingResponse.statusText}`);
    }

    const result = await embeddingResponse.json();
    return result.embedding.values;
  } catch (error) {
    console.error('Error generating embedding:', error);
    return null;
  }
}

// Perform semantic search with fallbacks to keyword search
async function performSemanticSearch(
  userId: string,
  embedding: number[],
  originalQuery: string
): Promise<Document[]> {
  // 1. First try semantic search with embeddings
  const { data: semanticResults, error } = await supabase
    .rpc('match_documents', {
      query_embedding: embedding,
      match_threshold: 0.5, // Adjust threshold as needed
      match_count: 5, // Number of results to return
      user_id: userId
    });

  if (error) {
    console.warn('Semantic search error:', error);
    // Initialize with empty array if error
    const emptyResults: Document[] = [];
    
    // 2. If semantic search had an error, try keyword search as fallback
    const { data: keywordResults, error: keywordError } = await performKeywordSearch(
      userId,
      originalQuery
    );

    if (keywordError) {
      console.warn('Keyword search error:', keywordError);
      return emptyResults;
    } 
    
    return keywordResults || emptyResults;
  }

  // If semantic search returned results but not enough, supplement with keyword search
  if (semanticResults && semanticResults.length < 3) {
    const { data: keywordResults, error: keywordError } = await performKeywordSearch(
      userId,
      originalQuery
    );

    if (!keywordError && keywordResults && keywordResults.length > 0) {
      // Merge semantic and keyword results, removing duplicates
      const allDocIds = new Set(semanticResults.map((doc: Document) => doc.id));
      const combinedResults = [...semanticResults];
      
      for (const doc of keywordResults as Document[]) {
        if (!allDocIds.has(doc.id)) {
          combinedResults.push(doc);
          allDocIds.add(doc.id);
        }
      }
      
      return combinedResults;
    }
  }

  return semanticResults || [];
}

// Perform keyword-based search as a fallback
async function performKeywordSearch(
  userId: string,
  query: string
): Promise<{ data: Document[] | null, error: Error | null }> {
  // Split query into keywords
  const keywords = query
    .toLowerCase()
    .split(/\s+/)
    .map(word => word.replace(/[^\w]/g, ''))
    .filter(word => word.length >= 3);
  
  if (keywords.length === 0) {
    return { data: [], error: null };
  }

  // Search in multiple fields with ILIKE for each keyword
  let queryBuilder = supabase
    .from('documents')
    .select('*')
    .eq('uploaded_by', userId);

  // Add search conditions
  keywords.forEach((keyword) => {
    // Search across multiple columns for each keyword
    queryBuilder = queryBuilder.or(
      `original_filename.ilike.%${keyword}%,` +
      `document_type.ilike.%${keyword}%,` +
      `vendor.ilike.%${keyword}%,` +
      `description.ilike.%${keyword}%`
    );
  });

  return await queryBuilder.limit(5);
}

// Generate a response based on search results
async function generateSearchResponse(
  query: string,
  results: Document[]
): Promise<string> {
  // If no results found
  if (!results || results.length === 0) {
    return `I couldn't find any documents matching "${query}". Try a different search term or check if the documents have been uploaded.`;
  }

  // Format response based on the documents found
  const formattedResults = results.map((doc: Document) => {
    // Extract key information
    const date = doc.document_date ? new Date(doc.document_date).toLocaleDateString() : 'Unknown date';
    const vendor = doc.vendor || 'Unknown vendor';
    const type = doc.document_type || 'document';
    const amount = doc.total_amount ? `${doc.total_amount}` : '';
    const description = doc.description || '';

    // Return formatted string for this document
    return `- ${type} from ${vendor}, dated ${date}${amount ? `, for ${amount}` : ''}${description ? `. The description says "${description}"` : ''}.`;
  }).join('\n');

  // Create appropriate introduction based on number of results
  let intro = '';
  if (results.length === 1) {
    const doc = results[0];
    const type = doc.document_type || 'document';
    const vendor = doc.vendor || 'Unknown vendor';
    intro = `I found one ${type} from ${vendor}`;
  } else {
    intro = `I found ${results.length} documents matching your search:`;
  }

  return `${intro}\n\n${formattedResults}\n\nWould you like to know anything else about ${results.length === 1 ? 'this document' : 'these documents'}?`;
}

// Log search interaction to improve future searches
async function logSearchInteraction(
  userId: string,
  query: string,
  resultIds: string[],
  queryEmbedding: number[]
): Promise<void> {
  try {
    // Store the search interaction
    await supabase
      .from('search_logs')
      .insert({
        user_id: userId,
        query,
        result_document_ids: resultIds,
        query_embedding: queryEmbedding,
        created_at: new Date().toISOString()
      });
  } catch (error) {
    // Log but don't fail the search if this fails
    console.error('Error logging search interaction:', error);
  }
}