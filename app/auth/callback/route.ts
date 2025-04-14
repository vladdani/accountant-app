import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr' 

// Load env vars
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  // if "next" is in param, use it as the redirect URL
  const next = searchParams.get('next') ?? '/'

  if (code) {
    const cookieStore = cookies()

    if (!supabaseUrl || !supabaseAnonKey) {
       // Handle missing env vars - maybe redirect to an error page
       console.error('Missing Supabase config for auth callback');
       return NextResponse.redirect(`${origin}/auth/auth-code-error?error=Configuration%20error`);
    }

    // Use createServerClient from @supabase/ssr configured for Route Handlers
    const supabase = createServerClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
          set(name: string, value: string, options: CookieOptions) {
            cookieStore.set({ name, value, ...options })
          },
          remove(name: string, options: CookieOptions) {
            cookieStore.set({ name, value: '', ...options })
          },
        },
      }
    )
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      // Redirect to the intended destination or dashboard
      return NextResponse.redirect(`${origin}${next}`);
    }
     // Log the specific auth error
     console.error('Supabase code exchange error:', error.message);
  }

  // return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/auth/auth-code-error`);
} 