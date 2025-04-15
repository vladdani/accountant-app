# Backend & Database Setup Documentation (Pre-Search API)

This document outlines the state of the backend document processing pipeline and database configuration established _before_ the implementation of the semantic search API route (`/app/api/query-documents`).

---

**2. Database Setup (Supabase PostgreSQL)**

- **`pgvector` Extension:** Enabled on the Supabase project to handle vector data types and similarity searches.
- **`documents` Table (Simplified Schema):**
  - `id` (uuid, primary key)
  - `file_path` (text): Path to the file within the Supabase Storage bucket (e.g., `user_id/year/month/filename.pdf`). Used by the Edge Function trigger.
  - `document_url` (text): Public URL to access the file in storage.
  - `uploaded_at` (timestamp): Timestamp of the record insertion.
  - `uploaded_by` (uuid): Foreign key to `auth.users`.

**3. Editor Configuration**

- **`.vscode/settings.json`:** Created to help VS Code recognize the Deno runtime environment for the Edge Function, enabling proper linting and type checking for Deno-specific APIs and URL imports within `index.ts`.

---
