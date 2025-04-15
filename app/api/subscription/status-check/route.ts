import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { hasSubscriptionUpdatedSince } from '@/utils/subscription-cache-server';

export async function POST(request: Request) {
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
    
    // Parse the request body
    const body = await request.json();
    const { userId, lastUpdated } = body;
    
    // Verify the user is checking their own subscription
    if (userId !== user.id) {
      return NextResponse.json(
        { error: 'Unauthorized', details: 'Cannot check subscription status for another user' },
        { status: 403 }
      );
    }
    
    // Check if the subscription has been updated since the specified timestamp
    const hasUpdates = hasSubscriptionUpdatedSince(userId, lastUpdated);
    
    return NextResponse.json({
      hasUpdates,
      checkedAt: Date.now()
    });
    
  } catch (error) {
    console.error('Error checking subscription status:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 