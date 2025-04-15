'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@/types_db';
import { ForgotPasswordModal } from '@/components/ForgotPasswordModal';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { useAuth } from '@/contexts/AuthContext';
import Image from 'next/image';

// Ensure necessary env vars are available client-side
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase URL or Anon Key for login page client');
  // Handle error appropriately, maybe show an error message to the user
}

export default function Login() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const supabase = createBrowserClient<Database>(supabaseUrl!, supabaseAnonKey!);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [emailForPasswordReset, setEmailForPasswordReset] = useState('');
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetSuccess, setResetSuccess] = useState(false);

  const handlePasswordResetRequest = useCallback(async () => {
    setResetError(null);
    setResetSuccess(false);
    setIsModalOpen(true);
  }, []);

  const handleModalSubmit = async (email: string) => {
    if (!email) {
      setResetError('Please enter your email address.');
      return;
    }
    setEmailForPasswordReset(email);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/update-password`,
      });
      if (error) {
        console.error("Password reset error:", error);
        setResetError(error.message);
      } else {
        setResetSuccess(true);
      }
    } catch (error) {
      console.error("Password reset exception:", error);
      setResetError('An unexpected error occurred.');
    }
  };

  useEffect(() => {
    if (user) {
      router.replace('/dashboard');
    }
  }, [user, router]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-foreground"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted/50 px-4 py-12">
      <div className="w-full max-w-md p-8 bg-card rounded-xl shadow-lg space-y-6">
        <div className="text-center">
            <Image src="/file.svg" alt="App Logo" width={50} height={50} className="mx-auto mb-4" />
            <h1 className="text-2xl font-semibold text-foreground">Welcome Back</h1>
            <p className="text-muted-foreground text-sm mt-1">Sign in to access your dashboard.</p>
        </div>
        
        <Auth
          supabaseClient={supabase}
          appearance={{ theme: ThemeSupa }}
          theme="dark"
          providers={['google']}
          redirectTo={`${window.location.origin}/auth/callback`}
          localization={{
            variables: {
              sign_in: {
                email_label: 'Email address',
                password_label: 'Password',
                button_label: 'Sign in',
                social_provider_text: 'Sign in with {{provider}}',
                link_text: 'Already have an account? Sign in',
                forgotten_password_link_text: 'Forgot your password?'
              },
              sign_up: {
                 email_label: 'Email address',
                 password_label: 'Create a Password',
                 button_label: 'Sign up',
                 social_provider_text: 'Sign up with {{provider}}',
                 link_text: "Don't have an account? Sign up"
              },
              forgotten_password: {
                 email_label: "Email address",
                 button_label: "Send reset instructions",
                 link_text: "Remembered your password? Sign in"
               },
               update_password: {
                 password_label: "New password",
                 password_confirmation_label: "Confirm new password",
                 button_label: "Update password"
               }
            }
          }}
        />
        
        <div className="text-center mt-4">
            <button 
                onClick={handlePasswordResetRequest} 
                className="text-sm text-primary hover:underline">
                Forgot your password?
            </button>
         </div>

        <ForgotPasswordModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setResetError(null);
            setResetSuccess(false);
            setEmailForPasswordReset('');
          }}
          onSubmit={handleModalSubmit}
          initialEmail={emailForPasswordReset}
          error={resetError}
          success={resetSuccess}
        />

      </div>
    </div>
  );
}
