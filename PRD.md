Create a super-simple yet powerful digital document archive for Indonesian accountants and bookkeepers, automating document storage, extraction, organization, and multilingual semantic searching, significantly reducing manual search efforts.

We already have a boilerplate with the core components created. Can you read the documentation and take all the modules from that boilerplate and adapt it to our app so we don't need to code everything from the ground up:
https://github.com/ShenSeanChen/launch-mvp-stripe-nextjs-supabase

🎯 Recommended Approach for us in terms of mobile and desktop:

Responsive Web App (Next.js)
• Perfectly handles desktop interactions (drag-drop files, large screens).
• Good enough on mobile browser (upload via browser from phone gallery).

PLUS

Thin Flutter Mobile App (Android)
• Primarily optimized for WhatsApp workflow (forward/share files directly).
• Native share extension (“share to your app”) for instant file upload.
• Offers ultra-convenient mobile experience for frequent daily use.

This “hybrid” approach gives you maximum efficiency:
• Web App covers desktops and occasional mobile web use (fast dev, low-cost maintenance).
• Flutter App for dedicated mobile convenience and WhatsApp integration.

    Backend & DB:      Supabase (auth/storage/PGVector)

AI Extraction: Google Gemini API via Vertex AI

Frontend:
├── Web/Desktop: Next.js (responsive design)
└── Mobile: Flutter (lightweight, share-to functionality, WhatsApp integration)

• Both frontends connect seamlessly via Supabase backend, so your data/AI extraction logic stays unified.
• Same Supabase auth for web/mobile ensures seamless login across platforms.

    📱 UX Recommendations:

Responsive Web App:
• Minimalistic design (Next.js + Tailwind), clean drag-drop file uploads.
• Large-screen optimized dashboard/search results (desktop usage).
• Chat-style search UI responsive on mobile web (usable if needed).

Mobile Flutter App (Lightweight):
• Primary workflow: Share files/photos directly from WhatsApp or mobile gallery.
• Minimal UI (Upload confirmation, simple chat/search results).
• Instant previews of documents & simple document sharing back to WhatsApp.

⸻

🚀 Cursor AI Instructions (Ready to Paste)

Use the following clear instructions to build an MVP web app named “Digital Archive App”:

⸻

✅ Step 1: Project Initialization

Create a responsive Next.js (App Router) application named "digital-archive-app":

- Use TypeScript.
- Install and configure Tailwind CSS.
- Ensure ESLint and Prettier are set up.

If that module is already created in boilerplate, make sure to use it.

⸻

✅ Step 2: Supabase Integration

- Integrate Supabase with your Next.js app.
- Create a new Supabase project named "digital-archive".
- Install the official Supabase JS library.
- Set up a Supabase client (/lib/supabaseClient.ts).

If that module is already created in boilerplate, make sure to use it.

⸻

✅ Step 3: Authentication Setup (Magic Link + Gmail)

- Configure Supabase Authentication providers:
  - Enable Magic Link (email login).
  - Enable Google OAuth login.
- Create environment variables (.env.local):
  NEXT_PUBLIC_SUPABASE_URL=...
  NEXT_PUBLIC_SUPABASE_ANON_KEY=...
- Implement authentication flow:
  - /auth page for login/signup.
  - Protected routes middleware (users must be authenticated).

If that module is already created in boilerplate, make sure to use it.

⸻

✅ Step 4: File Upload (Drag & Drop)

- Implement a drag-and-drop file upload component (/components/FileUpload.tsx).
- Supported file types: PDF, CSV, XLS, JPG, PNG, HEIC.
- Files uploaded directly to Supabase Storage bucket named "documents".

If that module is already created in boilerplate, make sure to use it.

⸻

✅ Step 5: Google Gemini AI (Vertex AI) for Data Extraction

- Integrate Gemini API for structured data extraction from uploaded files.
- Set GEMINI_API_KEY securely in .env.local.
- Create API route at /api/extract-data:
  - Receives document URL.
  - Calls Gemini API to extract:
    - Transaction Date, Amount, Supplier/Vendor, Item, Document type.
  - Saves extracted data into Supabase table "transactions".

If that module is already created in boilerplate, make sure to use it.

⸻

✅ Step 6: Database Schema (Transactions)

Create Supabase Table: "transactions":

- id (UUID, primary key)
- date (timestamp)
- amount (numeric)
- supplier (text)
- item (text)
- document_url (text)
- type (invoice/receipt/other)
- uploaded_by (user UUID)

You’re right to be concerned. Let’s clearly address these two critical challenges and provide robust solutions that integrate well into your MVP.

⸻

🚩 Critical Challenge #1: Flexible Database Structure

Your documents vary significantly:
• Invoices: date, supplier, invoice number, line items, total amount, tax details.
• Agreements: parties involved, dates (start/end), terms, signatures.
• Receipts: store/vendor, items bought, total amount, payment method.

A rigid, traditional database schema would limit your ability to store this variety effectively. You need a flexible solution.

✅ Recommended Solution: Hybrid Structured + JSONB Approach (Supabase/Postgres)

Use a combination of structured columns for common fields and JSONB for flexible storage:

CREATE TABLE documents (
id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
type TEXT NOT NULL, -- invoice, agreement, receipt, etc.
date DATE, -- common across most docs
supplier TEXT,
document_url TEXT NOT NULL,
extracted_data JSONB, -- Flexible, stores varying fields per doc type
uploaded_at TIMESTAMP DEFAULT now(),
uploaded_by UUID REFERENCES auth.users (id)
);

Why JSONB?
• Flexible: Handles diverse document fields without changing schema.
• Indexable: You can index specific JSONB paths for fast queries.
• Scalable: Easy adaptation to new document types.

Example usage:
• Invoice document

{
"invoice_number": "INV-12345",
"total_amount": 5500000,
"currency": "IDR",
"line_items": [
{ "description": "Air Conditioner", "quantity": 2, "unit_price": 2750000 }
],
"tax_details": { "ppn": "10%", "pph": "2.5%" }
}

    •	Agreement document

{
"parties": ["PT ABC", "PT XYZ"],
"start_date": "2025-01-01",
"end_date": "2025-12-31",
"signatures": ["John Doe", "Jane Doe"]
}

This approach gives you full flexibility, easy maintenance, and powerful querying.

⸻

🚩 Critical Challenge #2: Multilingual Search (English & Indonesian)

Users may query in either English or Indonesian. Your search functionality must handle both effectively and quickly.

✅ Recommended Solution: Multilingual Semantic Search using Embeddings

Implement AI-driven semantic search (vector embeddings) that inherently understands multilingual contexts.

Technical Implementation (Clear steps): 1. Embedding Generation:
• For each uploaded document:
• Extract raw text (via Gemini API).
• Generate multilingual embeddings using Google’s Gemini multilingual models or OpenAI’s multilingual embeddings (text-embedding-3-large, Gemini embedding API). 2. Store embeddings efficiently (PGVector in Supabase):

ALTER TABLE documents ADD COLUMN embedding vector(1536);

    3.	Query Execution Flow:
    •	User inputs query (in Indonesian or English).
    •	Generate embedding of user query.
    •	Execute semantic similarity search on embeddings using PGVector.

Example query (user types either language):

User query (Indonesian): "tampilkan invoice dengan nilai lebih dari 10 juta Januari 2025"
User query (English): "show invoices above 10 million from January 2025"

Supabase vector query example (fast and accurate multilingual search):

SELECT id, type, date, supplier, document_url
FROM documents
ORDER BY embedding <-> '[user_query_embedding]'::vector LIMIT 10;

Why this works effectively:
• Embeddings inherently represent multilingual meaning.
• No explicit language detection or complex NLP pipeline needed.
• Blazing fast queries with vector similarity search in PGVector.

⸻

✅ Step 7: AI-powered Chat Interface (Semantic Search)

Create a simple chat interface (/chat page):

- Users input natural-language queries (in Indonesian).
- Backend API at /api/query-transactions:
  - Uses Gemini API to parse user's query into structured search.
  - Executes Supabase DB queries on structured fields.
  - Returns neat, structured responses (transaction details, totals).
  - Provides clickable document links.

⸻

✅ Step 8: Responsive Document Browsing

- Implement responsive document browsing (/documents page):
  - Recent uploads shown by default.
  - Folder/tree view by Year → Month (expandable/collapsible).
  - Instant PDF viewer for document previews.

⸻

✅ Step 9: Subscription Model & Stripe Integration

- Integrate Stripe subscription payments:
  - Plans: Standard, Professional, Enterprise.
  - Create Stripe products (monthly subscriptions).
  - API route /api/subscribe for subscription management.
  - Billing dashboard link (via Stripe customer portal).

If that module is already created in boilerplate, make sure to use it.

⸻

✅ Step 10: Database Optimization (Fast queries)

Optimize Supabase queries for speed:

- Create multi-column index for quick queries (SQL):
  CREATE INDEX transaction_search_idx ON transactions (date, amount, supplier);
