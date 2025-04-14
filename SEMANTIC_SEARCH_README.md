# Semantic Search Implementation

This README explains the multilingual semantic search functionality in the Digital Archive App, how it works, and how to set it up.

## Overview

Our semantic search system enables natural language search across documents in both English and Indonesian. It uses:

1. **Vector Embeddings**: Document text is converted to numerical vectors (embeddings) that capture semantic meaning
2. **PGVector**: Supabase's PostgreSQL vector extension for fast similarity search
3. **Gemini API**: Google's Gemini for embedding generation and text understanding

## How It Works

1. **Document Processing**:

   - Documents are processed using the `process-document` Edge Function
   - Text is extracted from PDFs, images, and other files
   - The Gemini API extracts structured data (dates, amounts, suppliers, etc.)
   - Text is converted to a vector embedding and stored in the `documents` table

2. **Search Process**:
   - User enters a natural language query (English or Indonesian)
   - The query is converted to a vector embedding
   - The database finds documents with similar vector representations
   - Results are sorted by relevance and enhanced with filters

## Setup Instructions

### 1. Database Setup

Run these SQL scripts in your Supabase SQL Editor:

```sql
-- In supabase/match_documents_function.sql
-- Basic search function
CREATE EXTENSION IF NOT EXISTS pgvector;

CREATE OR REPLACE FUNCTION match_documents(
  query_embedding vector(768),
  match_threshold float DEFAULT 0.75,
  match_count int DEFAULT 5
)
RETURNS TABLE (
  id uuid,
  file_path text,
  document_url text,
  type text,
  extracted_data jsonb,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    d.id,
    d.file_path,
    d.document_url,
    d.extracted_data->>'type' as type,
    d.extracted_data,
    1 - (d.embedding <=> query_embedding) as similarity
  FROM
    documents d
  WHERE
    1 - (d.embedding <=> query_embedding) > match_threshold
  ORDER BY
    d.embedding <=> query_embedding
  LIMIT
    match_count;
END;
$$;

-- Add security policies
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own documents"
  ON documents FOR SELECT
  USING (uploaded_by = auth.uid());
```

### 2. Enhanced Search (Optional)

For better user-specific filtering and more precise search:

```sql
-- In supabase/enhanced_match_documents_function.sql
CREATE OR REPLACE FUNCTION enhanced_match_documents(
  query_embedding vector(768),
  user_id uuid,
  filter_type text DEFAULT NULL,
  date_from timestamp DEFAULT NULL,
  date_to timestamp DEFAULT NULL,
  match_threshold float DEFAULT 0.75,
  match_count int DEFAULT 10
)
RETURNS TABLE (
  id uuid,
  file_path text,
  document_url text,
  type text,
  uploaded_at timestamp,
  extracted_data jsonb,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    d.id,
    d.file_path,
    d.document_url,
    d.extracted_data->>'type' AS type,
    d.uploaded_at,
    d.extracted_data,
    1 - (d.embedding <=> query_embedding) AS similarity
  FROM
    documents d
  WHERE
    d.uploaded_by = user_id
    AND 1 - (d.embedding <=> query_embedding) > match_threshold
    AND (filter_type IS NULL OR LOWER(d.extracted_data->>'type') = LOWER(filter_type))
    AND (
      date_from IS NULL OR
      (d.extracted_data->>'date' IS NOT NULL AND
       CAST(d.extracted_data->>'date' AS timestamp) >= date_from)
    )
    AND (
      date_to IS NULL OR
      (d.extracted_data->>'date' IS NOT NULL AND
       CAST(d.extracted_data->>'date' AS timestamp) <= date_to)
    )
  ORDER BY
    similarity DESC
  LIMIT
    match_count;
END;
$$;
```

### 3. API Route

The API route at `app/api/query-documents/route.ts` handles:

- Authentication using Next.js cookie-based auth
- Embedding generation with Gemini API
- Calling database functions
- Error handling with fallbacks

### 4. Frontend Integration

The dashboard page (`app/dashboard/page.tsx`) includes:

- Chat interface for user queries
- Natural language filter extraction
- Result display with document links

## Testing

1. Upload documents to the system
2. Wait for processing to complete
3. Go to the dashboard and try queries like:
   - "Show me invoices from January"
   - "Find receipts from PT ABC"
   - "Documents between 2023-01-01 and 2023-12-31"

## Troubleshooting

If you encounter authentication issues:

- Ensure `dynamic = 'force-dynamic'` is set in the API route
- Check that cookies are being properly passed to Supabase
- Verify Row Level Security policies are correctly configured

For vector search issues:

- Confirm pgvector extension is enabled
- Verify document embeddings are being generated (768 dimensions)
- Check similarity threshold (0.7-0.8 is recommended)
