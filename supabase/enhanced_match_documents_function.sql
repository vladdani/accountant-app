-- Enhanced match_documents function with user filtering and structured data queries
CREATE OR REPLACE FUNCTION enhanced_match_documents(
  query_embedding vector(768),     -- Vector embedding from the search query
  user_id uuid,                    -- User ID to filter documents
  filter_type text DEFAULT NULL,   -- Optional document type filter
  date_from timestamp DEFAULT NULL, -- Optional date range filter
  date_to timestamp DEFAULT NULL,   -- Optional date range filter
  match_threshold float DEFAULT 0.75, -- Minimum similarity threshold
  match_count int DEFAULT 10      -- Maximum results to return
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
  -- Return documents that match both semantic similarity and structured filters
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
    -- User filter (security)
    d.uploaded_by = user_id
    
    -- Semantic similarity threshold
    AND 1 - (d.embedding <=> query_embedding) > match_threshold
    
    -- Optional filters for structured data (when provided)
    AND (filter_type IS NULL OR LOWER(d.extracted_data->>'type') = LOWER(filter_type))
    
    -- Date range filtering if dates are provided
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
  
  -- Order by semantic similarity (most relevant first)
  ORDER BY
    similarity DESC
  
  -- Limit results
  LIMIT
    match_count;
END;
$$;

-- Example usage in your API:
-- 
-- const { data, error } = await supabase.rpc('enhanced_match_documents', {
--   query_embedding: queryEmbedding,
--   user_id: session.user.id,
--   filter_type: 'invoice',  // Optional filter
--   date_from: '2023-01-01',  // Optional date range
--   date_to: '2023-12-31',    // Optional date range
--   match_threshold: 0.7,
--   match_count: 10
-- }); 