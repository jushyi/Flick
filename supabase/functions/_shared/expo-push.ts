/**
 * Expo Push API wrapper using direct fetch.
 * No external dependencies -- calls the Expo push API directly.
 * Functionally equivalent to expo-server-sdk but Deno-compatible.
 */

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const EXPO_RECEIPTS_URL = 'https://exp.host/--/api/v2/push/getReceipts';

export interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  sound?: string;
  data?: Record<string, unknown>;
  priority?: 'default' | 'normal' | 'high';
  channelId?: string;
}

export interface ExpoPushTicket {
  id?: string;
  status: 'ok' | 'error';
  message?: string;
  details?: { error?: string };
}

export interface ExpoPushReceipt {
  status: 'ok' | 'error';
  message?: string;
  details?: { error?: string };
}

/**
 * Validate Expo push token format.
 * Accepts both ExponentPushToken[...] and ExpoPushToken[...] formats.
 */
export function isValidExpoPushToken(token: string): boolean {
  return /^Expo(nent)?PushToken\[.+\]$/.test(token);
}

/**
 * Send a single push notification via the Expo Push API.
 * Uses EXPO_ACCESS_TOKEN from environment if available (enables higher rate limits).
 */
export async function sendExpoPush(
  message: ExpoPushMessage
): Promise<ExpoPushTicket> {
  const accessToken = Deno.env.get('EXPO_ACCESS_TOKEN');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  const res = await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify(message),
  });

  const result = await res.json();
  return (
    result.data?.[0] ?? { status: 'error', message: 'No response data' }
  );
}

/**
 * Check receipts for a batch of ticket IDs.
 * Call this ~15 minutes after sending to check delivery status.
 * Max 1000 ticket IDs per call (Expo API limit).
 */
export async function checkExpoPushReceipts(
  ticketIds: string[]
): Promise<Record<string, ExpoPushReceipt>> {
  const accessToken = Deno.env.get('EXPO_ACCESS_TOKEN');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  const res = await fetch(EXPO_RECEIPTS_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify({ ids: ticketIds }),
  });

  const result = await res.json();
  return result.data ?? {};
}
