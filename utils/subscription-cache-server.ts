// Server-side subscription cache utility
// This is used by server components and API routes to track cached subscriptions
// The actual cache is maintained separately on client and server

// Map to track when each user's subscription data was last updated on the server
const serverSubscriptionUpdates = new Map<string, number>();

// Track the last time a user's subscription was updated
export function updateUserSubscriptionTimestamp(userId: string): void {
  serverSubscriptionUpdates.set(userId, Date.now());
  console.log(`[Server] Updated subscription timestamp for user ${userId}`);
}

// Check if a user's subscription has been updated since a specific time
export function hasSubscriptionUpdatedSince(userId: string, timestamp: number): boolean {
  const lastUpdate = serverSubscriptionUpdates.get(userId);
  if (!lastUpdate) return false;
  return lastUpdate > timestamp;
}

// For debugging - get all timestamps
export function getAllSubscriptionTimestamps(): Record<string, number> {
  return Object.fromEntries(serverSubscriptionUpdates.entries());
} 