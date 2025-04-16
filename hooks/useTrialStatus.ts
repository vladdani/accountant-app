import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { type SupabaseClient } from '@supabase/supabase-js';

export function useTrialStatus() {
  const { user, supabaseClient } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [trialStatus, setTrialStatus] = useState<{
    isInTrial: boolean;
    trialEndTime: string | null;
  }>({ isInTrial: false, trialEndTime: null });

  const checkTrialStatus = useCallback(async (client: SupabaseClient) => {
    if (!user?.id) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    try {
      const { data: subscription } = await client
        .from('subscriptions')
        .select('status')
        .eq('user_id', user.id)
        .in('status', ['active', 'trialing'])
        .maybeSingle();

      if (subscription) {
        console.log('User has active/trialing subscription, skipping trial check.');
        setTrialStatus({
          isInTrial: false,
          trialEndTime: null
        });
        setIsLoading(false);
        return;
      }

      // Check if user has an existing trial using the passed client
      const userId = user.id;
      console.log(`[useTrialStatus] Using user ID for query: ${userId}`);
      console.log(`[useTrialStatus] Attempting to fetch trial for user: ${userId}`);
      const { data: trial, error: trialError } = await client
        .from('user_trials')
        .select('trial_end_time, is_trial_used')
        .eq('user_id', userId)
        .maybeSingle();

      // Log the result immediately
      console.log(`[useTrialStatus] Fetch result: data=${JSON.stringify(trial)}, error=${JSON.stringify(trialError)}`);

      if (trialError && trialError.code !== 'PGRST116') {
        console.error('[useTrialStatus] Error fetching trial record:', trialError);
        throw trialError;
      }

      if (trial) {
        const now = new Date();
        const endTime = new Date(trial.trial_end_time);
        const isInTrial = !trial.is_trial_used && now < endTime;
        console.log('Existing trial found:', { trial, isInTrial });
        setTrialStatus({
          isInTrial,
          trialEndTime: trial.trial_end_time
        });
      } else {
        console.log('No active subscription or existing trial record found for user:', user.id);
        setTrialStatus({
          isInTrial: false,
          trialEndTime: null
        });
      }
    } catch (error) {
      console.error('Error checking trial status:', error);
      setTrialStatus({
        isInTrial: false,
        trialEndTime: null
      });
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (supabaseClient) {
      checkTrialStatus(supabaseClient);
    } else {
      if (!user) {
        setIsLoading(false);
        setTrialStatus({ isInTrial: false, trialEndTime: null });
      }
    }
  }, [checkTrialStatus, supabaseClient, user]);

  return { ...trialStatus, isLoading };
}