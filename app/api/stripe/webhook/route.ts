import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import Stripe from 'stripe';
import { supabaseAdmin } from '@/utils/supabase-admin';
import { withCors } from '@/utils/cors';
import { updateUserSubscriptionTimestamp } from '@/utils/subscription-cache-server';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

// Helper function for consistent logging
function logWebhookEvent(message: string, data?: unknown) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] WEBHOOK: ${message}`, data ? JSON.stringify(data, null, 2) : '');
}

// Define interfaces for stored data
interface StoredSessionData {
  userId: string;
  customerId: string;
}

interface StoredSubscriptionData {
  id: string;
  customer: string;
}

// Store both checkout sessions and subscriptions temporarily
const checkoutSessionMap = new Map<string, StoredSessionData>();
const pendingSubscriptions = new Map<string, StoredSubscriptionData>();

// Need to disable body parsing for Stripe webhooks
export const config = {
  api: {
    bodyParser: false,
  },
};

async function checkExistingSubscription(customerId: string, userId?: string): Promise<boolean> {
  // First check for existing active subscription by Stripe customer ID
  const { data: existingByCustomerId } = await supabaseAdmin
    .from('subscriptions')
    .select('*')
    .eq('stripe_customer_id', customerId)
    .in('status', ['active', 'trialing'])
    .single();

  if (existingByCustomerId) {
    logWebhookEvent('Found existing subscription by customer ID', existingByCustomerId);
    return true;
  }

  // If userId is provided, check for existing subscriptions by user ID as well
  if (userId) {
    const { data: existingByUserId } = await supabaseAdmin
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .in('status', ['active', 'trialing'])
      .single();

    if (existingByUserId) {
      logWebhookEvent('Found existing subscription by user ID', existingByUserId);
      return true;
    }
    
    // Also check trial status in the user_trials table
    const { data: existingTrial } = await supabaseAdmin
      .from('user_trials')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (existingTrial && new Date(existingTrial.end_time) > new Date()) {
      logWebhookEvent('User has an active trial', existingTrial);
      return true;
    }
  }

  return false;
}

// Currently Handled Events:
// 1. checkout.session.completed - When a customer completes checkout
// 2. customer.subscription.created - When a new subscription is created
// 3. customer.subscription.updated - When a subscription is updated
// 4. customer.subscription.deleted - When a subscription is cancelled/deleted
// 5. customer.subscription.pending_update_applied - When a pending update is applied
// 6. customer.subscription.pending_update_expired - When a pending update expires
// 7. customer.subscription.trial_will_end - When a trial is about to end

// Other Important Events You Might Want to Handle:
// Payment Related:
// - invoice.paid - When an invoice is paid successfully
// - invoice.payment_failed - When a payment fails
// - invoice.upcoming - When an invoice is going to be created
// - payment_intent.succeeded - When a payment is successful
// - payment_intent.payment_failed - When a payment fails

// Customer Related:
// - customer.created - When a new customer is created
// - customer.updated - When customer details are updated
// - customer.deleted - When a customer is deleted

// Subscription Related:
// - customer.subscription.paused - When a subscription is paused
// - customer.subscription.resumed - When a subscription is resumed
// - customer.subscription.trial_will_end - 3 days before trial ends

// Checkout Related:
// - checkout.session.async_payment_succeeded - Async payment success
// - checkout.session.async_payment_failed - Async payment failure
// - checkout.session.expired - When checkout session expires

export const POST = withCors(async function POST(request: NextRequest) {
  const body = await request.text();
  const sig = request.headers.get('stripe-signature')!;

  try {
    logWebhookEvent('Received webhook request');
    logWebhookEvent('Stripe signature', sig);

    const event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
    logWebhookEvent(`Event received: ${event.type}`, event.data.object);

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        
        // Check for existing active subscription using both customer ID and user ID
        const hasActiveSubscription = await checkExistingSubscription(
          session.customer as string, 
          session.client_reference_id || undefined
        );
        
        if (hasActiveSubscription) {
          logWebhookEvent('Duplicate subscription attempt blocked', {
            customerId: session.customer,
            userId: session.client_reference_id,
            sessionId: session.id
          });
          
          // Cancel the new subscription immediately
          if (session.subscription) {
            await stripe.subscriptions.cancel(session.subscription as string);
          }
          
          return NextResponse.json({ 
            status: 'blocked',
            message: 'Customer already has an active subscription'
          });
        }

        logWebhookEvent('Processing checkout.session.completed', {
          sessionId: session.id,
          clientReferenceId: session.client_reference_id,
          customerId: session.customer,
          subscriptionId: session.subscription
        });

        if (!session.client_reference_id || !session.customer || !session.subscription) {
          logWebhookEvent('Missing required session data', {
            clientReferenceId: session.client_reference_id,
            customerId: session.customer,
            subscriptionId: session.subscription
          });
          return NextResponse.json({ error: 'Invalid session data' }, { status: 400 });
        }

        try {
          const subscription = await createSubscription(
            session.subscription as string,
            session.client_reference_id!,
            session.customer as string
          );
          logWebhookEvent('Successfully created subscription', subscription);
        } catch (error) {
          logWebhookEvent('Failed to create subscription', error);
          throw error;
        }
        break;
      }

      case 'customer.subscription.created': {
        const subscription = event.data.object as Stripe.Subscription;
        
        // Check if we have the session data already
        const sessionData = checkoutSessionMap.get(subscription.id);
        if (sessionData) {
          // We can create the subscription now
          await createSubscription(
            subscription.id,
            sessionData.userId,
            sessionData.customerId
          );
          checkoutSessionMap.delete(subscription.id);
        } else {
          // Store the subscription data until we get the session
          pendingSubscriptions.set(subscription.id, {
            id: subscription.id,
            customer: subscription.customer as string
          });
        }
        break;
      }

      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
      case 'customer.subscription.pending_update_applied':
      case 'customer.subscription.pending_update_expired': {
        const subscription = event.data.object as Stripe.Subscription;
        
        // First get the user_id for this subscription to clear cache
        const { data: subscriptionData } = await supabaseAdmin
          .from('subscriptions')
          .select('user_id')
          .eq('stripe_subscription_id', subscription.id)
          .single();
        
        // Update the subscription in the database
        await supabaseAdmin
          .from('subscriptions')
          .update({
            status: subscription.status,
            cancel_at_period_end: subscription.cancel_at_period_end,
            current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('stripe_subscription_id', subscription.id);
        
        // Update the timestamp for this user if we found their ID
        if (subscriptionData?.user_id) {
          logWebhookEvent('Updating subscription timestamp for user', subscriptionData.user_id);
          updateUserSubscriptionTimestamp(subscriptionData.user_id);
        }
        
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        
        await supabaseAdmin
          .from('subscriptions')
          .update({
            status: subscription.status,
            cancel_at_period_end: false,
            current_period_end: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('stripe_subscription_id', subscription.id);
        
        break;
      }

      case 'customer.subscription.trial_will_end': {
        const subscription = event.data.object as Stripe.Subscription;
        
        // First get the user_id for this subscription
        const { data: subscriptionData } = await supabaseAdmin
          .from('subscriptions')
          .select('user_id')
          .eq('stripe_subscription_id', subscription.id)
          .single();
          
        if (subscriptionData?.user_id) {
          logWebhookEvent('Trial ending soon for user', subscriptionData.user_id);
          
          // Update subscription status to reflect trial ending
          await supabaseAdmin
            .from('subscriptions')
            .update({
              updated_at: new Date().toISOString()
            })
            .eq('stripe_subscription_id', subscription.id);
            
          // Update the timestamp for this user
          updateUserSubscriptionTimestamp(subscriptionData.user_id);
          
          // Add here: Code to notify user about trial ending
          // This could trigger an email, in-app notification, etc.
        }
        
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        
        if (invoice.subscription) {
          // Get the subscription and user data
          const { data: subscriptionData } = await supabaseAdmin
            .from('subscriptions')
            .select('user_id')
            .eq('stripe_subscription_id', invoice.subscription as string)
            .single();
            
          if (subscriptionData?.user_id) {
            logWebhookEvent('Payment failed for user', {
              userId: subscriptionData.user_id,
              invoiceId: invoice.id,
              subscriptionId: invoice.subscription
            });
            
            // Update the timestamp to refresh client state
            updateUserSubscriptionTimestamp(subscriptionData.user_id);
            
            // Add here: Code to notify user about payment failure
            // This could trigger an email, in-app notification, etc.
          }
        }
        
        break;
      }

      // Note: You might want to add handlers for these common events:
      // case 'invoice.paid': {
      //   const invoice = event.data.object as Stripe.Invoice;
      //   // Handle successful payment
      // }

      // case 'invoice.payment_failed': {
      //   const invoice = event.data.object as Stripe.Invoice;
      //   // Handle failed payment, notify user
      // }

      // case 'customer.subscription.trial_will_end': {
      //   const subscription = event.data.object as Stripe.Subscription;
      //   // Notify user about trial ending
      // }
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    logWebhookEvent('Webhook error', err);
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 400 }
    );
  }
});

async function createSubscription(subscriptionId: string, userId: string, customerId: string) {
  logWebhookEvent('Starting createSubscription', { subscriptionId, userId, customerId });

  try {
    const stripeSubscription = await stripe.subscriptions.retrieve(subscriptionId);
    logWebhookEvent('Retrieved Stripe subscription', stripeSubscription);

    const { data: existingData, error: checkError } = await supabaseAdmin
      .from('subscriptions')
      .select('*')
      .eq('stripe_subscription_id', subscriptionId)
      .single();

    if (checkError) {
      logWebhookEvent('Error checking existing subscription', checkError);
    }

    if (existingData) {
      logWebhookEvent('Found existing subscription', existingData);
      const { error: updateError } = await supabaseAdmin
        .from('subscriptions')
        .update({
          status: stripeSubscription.status,
          current_period_end: new Date(stripeSubscription.current_period_end * 1000).toISOString(),
          cancel_at_period_end: stripeSubscription.cancel_at_period_end,
          updated_at: new Date().toISOString()
        })
        .eq('stripe_subscription_id', subscriptionId)
        .select()
        .single();

      if (updateError) {
        logWebhookEvent('Error updating existing subscription', updateError);
        throw updateError;
      }
      
      // Update the subscription timestamp for this user
      logWebhookEvent('Updating subscription timestamp for user', existingData.user_id);
      updateUserSubscriptionTimestamp(existingData.user_id);
      
      return existingData;
    }

    if (!userId) {
      const errorMsg = 'Cannot create subscription: userId (from client_reference_id) is missing or invalid.';
      logWebhookEvent(errorMsg, { subscriptionId, customerId });
      throw new Error(errorMsg);
    }

    const subscriptionData = {
      user_id: userId,
      stripe_customer_id: customerId,
      stripe_subscription_id: subscriptionId,
      status: stripeSubscription.status,
      price_id: stripeSubscription.items.data[0]?.price.id,
      current_period_end: new Date(stripeSubscription.current_period_end * 1000).toISOString(),
      cancel_at_period_end: stripeSubscription.cancel_at_period_end,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    logWebhookEvent('Attempting to insert new subscription record with data:', subscriptionData);

    const { data, error: insertError } = await supabaseAdmin
      .from('subscriptions')
      .insert(subscriptionData)
      .select()
      .single();

    if (insertError) {
      logWebhookEvent('Error inserting new subscription', { error: insertError, attemptedData: subscriptionData });
      throw insertError;
    }
    
    // Update the subscription timestamp for the new user
    logWebhookEvent('Updating subscription timestamp for user', userId);
    updateUserSubscriptionTimestamp(userId);
    
    return data;
  } catch (error) {
    logWebhookEvent('Error in createSubscription', error);
    throw error;
  }
} 