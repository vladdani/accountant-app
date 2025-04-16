'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import debounce from 'lodash/debounce';

// Create a global cache that can be accessed outside the hook
const subscriptionCacheMap = new Map<string, {data: Subscription | null, timestamp: number}>();
const CACHE_DURATION = 30000; // 30 seconds

// Add a function to clear the cache for a specific user
export function clearSubscriptionCache(userId: string) {
  if (subscriptionCacheMap.has(userId)) {
    console.log(`Clearing subscription cache for user ${userId}`);
    subscriptionCacheMap.delete(userId);
    return true;
  }
  return false;
}

export interface Subscription {
  id: string;
  user_id: string;
  status: string;
  stripe_customer_id: string;
  stripe_subscription_id: string;
  cancel_at_period_end: boolean;
  current_period_end: string;
  created_at: string;
  updated_at: string;
}

export function useSubscription() {
  const { user, supabaseClient } = useAuth();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastCheckedTimestamp, setLastCheckedTimestamp] = useState<number>(0);

  // Add a function to check if the server has updates
  const checkServerUpdates = useCallback(async (userId: string, lastChecked: number): Promise<boolean> => {
    try {
      // Check user_preferences table for updated_at
      const { data, error } = await supabaseClient
        .from('user_preferences')
        .select('updated_at')
        .eq('user_id', userId)
        .single();
      
      if (error) {
        console.error('Error checking for subscription updates:', error);
        return false;
      }
      
      // If server has no timestamp or client has no lastChecked, force update
      if (!data?.updated_at || !lastChecked) {
        return true;
      }
      
      // Compare timestamps (server timestamp vs last client check)
      const serverUpdatedAt = new Date(data.updated_at).getTime();
      return serverUpdatedAt > lastChecked;
    } catch (err) {
      console.error('Failed to check for subscription updates:', err);
      return false; // On error, default to false (no updates)
    }
  }, [supabaseClient]);

  const fetchSubscription = useCallback(async (skipCache = false) => {
    if (!user?.id) {
      setSubscription(null);
      setLoading(false);
      return;
    }

    // Check cache first (unless skipCache is true)
    const cached = !skipCache && subscriptionCacheMap.get(user.id);
    const now = Date.now();
    
    if (cached && (now - cached.timestamp < CACHE_DURATION)) {
      console.log("Using cached subscription data");
      
      // Even if using cached data, check if server has updates
      try {
        const hasServerUpdates = await checkServerUpdates(user.id, lastCheckedTimestamp);
        if (hasServerUpdates) {
          console.log("Server has subscription updates, fetching fresh data");
          // Continue to fetch fresh data
        } else {
          // No updates, use cache
          setSubscription(cached.data);
          setLoading(false);
          return;
        }
      } catch (error) {
        console.error("Error checking for subscription updates:", error);
        // Continue to fetch anyway on error
      }
    }

    console.log("Fetching fresh subscription data from database");
    setLoading(true);
    
    try {
      const { data, error } = await supabaseClient
        .from('subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .in('status', ['active', 'trialing'])
        .order('created_at', { ascending: false })
        .maybeSingle();

      if (error) throw error;

      const isValid = data && 
        ['active', 'trialing'].includes(data.status) && 
        new Date(data.current_period_end) > new Date();

      const result = isValid ? data : null;
      
      // Update cache and last checked timestamp
      subscriptionCacheMap.set(user.id, {
        data: result,
        timestamp: now
      });
      setLastCheckedTimestamp(now);
      
      console.log("Subscription data refreshed:", result ? { status: result.status, validUntil: result.current_period_end } : "No valid subscription");
      setSubscription(result);
    } catch (err) {
      console.error('Subscription fetch error:', err);
      setError('Failed to load subscription');
      setSubscription(null);
    } finally {
      setLoading(false);
    }
  }, [user?.id, supabaseClient, checkServerUpdates]);

  useEffect(() => {
    if (user?.id) {
      fetchSubscription();
    }
  }, [user?.id]);

  const checkValidSubscription = useCallback((data: Subscription[]): boolean => {
    return data.some(sub => 
      ['active', 'trialing'].includes(sub.status) &&
      new Date(sub.current_period_end) > new Date()
    );
  }, []);

  const MAX_SYNC_RETRIES = 3;
  const [syncRetries, setSyncRetries] = useState(0);

  const debouncedSyncWithStripe = useCallback(
    debounce(async (subscriptionId: string) => {
      if (syncRetries >= MAX_SYNC_RETRIES) {
        console.log('Max sync retries reached');
        return;
      }

      try {
        const response = await fetch('/api/stripe/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ subscriptionId }),
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.details || 'Failed to sync with Stripe');
        }
        
        await fetchSubscription();
        setSyncRetries(0); // Reset retries on success
      } catch (error) {
        console.error('Error syncing with Stripe:', error);
        setError(error instanceof Error ? error.message : 'Failed to sync with Stripe');
        setSyncRetries(prev => prev + 1);
      }
    }, 30000), // 30 second delay between calls
    [fetchSubscription, syncRetries]
  );

  const syncWithStripe = useCallback((subscriptionId: string) => {
    debouncedSyncWithStripe(subscriptionId);
  }, [debouncedSyncWithStripe]);

  useEffect(() => {
    if (!user) return;

    const channel = supabaseClient
      .channel('subscription_updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'subscriptions',
          filter: `user_id=eq.${user.id}`
        },
        async (payload) => {
          const isValid = checkValidSubscription([payload.new as Subscription]);
          setSubscription(isValid ? payload.new as Subscription : null);
          if (!isValid) {
            console.log('Subscription expired or invalidated');
          }
        }
      )
      .subscribe();

    return () => {
      supabaseClient.removeChannel(channel);
    };
  }, [user, supabaseClient, checkValidSubscription]);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    
    if (subscription?.stripe_subscription_id) {
      // Add a delay before first sync
      timeoutId = setTimeout(() => {
        syncWithStripe(subscription.stripe_subscription_id);
      }, 1000);
    }

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [syncWithStripe, subscription?.stripe_subscription_id]);

  return {
    subscription,
    isLoading: loading,
    error,
    syncWithStripe: useCallback((subscriptionId: string) => {
      debouncedSyncWithStripe(subscriptionId);
    }, [debouncedSyncWithStripe]),
    fetchSubscription // Expose fetch function for manual refresh
  };
} 