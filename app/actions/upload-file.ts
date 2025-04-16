'use server';

// Re-enable Supabase SSR and cookies
import { createClient } from '@supabase/supabase-js';
import { createClient as createServerClientFromUtils } from '@/utils/supabase/server';
import { GoogleGenerativeAI, Part } from '@google/generative-ai';
import { v4 as uuidv4 } from 'uuid';
import { webcrypto as crypto } from 'node:crypto';

// Helper function to convert ArrayBuffer to hex string
function bufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// Helper function to convert ArrayBuffer to base64
function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Define the structure of the result
interface UploadResult {
  success: boolean;
  url?: string;
  filePath?: string; 
  dbRecordId?: string; 
  error?: string;
  duplicateOf?: { id: string; name: string | null };
}

interface AiExtractionResult { // Define expected AI response structure
  vendor: string | null;
  date: string | null;
  type: string | null;
  amount: number | null;
  currency: string | null;
  description: string | null;
  discount: number | null;
}

// Environment variable checks remain the same
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; // <<< Need Anon key for user client
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const googleApiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey || !googleApiKey) { // <<< Add Anon key check
    throw new Error("Supabase URL/Anon Key/Service Key or Google API Key not defined.");
}

// ---+++ Initialize OFFICIAL Google AI Client +++---
const genAI = new GoogleGenerativeAI(googleApiKey);
const extractionModel = genAI.getGenerativeModel({
    model: "gemini-1.5-flash-latest", 
    // Optional: Safety settings are commented out, so imports were removed
    // safetySettings: [ { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE } ] 
});
// ---+++++++++++++++++++++++++++++++++++++++++++---

export async function uploadFile(formData: FormData): Promise<UploadResult> {
  console.log("--- Running Full uploadFile Action --- ");
  const startTime = Date.now(); // Record start time

  // <<< Create Supabase client for Server Actions using @supabase/ssr >>>
  const supabaseUserClient = await createServerClientFromUtils();

  // Admin client remains the same
  const supabaseAdmin = createClient(supabaseUrl!, supabaseServiceRoleKey!, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  // --- RESTORE AUTHENTICATION --- 
  // 1. Get user session
  const { data: { user }, error: authError } = await supabaseUserClient.auth.getUser();
  if (authError || !user) {
    console.error('Auth error in uploadFile:', authError);
    return { success: false, error: `User not authenticated: ${authError?.message || 'No user found'}` };
  }
  // Add specific log for the retrieved user ID
  console.log("--- uploadFile Action: User ID retrieved from getUser():", user.id);
  console.log("User authenticated:", user.id);
  // --- END AUTH RESTORE ---

  // 2. Get file from FormData
  const file = formData.get('file') as File | null;
  if (!file) {
    return { success: false, error: 'No file provided' };
  }

  let fileBuffer: ArrayBuffer;
  let fileHashHex: string;
  let dbRecordId: string | null = null; // Variable to hold the ID

  try {
    // 3. Read file content and calculate hash
    console.log(`Reading file: ${file.name} (Size: ${file.size} bytes)`);
    fileBuffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', fileBuffer);
    fileHashHex = bufferToHex(hashBuffer);
    console.log(`Calculated SHA-256 Hash: ${fileHashHex}`);

    // 4. Check for duplicate hash for this user
    console.log(`Checking for duplicate hash for user ${user.id}`);
    const { data: existingDoc, error: duplicateCheckError } = await supabaseAdmin
      .from('documents')
      .select('id, original_filename') // Select minimal data
      .eq('uploaded_by', user.id)
      .eq('content_hash', fileHashHex)
      .maybeSingle(); // Use maybeSingle to handle 0 or 1 result without error

    if (duplicateCheckError) {
      console.error('Error checking for duplicates:', duplicateCheckError);
      throw new Error(`Database error during duplicate check: ${duplicateCheckError.message}`);
    }

    if (existingDoc) {
      console.warn(`Duplicate detected! Existing doc ID: ${existingDoc.id}, Filename: ${existingDoc.original_filename}`);
      return {
        success: false,
        duplicateOf: { 
          id: existingDoc.id, 
          name: existingDoc.original_filename 
        } 
      };
    }
    console.log("No duplicate found. Proceeding with upload.");

  } catch (hashOrCheckError) {
    console.error('Error during hashing or duplicate check:', hashOrCheckError);
    const errorMessage = hashOrCheckError instanceof Error ? hashOrCheckError.message : 'Failed to process file before upload.';
    return { success: false, error: errorMessage };
  }

  // 5. Construct unique file path (using test user ID)
  const fileExtension = file.name.split('.').pop();
  const fileName = `${uuidv4()}.${fileExtension}`;
  const currentDate = new Date();
  const year = currentDate.getFullYear();
  const month = (currentDate.getMonth() + 1).toString().padStart(2, '0');
  const filePath = `${user.id}/${year}/${month}/${fileName}`;

  let publicUrl: string | null = null;

  try {
    // 6. Upload file to Supabase Storage using Admin client
    console.log(`Attempting to upload to path: ${filePath}`);
    // Use the fileBuffer we already read for hashing
    const { error: uploadError } = await supabaseAdmin.storage 
      .from('documents')
      .upload(filePath, fileBuffer, { // Upload the buffer directly
        cacheControl: '3600',
        upsert: false,
        contentType: file.type // Pass content type for storage
      });

    if (uploadError) {
      console.error('Supabase upload error:', uploadError);
      throw new Error(uploadError.message);
    }
    console.log("Upload to storage successful.");

    // 7. Get public URL using Admin client (assuming bucket is public)
    const { data: urlData } = supabaseAdmin.storage
      .from('documents')
      .getPublicUrl(filePath);

    if (!urlData?.publicUrl) {
      console.warn('Could not get public URL for:', filePath);
    } else {
      publicUrl = urlData.publicUrl;
    }

    // 8. Insert initial record into documents table using Admin client
    console.log("Attempting to insert DB record.");
    const { data: dbData, error: dbError } = await supabaseAdmin
      .from('documents')
      .insert({
        uploaded_by: user.id,
        document_url: publicUrl,
        file_path: filePath,
        original_filename: file.name, 
        content_hash: fileHashHex,
        // Initialize new fields as NULL initially
        vendor: null,
        document_date: null,
        document_type: null,
        total_amount: null,
        currency: null,
        description: null,
        discount: null
      })
      .select('id') 
      .single();
        
    if (dbError) {
      console.error('Database insert error:', dbError);
      // Attempt to clean up the orphaned storage file
      await supabaseAdmin.storage.from('documents').remove([filePath]).catch(console.error);
      throw new Error('Failed to create document record after upload.');
    }
    dbRecordId = dbData?.id;
    console.log("DB record inserted successfully. ID:", dbRecordId);

    // ---+++ NEW: AI Extraction Step +++---
    if (dbRecordId) {
      console.log(`Starting AI extraction for document ID: ${dbRecordId}`);
      try {
        // Updated Prompt to consider filename
        const extractionPrompt = `You are an expert accountant assistant. Analyze the content of the provided file (image or PDF). Also consider the filename for context. Extract the following fields:\n        - vendor (string): The name of the vendor/supplier/seller.\n        - date (string): The primary date on the document (e.g., invoice date, receipt date) in YYYY-MM-DD format.\n        - type (string): Classify the document type (e.g., 'invoice', 'receipt', 'agreement', 'bank_statement', 'quote', 'other'). Use the filename as a hint if it contains relevant keywords like 'invoice', 'quote', 'receipt', 'agreement', etc.\n        - amount (number): The main total amount. Extract only the numeric value, removing any currency symbols or thousand separators.\n        - currency (string): The 3-letter currency code (e.g., 'IDR', 'USD', 'EUR') associated with the total amount. If no currency symbol/code is found, try to infer based on context or vendor location if possible, otherwise use null.\n        - description (string): A brief summary of the document content or a list of main items/services (e.g., 'Purchase of office supplies', 'Monthly software subscription', 'Consulting services agreement'). Use null if no clear description is found.\n        - discount (number): Any discount amount applied to the total. Extract only the numeric value. Use null if no discount is mentioned.\n\n        Return the result ONLY as a valid JSON object with these exact keys: "vendor", "date", "type", "amount", "currency", "description", "discount".\n        If a field cannot be determined, use a JSON null value for that key. Do not include any explanation or surrounding text. Ensure 'amount' and 'discount' are numbers, not strings.`;

        // Prepare parts for the official SDK
        const textPart: Part = { text: extractionPrompt };
        const imagePart: Part = {
            inlineData: {
                data: bufferToBase64(fileBuffer), // Use base64 helper
                mimeType: file.type,
            },
        };
        // Add filename as a text part? No, include instruction in main prompt.

        // Call official SDK's generateContent
        const result = await extractionModel.generateContent({
            contents: [{ role: "user", parts: [textPart, imagePart] }],
            // generationConfig: { responseMimeType: "application/json" } 
        });

        const response = result.response;
        // Check for blocked responses
        if (!response || !response.candidates || response.candidates.length === 0 || !response.candidates[0].content) {
             const blockReason = response?.promptFeedback?.blockReason;
             const safetyRatings = response?.promptFeedback?.safetyRatings ?? [];
             console.error(`AI response blocked or empty for doc ${dbRecordId}. Reason: ${blockReason}. Ratings: ${JSON.stringify(safetyRatings)}`);
             throw new Error(`AI processing failed. Reason: ${blockReason || 'Empty response'}`);
        }

        const extractedJsonString = response.text(); // Get text response
        console.log("AI Extraction Raw Response:", extractedJsonString);

        // Parse the JSON response safely, typed with AiExtractionResult
        let extractedData: AiExtractionResult | null = null;
        try {
            // Attempt to extract JSON object using match
            // Replace the 's' flag (which requires ES2018) with a more compatible approach
            // that still matches across multiple lines
            const match = extractedJsonString.match(/\{[\s\S]*\}/); // [\s\S] matches any character including newlines
            if (match && match[0]) {
                const jsonObjectString = match[0];
                const parsed = JSON.parse(jsonObjectString); // Parse only the matched object
                if (typeof parsed === 'object' && parsed !== null) {
                    extractedData = parsed as AiExtractionResult;
                } else {
                    console.error(`Parsed JSON is not an object for doc ${dbRecordId}. Extracted string:`, jsonObjectString);
                }
            } else {
                console.error(`Could not find JSON object within AI response for doc ${dbRecordId}. Raw Response:`, extractedJsonString);
            }
        } catch (parseError) { 
            console.error(`Failed to parse extracted JSON from AI for doc ${dbRecordId}:`, parseError, "\nRaw Response:", extractedJsonString);
        }

        // Validate and prepare data for DB update, using Partial for type safety
        // Use correct DB column names
        const updatePayload: Partial<{ 
          vendor: string | null; 
          document_date: string | null; 
          document_type: string | null; 
          total_amount: number | null; 
          currency: string | null; 
          description: string | null;
          discount: number | null;
        }> = {};
        if (extractedData) {
            if (extractedData.vendor) updatePayload.vendor = extractedData.vendor;
            if (extractedData.date && typeof extractedData.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(extractedData.date)) {
                updatePayload.document_date = extractedData.date;
            } else if(extractedData.date) {
                console.warn(`Invalid date format from AI for doc ${dbRecordId}: ${extractedData.date}`);
            }

            if (extractedData.type) updatePayload.document_type = extractedData.type;
            
            let parsedAmount: number | null = null;
            if (extractedData.amount !== null && extractedData.amount !== undefined) {
                if(typeof extractedData.amount === 'number' && !isNaN(extractedData.amount)) {
                    parsedAmount = extractedData.amount;
                } else if (typeof extractedData.amount === 'string') {
                    const num = parseFloat(String(extractedData.amount).replace(/[^0-9.-]+/g,""));
                    if (!isNaN(num)) parsedAmount = num;
                }
            }
            if(parsedAmount !== null) {
                updatePayload.total_amount = parsedAmount;
            } else if (extractedData.amount !== null && extractedData.amount !== undefined) {
                 console.warn(`Could not parse amount from AI for doc ${dbRecordId}: ${extractedData.amount}`);
            }

            if (extractedData.currency && typeof extractedData.currency === 'string' && extractedData.currency.length > 0) {
                updatePayload.currency = extractedData.currency.toUpperCase();
            } else if (extractedData.currency !== null && extractedData.currency !== undefined) {
                 console.warn(`Invalid currency from AI for doc ${dbRecordId}: ${extractedData.currency}`);
            }

            if (extractedData.description) updatePayload.description = extractedData.description;

            let parsedDiscount: number | null = null;
            if (extractedData.discount !== null && extractedData.discount !== undefined) {
                if(typeof extractedData.discount === 'number' && !isNaN(extractedData.discount)) {
                    parsedDiscount = extractedData.discount;
                } else if (typeof extractedData.discount === 'string') {
                    const num = parseFloat(String(extractedData.discount).replace(/[^0-9.-]+/g,""));
                    if (!isNaN(num)) parsedDiscount = num;
                }
            }
             if(parsedDiscount !== null) {
                updatePayload.discount = parsedDiscount;
            } else if (extractedData.discount !== null && extractedData.discount !== undefined) {
                 console.warn(`Could not parse discount from AI for doc ${dbRecordId}: ${extractedData.discount}`);
            }
        }

        // Update the database record if we have valid data
        if (Object.keys(updatePayload).length > 0) {
          console.log(`Updating DB record ${dbRecordId} with extracted data:`, updatePayload);
          const { error: updateError } = await supabaseAdmin
            .from('documents')
            .update(updatePayload)
            .eq('id', dbRecordId);

          if (updateError) {
            console.error(`Failed to update document ${dbRecordId} with extracted data:`, updateError);
          } else {
            console.log(`Successfully updated document ${dbRecordId} with AI data.`);
          }
        } else {
             console.log(`No valid data extracted/parsed for doc ${dbRecordId}. Skipping update.`);
        }

      } catch (aiError) {
        console.error(`Error during AI extraction for document ${dbRecordId}:`, aiError);
        // Decide if you want to update processing time even if AI fails
        // For now, we proceed to update time regardless.
      }
      
      // --- Calculate and Store Processing Time ---
      const endTime = Date.now();
      const processingTimeMs = endTime - startTime;
      console.log(`Document ${dbRecordId} processing time: ${processingTimeMs} ms`);
      
      const { error: timeUpdateError } = await supabaseAdmin
        .from('documents')
        .update({ processing_time_ms: processingTimeMs })
        .eq('id', dbRecordId);
        
      if (timeUpdateError) {
           console.error(`Failed to update processing time for doc ${dbRecordId}:`, timeUpdateError);
           // Non-critical error, maybe log to monitoring service
      } else {
           console.log(`Successfully updated processing time for doc ${dbRecordId}.`);
      }
      // ------------------------------------------
      
    } else {
       console.warn("No DB record ID, skipping AI extraction and time update.");
    }
    // ---+++ End AI Extraction Step +++---

    // Return success based on upload, not extraction
    return { success: true, url: publicUrl ?? undefined, filePath: filePath, dbRecordId: dbRecordId ?? undefined };

  } catch (error) {
    // This catch block now primarily handles errors during storage upload or DB insert
    console.error('Upload action error (post-hash check):', error);
    // Attempt cleanup only if filePath was defined and the error didn't originate
    // from the initial hashing/duplicate check phase (where filePath isn't relevant yet)
    if (filePath && !(error instanceof Error && error.message.includes('duplicate check'))) {
      console.log(`Attempting to remove potentially failed upload: ${filePath}`);
      await supabaseAdmin.storage.from('documents').remove([filePath]).catch(removeError => {
        console.error(`Failed to remove file ${filePath} after error:`, removeError);
      });
    }
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred during upload.';
    return { success: false, error: errorMessage };
  }
}
