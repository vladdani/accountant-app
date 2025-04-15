import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

// Supabase environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable.');
}

export async function createClient() {
  // Make sure to await the cookies() call
  const cookieStore = await cookies();

  return createServerClient(
    supabaseUrl!,
    supabaseAnonKey!,
    {
      cookies: {
        get(name: string) {
          // Correctly use the awaited cookieStore
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            // Correctly use the awaited cookieStore
            cookieStore.set({ name, value, ...options });
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          } catch (_) {
            // Ignore errors when cookie cannot be set
            // This can happen in Server Components that don't have response headers
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            // Correctly use the awaited cookieStore
            cookieStore.set({ name, value: '', ...options });
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          } catch (_) {
            // Ignore errors when cookie cannot be removed
            // This can happen in Server Components that don't have response headers
          }
        },
      },
    }
  );
} 