'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '@/utils/supabase';
import { 
  Session, 
  User, 
  SupabaseClient, 
  AuthTokenResponse 
} from '@supabase/supabase-js';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  supabase: SupabaseClient;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<{
    user: User | null;
    session: Session | null;
  }>;
  signOut: () => Promise<void>;
  signUpWithEmail: (email: string, password: string) => Promise<{ 
    data: { user: User | null } | null; 
    error: Error | null;
  }>;
  updatePassword: (newPassword: string) => Promise<void>;
  updateEmail: (newEmail: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  isSubscriber: boolean;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

interface SubscriptionPayload {
  new: {
    user_id: string;
    [key: string]: any;
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubscriber, setIsSubscriber] = useState(false);

  const checkSubscription = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', userId)
        .in('status', ['active', 'trialing'])
        .order('created_at', { ascending: false })
        .maybeSingle();
      
      if (error) {
        console.error('Subscription check error:', error);
        setIsSubscriber(false);
        return;
      }

      // console.log("AuthContext - subscription data: ", data)

      const isValid = data && 
        ['active', 'trialing'].includes(data.status) && 
        new Date(data.current_period_end) > new Date();
      // console.log("AuthContext -  isValid: ", data)

      setIsSubscriber(!!isValid);
      console.log("AuthContext -  set isSubscriber: ", isSubscriber)
    } catch (error) {
      console.error('Subscription check error:', error);
      setIsSubscriber(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    console.log("AuthContext - mounted useEffect:", mounted);
    
    const initializeAuth = async () => {
      try {
        setIsLoading(true);
        console.log("AuthContext - Starting Try in InitializeAuth!");

        // // First, get initial session
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error || !mounted) {
          setIsLoading(false);
          return;
        }

        // Update initial state
        setSession(session);
        const currentUser = session?.user ?? null;
        setUser(currentUser);

        if (currentUser) {
          await checkSubscription(currentUser.id);
        }
        
        // Then set up listener for future changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
          async (_event, newSession) => {
            if (!mounted) return;
            
            const newUser = newSession?.user ?? null;
            setSession(newSession);
            setUser(newUser);
            
            if (newUser) {
              await checkSubscription(newUser.id);
            } else {
              setIsSubscriber(false);
            }
          }
        );

        // Only set loading to false after everything is initialized
        if (mounted) setIsLoading(false);
        
        return () => {
          mounted = false;
          subscription.unsubscribe();
        };
      } catch (error) {
        console.error("Auth initialization error:", error);
        if (mounted) setIsLoading(false);
      }
    };

    initializeAuth();
  }, [checkSubscription]);

  const value = {
    user,
    session,
    isLoading,
    supabase,
    signInWithGoogle: async () => {
      await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: {
            prompt: 'select_account',
            access_type: 'offline'
          }
        }
      });
    },
    signInWithEmail: async (email: string, password: string) => {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      
      if (authError) throw authError;

      // Check if user was previously soft-deleted
      const { data: profile } = await supabase
        .from('users')
        .select('is_deleted, deleted_at')
        .eq('id', authData.user?.id)
        .single();

      if (profile?.is_deleted) {
        // Reactivate the account
        await supabase
          .from('users')
          .update({ 
            is_deleted: false, 
            deleted_at: null,
            reactivated_at: new Date().toISOString() 
          })
          .eq('id', authData.user?.id);

        // You could trigger a welcome back notification here
      }

      return authData;
    },
    signOut: async () => {
      console.log("Attempting sign out...");
      try {
        // First cleanup all active connections/states
        console.log("Dispatching cleanup event.");
        window.dispatchEvent(new Event('cleanup-before-logout'));
        
        // Wait a small amount of time for cleanup
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Then perform the actual signout
        console.log("Calling supabase.auth.signOut()...");
        const { error: signOutError } = await supabase.auth.signOut({ scope: 'global' });
        
        if (signOutError) {
          console.error('Supabase signOut error:', signOutError);
          // Optionally throw the error to be caught below, or handle differently
          throw signOutError; 
        }

        // Clear Google's cookies to force prompt on next login
        // These are common Google auth cookies that might persist
        const googleCookies = ['__Secure-1PAPISID', '__Secure-3PAPISID', '__Secure-APISID', 
                              'SAPISID', 'APISID', 'SSID', 'SID', 'HSID', 'NID'];
        
        googleCookies.forEach(cookieName => {
          // Attempt to expire the cookie by setting it to a past date
          document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=.google.com; secure`;
        });

        console.log("Supabase signOut successful. Redirecting to /...");
        // Force redirect to landing page
        window.location.assign('/'); 
      } catch (error) {
        console.error('Error during sign out process:', error);
        // Optionally display an error message to the user here
        alert("Sign out failed. Please check the console."); 
      }
    },
    signUpWithEmail: async (email: string, password: string) => {
        // This function is likely no longer used with Magic Link focus
        // but we keep it for now if AuthContext defines it.
        // Ensure redirect is correct if used.
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
            // Redirect to dashboard after email confirmation
          emailRedirectTo: `${window.location.origin}/dashboard` 
        }
      });
      if (error) throw error;
      return { data, error };
    },
    updatePassword: async (newPassword: string) => {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });
      if (error) throw error;
    },
    updateEmail: async (newEmail: string) => {
      const { error } = await supabase.auth.updateUser({
        email: newEmail
      });
      if (error) throw error;
    },
    resetPassword: async (email: string) => {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/update-password`
      });
      if (error) throw error;
    },
    deleteAccount: async () => {
      // First delete user data from any related tables
      const { error: dataError } = await supabase
        .from('users')
        .delete()
        .eq('id', user?.id);
      
      if (dataError) throw dataError;

      // Then delete the user's subscription if it exists
      const { error: subscriptionError } = await supabase
        .from('subscriptions')
        .delete()
        .eq('user_id', user?.id);

      if (subscriptionError) throw subscriptionError;

      // Finally delete the user's auth account
      const { error: authError } = await supabase.auth.admin.deleteUser(
        user?.id as string
      );

      if (authError) throw authError;

      // Sign out after successful deletion
      await supabase.auth.signOut();
    },
    isSubscriber,
  };


  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext); 