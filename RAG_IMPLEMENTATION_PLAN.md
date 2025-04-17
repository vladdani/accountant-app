# RAG Implementation Plan (MVP)

This document outlines the steps to implement a basic Retrieval-Augmented Generation (RAG) capability for content-based document search within the existing application structure.

**Goal:** Enable the AI assistant to answer questions based on the _semantic meaning_ of the document content, not just the pre-extracted metadata filters.

**MVP Approach:**

1.  **Store Embeddings:** Add a vector embedding for each document during the _existing_ upload process.
2.  **Semantic Retrieval:** Create a new, separate action/tool that finds documents with embeddings similar to the user's query embedding.
3.  **Augmented Generation:** Feed the content of these retrieved documents to the AI assistant to generate the final answer.

**Plan:**

**(Phase 1: Setup - Database & Types)**

1.  **Add `embedding` Column:**

    - **Action:** Add a `vector` column to the `documents` table in Supabase. Choose dimensions matching the embedding model (e.g., 768 for `text-embedding-004`). Enable `pgvector` extension if not already done.
    - **SQL (Example):**

      ```sql
      -- Ensure pgvector is enabled first (run once per project)
      -- create extension vector with schema extensions;

      -- Add the column
      ALTER TABLE documents
      ADD COLUMN embedding vector(768); -- Adjust dimension (768) as needed
      ```

    - **Why:** Stores numerical representation for similarity searches.

2.  **Update `types_db.ts`:**
    - **Action:** Add `embedding: number[] | string | null;` (Supabase might return string representation) to `Row`, `Insert`, `Update` for the `documents` table.
    - **File:** `types_db.ts`
    - **Why:** Ensures TypeScript type safety.

**(Phase 2: Indexing - Embedding Generation During Upload)**

3.  **Modify Upload Action (`upload-file.ts`):**
    - **Action:** Enhance the AI extraction step in `uploadFile`.
      - **Get/Store Text Content:** Modify the `extractionPrompt` to also explicitly request the full extracted text (`content: string | null`). Ensure this is saved to the `content` column in the `documents` table (this column seems to exist in `types_db.ts`). Update `AiExtractionResult` interface.
      - **Generate Embedding:** After successfully getting the text content, use an embedding model (e.g., Google's `text-embedding-004`) via its SDK to generate a vector embedding from the `content`. Handle potential errors if content is empty/null.
      - **Store Embedding:** Update the `documents` record (using `dbRecordId`) to save the generated `embedding` vector. This might require a separate `update` call after the initial metadata update.
    - **File:** `app/actions/upload-file.ts`
    - **Why:** Creates the searchable vector index for each new document.

**(Phase 3: Retrieval - Semantic Search Tool)**

4.  **Create Semantic Search Action:**
    - **Action:** Create a new server action file.
    - **File:** `app/actions/semantic-search-documents.ts` (New file)
    - **Function:** `semanticSearchAction(queryText: string)`
      - Get authenticated user ID.
      - Generate an embedding for the `queryText` using the _same_ embedding model.
      - Create a Supabase RPC function (e.g., `match_documents`) that performs the vector similarity search (`<=>` operator) against the `documents` table's `embedding` column, filtering by `uploaded_by` and returning top N matches (e.g., 3-5). This function takes the query embedding and user ID as arguments. (See Supabase `pgvector` docs).
      - Call this RPC function from the server action.
      - Retrieve relevant fields (e.g., `content`, `original_filename`, `document_url`, `id`) of matching documents.
      - Return the list of results (e.g., `{ success: true, results: [{ name: '...', content: '...', url: '...' }] }`).
    - **Why:** Provides the mechanism to find relevant documents by meaning.
5.  **Define Semantic Search Tool:**
    - **Action:** In `handle-user-search-query.ts`, define a new tool `semantic_search` using `ai/core`.
    - **Description:** Explain it searches _document content_ (e.g., "Searches document content based on meaning. Use for questions about topics or information _within_ documents.").
    - **Parameters:** `z.object({ query: z.string().describe("The user's query to search for semantically.") })`
    - **Execute:** Call `semanticSearchAction`.
    - **File:** `app/actions/handle-user-search-query.ts`
    - **Why:** Allows the main AI assistant to invoke semantic search.

**(Phase 4: Generation - Integration & Response)**

6.  **Update Search Handler (`handle-user-search-query.ts`):**
    - **Action:** Modify `handleUserSearchQueryAction`.
      - **Provide Both Tools:** Pass both `query_documents` and `semantic_search` tools to `generateText`.
      - **Refine System Prompt:** Explain the two tools and guide the AI on when to use each (metadata vs. content).
      - **Handle Tool Call:** Add logic for `toolCall.toolName === 'semantic_search'`.
        - Call the tool.
        - Format results (e.g., `Found relevant content in [Doc Name]: "[content snippet]"`). Return this formatted string/object in the `tool-result`.
        - Pass results back to the AI. The AI will use this retrieved content to generate its final answer. Consider context length limits - send snippets or summaries if full content is too long.
    - **File:** `app/actions/handle-user-search-query.ts`
    - **Why:** Integrates retrieval with generation.

**MVP Considerations:**

- **Embedding Model Choice:** Select a model and stick with it. Note dimensions for the DB column.
- **Content Handling:** Decide whether to store full text in `content` or just use it for embedding generation. Returning snippets from the search might be enough initially.
- **Error Handling:** Add checks for empty content before embedding, failed embedding generation, failed DB search, etc.
- **Cost/Latency:** Be aware of the added costs and time for embedding generation and vector search queries.
- **UI:** No UI changes initially planned for MVP; results are shown via the chat assistant.

This plan provides a roadmap for adding semantic search capabilities incrementally.
