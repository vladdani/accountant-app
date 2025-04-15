'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
// import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/hooks/useSubscription';
import { StripeBuyButton } from '@/components/StripeBuyButton';
import { SubscriptionStatus } from '@/components/SubscriptionStatus';

export default function PaymentPage() {
  // const { user } = useAuth();
  const { subscription, isLoading, error } = useSubscription();
  const router = useRouter();

  // Redirect if already subscribed
  useEffect(() => {
    if ( (subscription?.status === 'active' || subscription?.status === 'trialing') && !subscription.cancel_at_period_end) {
      const timer = setTimeout(() => {
        router.push('/profile');
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [subscription, router]);

  // Check if user can subscribe
  const canSubscribe = !isLoading && 
    (!subscription || 
    (subscription.status === 'canceled' && !subscription.cancel_at_period_end));

  // Add error handling
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] p-4">
        <h1 className="text-xl md:text-2xl font-bold mb-4 text-center">Error Loading Subscription</h1>
        <p className="text-gray-600 mb-4 text-center">
          Unable to load subscription information. Please try again later.
        </p>
        <button
          onClick={() => router.push('/pay')}
          className="bg-primary hover:bg-primary-darker text-white px-6 py-2 rounded-lg"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!canSubscribe) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] p-4">
        <h1 className="text-xl md:text-2xl font-bold mb-4 text-center">Subscription Not Available</h1>
        <p className="text-gray-600 mb-4 text-center">
          You already have an active or pending subscription.
        </p>
        <button
          onClick={() => router.push('/profile')}
          className="bg-primary hover:bg-primary-darker text-white px-6 py-2 rounded-lg"
        >
          View Subscription
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] p-4">
      <h1 className="text-xl md:text-2xl font-bold mb-6 text-center">Subscription Status</h1>
      
      <div className="w-full max-w-md mb-8">
        <div className="bg-card rounded-xl shadow-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Basic Plan</h2>
          <div className="text-3xl font-bold mb-2">7 days free</div>
          <p className="text-muted-foreground mb-4">Then $9 per month</p>
          
          <ul className="mb-6 space-y-2">
            <li className="flex items-center">
              <svg className="h-5 w-5 text-green-500 mr-2" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor"><path d="M5 13l4 4L19 7"></path></svg>
              Unlimited document processing
            </li>
            <li className="flex items-center">
              <svg className="h-5 w-5 text-green-500 mr-2" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor"><path d="M5 13l4 4L19 7"></path></svg>
              AI-powered analysis
            </li>
            <li className="flex items-center">
              <svg className="h-5 w-5 text-green-500 mr-2" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor"><path d="M5 13l4 4L19 7"></path></svg>
              Premium support
            </li>
          </ul>
          
          <StripeBuyButton
            className="w-full"
            buyButtonId={process.env.NEXT_PUBLIC_STRIPE_BUTTON_ID || ''}
            publishableKey={process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || ''}
          />
          
          <div className="mt-4 text-center text-sm text-muted-foreground">
            Cancel anytime. No long-term commitment.
          </div>
        </div>
      </div>
      
      <SubscriptionStatus />
    </div>
  );
}





