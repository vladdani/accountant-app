import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { clearSubscriptionCache } from '@/hooks/useSubscription';

export async function POST() {
  try {
    // Create authenticated Supabase client using cookies
    const supabase = await createClient();
    
    // Get the current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized', details: userError?.message || 'User not found' },
        { status: 401 }
      );
    }
    
    // Clear the subscription cache for this user
    const cacheCleared = clearSubscriptionCache(user.id);
    
    // Fetch the latest subscription data directly from the database
    const { data: subscriptionData, error: subscriptionError } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .in('status', ['active', 'trialing'])
      .order('created_at', { ascending: false })
      .maybeSingle();
      
    if (subscriptionError) {
      return NextResponse.json(
        { error: 'Failed to fetch subscription', details: subscriptionError.message },
        { status: 500 }
      );
    }
    
    // Return success with subscription data
    return NextResponse.json({
      success: true,
      cacheCleared,
      subscription: subscriptionData,
      hasActiveSubscription: !!subscriptionData && ['active', 'trialing'].includes(subscriptionData.status)
    });
    
  } catch (error) {
    console.error('Error refreshing subscription:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 