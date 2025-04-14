-- First, ensure the pgvector extension is enabled
-- This is typically done once per database
CREATE EXTENSION IF NOT EXISTS pgvector;

-- Create or replace the match_documents function for semantic search
CREATE OR REPLACE FUNCTION match_documents(
  query_embedding vector(768),  -- Must match the dimension of your embeddings (Gemini uses 768)
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
    1 - (d.embedding <=> query_embedding) as similarity  -- Calculate cosine similarity
  FROM
    documents d
  WHERE
    1 - (d.embedding <=> query_embedding) > match_threshold
    -- Only return documents from the current user's upload (use for Row Level Security)
    -- AND d.uploaded_by = auth.uid()
  ORDER BY
    d.embedding <=> query_embedding  -- Order by vector similarity (closest first)
  LIMIT
    match_count;
END;
$$;

-- Add Row Level Security policy if not already in place
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- Create policy for users to only see their own documents
CREATE POLICY "Users can view their own documents" 
  ON documents FOR SELECT 
  USING (uploaded_by = auth.uid());

-- Create policy for search function to work with RLS
CREATE POLICY "match_documents can access all documents" 
  ON documents FOR SELECT 
  TO authenticated
  USING (true); 