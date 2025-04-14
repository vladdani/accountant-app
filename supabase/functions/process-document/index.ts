// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts"

console.log("Hello from Functions!")

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from 'https://esm.sh/@google/generative-ai'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs' // Use legacy build for wider compatibility
import * as pdfjsWorker from 'pdfjs-dist/legacy/build/pdf.worker.mjs'
import { encode } from 'https://deno.land/std/encoding/base64.ts' // Import Deno standard Base64 encoder

// Required workaround for pdfjs-dist in non-browser environments like Deno
// See: https://github.com/mozilla/pdf.js/issues/16110
// @ts-expect-error This assignment is necessary as 'self.window' might not exist
self.window = self;
// @ts-expect-error This assignment is necessary as 'self.pdfjsWorker' might not exist
self.pdfjsWorker = pdfjsWorker;

// --- Environment Variables ---
// Ensure these are set in your Supabase project settings -> Functions -> process-document
// NOTE: Use names without the SUPABASE_ prefix in the dashboard UI.
const supabaseUrl = Deno.env.get('PROJECT_URL') // Renamed from SUPABASE_URL
const supabaseServiceRoleKey = Deno.env.get('SERVICE_ROLE_KEY') // Renamed from SUPABASE_SERVICE_ROLE_KEY
const geminiApiKey = Deno.env.get('GEMINI_API_KEY')

if (!supabaseUrl || !supabaseServiceRoleKey || !geminiApiKey) {
  console.error('FATAL: Missing environment variables (PROJECT_URL, SERVICE_ROLE_KEY, GEMINI_API_KEY)')
  // Throw an error to prevent the function from running incorrectly
  throw new Error('Missing critical environment variables.')
}

// --- Initialize Clients ---
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})
const genAI = new GoogleGenerativeAI(geminiApiKey)

// --- Gemini Configuration ---
// Using flash-lite for cost efficiency and low latency
const extractionModel = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-lite' }) // Use flash-lite for both text & vision
// const geminiModelText = genAI.getGenerativeModel({ model: 'gemini-1.0-pro' }) // Removed - consolidating to flash
const embeddingModel = genAI.getGenerativeModel({ model: 'text-embedding-004' })

const generationConfig = {
  temperature: 0.3, // Lower temp for more deterministic extraction
  topK: 1,
  topP: 1,
  maxOutputTokens: 4096, // Reduced from 8192, adjust based on expected output size
}

const safetySettings = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
]

// --- Helper: Function to extract data using Gemini ---
// Removed isTextOnly parameter as we now always use the same flash model
async function extractDataWithGemini(content: string | { inlineData: { mimeType: string; data: string } }[]) {
  // const model = isTextOnly ? geminiModelText : geminiModelVision // Removed - use extractionModel directly
  const prompt = `Analyze the following document content (which could be text extracted from a PDF or an image) and extract the specified information in JSON format. The document is likely related to accounting or business agreements in Indonesia. Use English for keys and standard classifications.

  **Standard Fields (Extract for all document types where applicable):**
  1.  **Transaction Date (date):** Format as YYYY-MM-DD. If ambiguous, use the latest possible date shown. If no date found, use null.
  2.  **Due Date (due_date):** If a payment due date is explicitly mentioned, format as YYYY-MM-DD. Otherwise, use null.
  3.  **Total Amount (amount):** Numeric value only, highest total amount shown if multiple. Remove currency symbols or commas. If no amount found, use null.
  4.  **Currency (currency):** 3-letter ISO currency code (e.g., 'IDR', 'USD'). If not explicitly mentioned but an amount is present, assume 'IDR'. Otherwise, use null.
  5.  **Supplier/Vendor/Store Name (supplier):** Name of the entity issuing the document or receiving payment. If none found, use null.
  6.  **Invoice/Order/Document Number (document_number):** The primary identification number for the document (invoice, order, receipt, etc.). If none found, use null.
  7.  **Primary Item/Service Description (item):** A brief description (max 10 words) of the main item, service, or overall purpose if line items aren't applicable/extracted. If none found, use null.
  8.  **Line Items (line_items):** If the document lists individual items/services, extract them as an array of JSON objects. Each object should have keys: "description" (string), "quantity" (number, default 1 if not specified), "unit_price" (number), "total_amount" (number). If line items are not present or cannot be reliably extracted, use null for the main 'line_items' key.
  9.  **Document Type (type):** Carefully classify the document based on its content and common Indonesian accounting terms. Respond with ONLY ONE of the following exact lowercase strings: 'invoice', 'receipt', 'order_form', 'tax_invoice', 'agreement', 'statement', 'delivery_note', 'payslip', or 'other'.
      *   **'invoice':** Use if the document mentions 'Faktur Penjualan', 'Invoice', 'Tagihan', 'Proforma Invoice', 'Bill To', or clearly lists services/goods with amounts due.
      *   **'receipt':** Use if the document mentions 'Kwitansi', 'Official Receipt', 'Bukti Pembayaran', 'Payment Received', 'Tanda Terima', or confirms payment has been made.
      *   **'order_form':** Use for 'Purchase Order', 'Sales Order', 'Order Form', 'Pesanan Pembelian'.
      *   **'tax_invoice':** Use specifically for 'Faktur Pajak'.
      *   **'agreement':** Use for 'Surat Perjanjian', 'Kontrak', 'Memorandum of Understanding (MoU)', 'Lease Agreement', 'Service Level Agreement (SLA)'.
      *   **'statement':** Use for 'Bank Statement', 'Account Statement', 'Rekening Koran'.
      *   **'delivery_note':** Use for 'Surat Jalan', 'Delivery Order', 'Packing Slip'.
      *   **'payslip':** Use for 'Slip Gaji', 'Pay Stub', 'Salary Slip'.
      *   **'other':** Use ONLY if the document clearly does not fit any of the above categories based on keywords and context. Do not default to 'other' if unsure; try to make the best classification possible.

  **Agreement-Specific Fields (Extract ONLY IF type is 'agreement'):**
  10. **Parties Involved (agreement_parties):** An array of strings listing the main parties named in the agreement (e.g., ["PT ABC", "PT XYZ"]). If not applicable or not found, use null.
  11. **Subject/Purpose (agreement_subject):** A brief text summary (max 20 words) of what the agreement is about. If not applicable or not found, use null.
  12. **Payment Terms (agreement_payment_terms):** A brief text summary of payment amounts, schedule, or conditions mentioned in the agreement. If not applicable or not found, use null.

  **Response Format:**
  Respond ONLY with a single, valid JSON object containing ALL the keys listed below (1-12). Use null for any field that is not found in the document or not applicable based on the document type.

  {
    "date": "YYYY-MM-DD" | null,
    "due_date": "YYYY-MM-DD" | null,
    "amount": number | null,
    "currency": "IDR" | "USD" | ... | null,
    "supplier": string | null,
    "document_number": string | null,
    "item": string | null,
    "line_items": [ { "description": string, "quantity": number, "unit_price": number, "total_amount": number } ] | null,
    "type": "invoice" | "receipt" | "order_form" | "tax_invoice" | "agreement" | "statement" | "delivery_note" | "payslip" | "other",
    "agreement_parties": [ string ] | null,
    "agreement_subject": string | null,
    "agreement_payment_terms": string | null
  }

  Document Content to analyze:
  --- START CONTENT --- 
  `;

  const parts = [
    { text: prompt },
    // Add the actual content (text or image part)
    ...(typeof content === 'string' ? [{ text: content }] : content),
    { text: "--- END CONTENT --- " },
  ]

  console.log(`Calling Gemini model: gemini-2.0-flash-lite`) // Log the specific model
  try {
    const result = await extractionModel.generateContent({ // Use extractionModel here
      contents: [{ role: 'user', parts }],
      generationConfig,
      safetySettings,
    })

    const response = result.response
    let jsonString = response.text().trim()
    console.log("Gemini Raw Response Text:", jsonString)

    // Attempt to extract JSON even if embedded in other text or markdown
    const jsonMatch = jsonString.match(/\{.*\}/s) // Find first occurrence of { ... } potentially spanning lines
    if (!jsonMatch) {
      throw new Error("Gemini response did not contain valid JSON structure.")
    }
    jsonString = jsonMatch[0]

    console.log("Extracted JSON String:", jsonString)
    const extracted = JSON.parse(jsonString)

    // --- Data Cleaning & Validation ---
    let finalAmount: number | null = null
    if (extracted.amount !== null && extracted.amount !== undefined) {
      // Remove potential currency symbols, commas, spaces before parsing
      const amountString = String(extracted.amount).replace(/[Rp.,\\s]/g, '')
      const parsedAmount = parseFloat(amountString)
      if (!isNaN(parsedAmount)) {
        finalAmount = parsedAmount
      }
    }
    extracted.amount = finalAmount

    let finalDate: string | null = null
    if (extracted.date && typeof extracted.date === 'string') {
      // Basic validation for YYYY-MM-DD format
      if (/^\d{4}-\d{2}-\d{2}$/.test(extracted.date)) {
        // Further check if it's a plausible date (e.g., month 1-12, day 1-31)
        try {
          const [year, month, day] = extracted.date.split('-').map(Number)
          if (month >= 1 && month <= 12 && day >= 1 && day <= 31) { // Basic plausibility
            // Check if it parses correctly with Date object (handles leap years etc.)
            const d = new Date(extracted.date + 'T00:00:00Z') // Use UTC to avoid timezone issues
            if (d.getUTCFullYear() === year && d.getUTCMonth() === month - 1 && d.getUTCDate() === day) {
              finalDate = extracted.date
            }
          }
        } catch { /* ignore parsing errors */ }
      }
      // TODO: Add more robust date parsing for common formats if needed (e.g., DD/MM/YYYY)
    }
    extracted.date = finalDate

    // Ensure type is one of the allowed values
    const allowedTypes = ['invoice', 'receipt', 'order_form', 'tax_invoice', 'agreement', 'statement', 'delivery_note', 'payslip', 'other'];
    if (!allowedTypes.includes(extracted.type)) {
      console.warn(`Extracted type "${extracted.type}" not in allowed list, defaulting to 'other'.`);
      extracted.type = 'other';
    }

    // Trim string fields
    extracted.supplier = typeof extracted.supplier === 'string' ? extracted.supplier.trim() || null : null
    extracted.item = typeof extracted.item === 'string' ? extracted.item.trim() || null : null

    console.log("Cleaned Extracted Data:", extracted)
    return extracted

  } catch (error) {
    console.error("Error during Gemini extraction or parsing:", error)
    // Return default structure on error
    return { date: null, amount: null, supplier: null, item: null, type: 'other' }
  }
}

// --- Helper: Function to generate embedding ---
async function generateEmbedding(text: string) {
  console.log(`Generating embedding for text (length: ${text.length})...`)
  if (!text) return null
  try {
    // Check model limits if necessary - text-embedding-004 often handles large inputs
    const truncatedText = text.substring(0, 30000) // Generous limit, adjust if needed
    const result = await embeddingModel.embedContent(truncatedText)
    const embedding = result.embedding
    console.log(`Embedding generated successfully (size: ${embedding.values.length})`)
    return embedding.values // Return the array of numbers
  } catch (error) {
    console.error("Error generating embedding:", error)
    return null // Handle embedding failure
  }
}

// --- Main Function Handler ---
serve(async (req: Request) => {
  console.log("--- process-document function invoked ---")
  // 1. Validate request (ensure it's a POST from Supabase trigger)
  if (req.method !== 'POST') {
    console.warn("Received non-POST request, ignoring.")
    return new Response('Method Not Allowed', { status: 405 })
  }

  let record
  let filePath: string
  try {
    const payload = await req.json()
    // Payload structure for *DATABASE* trigger on 'documents' table insert event
    // We check for file_path instead of name/bucket_id now.
    if (payload.type !== 'INSERT' || payload.table !== 'documents' || !payload.record || !payload.record.file_path) {
      console.warn("Invalid payload structure, type, table, or missing file_path:", payload)
      return new Response("Invalid payload: Requires INSERT on 'documents' table with 'file_path'", { status: 400 })
    }
    record = payload.record
    filePath = record.file_path // Use file_path from the database record
    // No longer need bucket_id check as the trigger is specific to the documents table

  } catch (e) {
    console.error("Failed to parse request body:", e)
    return new Response("Bad Request", { status: 400 })
  }

  console.log(`Processing file: ${filePath}`)

  try {
    // 2. Download file from Storage
    console.log(`Downloading file: ${filePath}`)
    const { data: fileData, error: downloadError } = await supabaseAdmin.storage
      .from('documents')
      .download(filePath)

    if (downloadError || !fileData) {
      console.error(`Error downloading file ${filePath}:`, downloadError)
      throw new Error(`Failed to download file: ${downloadError?.message || 'Unknown download error'}`)
    }
    console.log("File downloaded successfully.")

    const fileBuffer = await fileData.arrayBuffer()
    const fileExtension = filePath.split('.').pop()?.toLowerCase()

    let extractedText = ''
    let extractedData = null
    let requiresTextExtraction = false

    // 3. Extract Content based on file type
    if (fileExtension === 'pdf') {
      console.log(`Attempting PDF parse with pdfjs-dist for: ${filePath}`)
      try {
        const pdfDoc = await getDocument({ data: fileBuffer }).promise;
        console.log(`PDF loaded with ${pdfDoc.numPages} pages.`);
        let textContent = '';
        for (let i = 1; i <= pdfDoc.numPages; i++) {
          const page = await pdfDoc.getPage(i);
          const textContentItems = await page.getTextContent();
          textContent += textContentItems.items.map((item) => item.str).join(' ');
          // Add a space between pages if desired, though Gemini might handle it
          textContent += '\n';
          page.cleanup(); // Release page resources
        }
        extractedText = textContent.trim();
        console.log(`Extracted text from PDF (length: ${extractedText.length}).`);
        requiresTextExtraction = true; // We got text, so Gemini can use it
      } catch (pdfError) {
        console.error(`Error parsing PDF ${filePath} with pdfjs-dist:`, pdfError);
        // Proceed without text if PDF parsing fails
      }
    } else if (['jpg', 'jpeg', 'png', 'heic', 'heif', 'webp'].includes(fileExtension!)) {
      console.log(`Attempting Image processing for: ${filePath}`)
      const mimeTypeMap: { [key: string]: string } = {
        'jpg': 'image/jpeg', 'jpeg': 'image/jpeg', 'png': 'image/png',
        'heic': 'image/heic', 'heif': 'image/heif', 'webp': 'image/webp',
      }
      const mimeType = mimeTypeMap[fileExtension!]
      if (mimeType) {
        // Use Deno's standard library Base64 encoder - safer for large files
        const base64Data = encode(fileBuffer);
        const imagePart = { inlineData: { mimeType: mimeType, data: base64Data } };
        extractedData = await extractDataWithGemini([imagePart]); // Use Vision model
        // Use extracted fields for embedding text for images
        extractedText = `Document type: ${extractedData?.type}. Supplier: ${extractedData?.supplier}. Amount: ${extractedData?.amount}. Date: ${extractedData?.date}. Item: ${extractedData?.item}.`
        console.log(`Extracted data from Image ${filePath} using Vision.`)
      } else {
        console.warn(`Unsupported image mime type derived from extension: ${fileExtension}`)
        extractedText = 'Unsupported image format.'
      }
    } else if (['csv', 'xls', 'xlsx'].includes(fileExtension!)) {
      console.log(`Handling spreadsheet: ${filePath}`)
      // MVP: Just classify type, skip complex extraction/embedding
      extractedData = { type: 'spreadsheet', date: null, amount: null, supplier: null, item: null }
      extractedText = 'Spreadsheet document.' // Simple text for embedding
    } else {
      console.warn(`Unsupported file type for extraction: ${fileExtension}`)
      extractedText = 'Unsupported document format.' // Default text
    }

    // If text was extracted (e.g., from PDF) but data wasn't (e.g., image failed), run text extraction
    if (requiresTextExtraction && !extractedData) {
      console.log(`Running text extraction for ${filePath}...`)
      if (extractedText && extractedText !== 'Error processing PDF content.') {
        extractedData = await extractDataWithGemini(extractedText) // Call without isTextOnly flag
      } else {
        console.warn(`No valid text extracted from ${filePath} to send to Gemini text model.`)
        extractedData = { type: 'other', date: null, amount: null, supplier: null, item: null } // Fallback
      }
    }

    // Ensure extractedData has a default structure if still null
    extractedData = extractedData || { type: 'other', date: null, amount: null, supplier: null, item: null }

    // 4. Generate Embedding (use extracted text)
    const embeddingValues = await generateEmbedding(extractedText)
    if (!embeddingValues) {
      console.warn(`Could not generate embedding for ${filePath}`)
      // Proceed without embedding? Or throw error?
    }

    // 5. Update Database Record
    console.log(`Attempting to update DB record for file_path: ${filePath}`)
    const { error: updateError } = await supabaseAdmin
      .from('documents')
      .update({
        extracted_data: extractedData,
        embedding: embeddingValues, // Store the generated embedding vector
        type: extractedData.type || 'other', // Update type based on extraction
      })
      .eq('file_path', filePath) // Find the record using the unique file_path

    if (updateError) {
      console.error(`Error updating document record for ${filePath}:`, updateError)
      // Don't throw here, just log, as function might be retried
      return new Response(JSON.stringify({ success: false, error: `Failed to update database: ${updateError.message}` }), {
        headers: { 'Content-Type': 'application/json' },
        status: 500, // Indicate server error
      })
    }

    console.log(`Successfully processed and updated record for: ${filePath}`)
    return new Response(JSON.stringify({ success: true, message: `Processed ${filePath}` }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error: unknown) {
    console.error(`Unhandled error processing file ${filePath}:`, error)
    // Optional: Update DB record with error status?
    // Return a generic error message to avoid potential serialization issues with the caught error object
    return new Response(JSON.stringify({ success: false, error: 'An unexpected error occurred during processing.' }), {
      headers: { 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})

/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/process-document' \
    --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
    --header 'Content-Type: application/json' \
    --data '{"name":"Functions"}'

*/
