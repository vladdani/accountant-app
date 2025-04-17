import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  // if "next" is in param, use it as the redirect URL
  const next = searchParams.get('next') ?? '/dashboard'

  if (code) {
    try {
      const supabase = await createClient();
      const { error } = await supabase.auth.exchangeCodeForSession(code)
      if (!error) {
        // Redirect to the intended destination or dashboard
        return NextResponse.redirect(`${origin}${next}`);
      }
      // Log the specific auth error
      console.error('Supabase code exchange error:', error.message);
    } catch (error) {
      console.error('Error in auth callback:', error);
      return NextResponse.redirect(`${origin}/auth/auth-code-error?error=ServerError`);
    }
  }

  // return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/auth/auth-code-error`);
} 