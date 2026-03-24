/**
 * Snap Service (Supabase)
 *
 * Handles the complete snap lifecycle: upload with WebP compression, send as
 * snap message, mark viewed (triggers PG cleanup chain), and signed URL generation.
 *
 * Upload flow: compress to WebP 0.9 at 1080px -> base64 -> ArrayBuffer -> Supabase Storage
 * View flow: client sets snap_viewed_at -> PG trigger fires -> pg_net calls snap-cleanup Edge Function
 * URL flow: client-side createSignedUrl with 5-minute expiry (no Edge Function needed)
 */

import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';

import { supabase } from '@/lib/supabase';

import { sendMessage } from './messageService';

import logger from '../../utils/logger';

// ============================================================================
// Constants
// ============================================================================

const MAX_RETRIES = 3;
const BACKOFF_DELAYS = [1000, 2000, 4000];

// ============================================================================
// Internal helpers
// ============================================================================

/**
 * Sleep utility for exponential backoff
 */
const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

// ============================================================================
// Exported functions
// ============================================================================

/**
 * Upload a snap photo and send it as a message in a conversation.
 *
 * Compresses the image to WebP 0.9 at 1080px width, uploads to the snaps
 * private bucket, sends a snap message via messageService, then updates the
 * message with the snap_storage_path.
 *
 * Includes auto-retry: on failure, retries up to 3 times with exponential
 * backoff (1s, 2s, 4s). Throws on final failure.
 *
 * @param conversationId - Conversation document ID
 * @param senderId - Sender's user ID
 * @param localUri - Local image URI from camera capture
 * @param caption - Optional caption text (truncated to 150 chars)
 * @returns Object with messageId
 * @throws On final retry failure
 */
export const uploadAndSendSnap = async (
  conversationId: string,
  senderId: string,
  localUri: string,
  caption?: string | null
): Promise<{ messageId: string }> => {
  logger.debug('snapService.uploadAndSendSnap: Starting', {
    conversationId,
    senderId,
    hasCaption: !!caption,
  });

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      // Compress to WebP at 1080px width, 0.9 quality
      const compressed = await ImageManipulator.manipulateAsync(
        localUri,
        [{ resize: { width: 1080 } }],
        { compress: 0.9, format: ImageManipulator.SaveFormat.WEBP }
      );

      // Read as base64 and decode to ArrayBuffer
      const base64 = await FileSystem.readAsStringAsync(compressed.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const arrayBuffer = decode(base64);

      // Generate unique storage path
      const snapId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      const storagePath = `${senderId}/${snapId}.webp`;

      // Upload to snaps bucket (private, no-cache)
      const { error: uploadError } = await supabase.storage
        .from('snaps')
        .upload(storagePath, arrayBuffer, {
          contentType: 'image/webp',
          cacheControl: 'no-store',
        });

      if (uploadError) {
        throw uploadError;
      }

      // Send snap message via messageService
      const result = await sendMessage({
        conversationId,
        senderId,
        type: 'snap',
        text: caption ? caption.substring(0, 150) : null,
      });

      // Update message with snap_storage_path
      const { error: updateError } = await supabase
        .from('messages')
        .update({ snap_storage_path: storagePath })
        .eq('id', result.messageId);

      if (updateError) {
        throw updateError;
      }

      logger.info('snapService.uploadAndSendSnap: Snap sent successfully', {
        conversationId,
        messageId: result.messageId,
        storagePath,
        attempt,
      });

      return { messageId: result.messageId };
    } catch (error: any) {
      if (attempt < MAX_RETRIES) {
        logger.warn('snapService.uploadAndSendSnap: Attempt failed, retrying', {
          conversationId,
          senderId,
          attempt,
          maxRetries: MAX_RETRIES,
          error: error.message,
          nextRetryMs: BACKOFF_DELAYS[attempt - 1],
        });
        await sleep(BACKOFF_DELAYS[attempt - 1]);
      } else {
        logger.error('snapService.uploadAndSendSnap: All retries exhausted', {
          conversationId,
          senderId,
          error: error.message,
          totalAttempts: MAX_RETRIES,
        });
        throw error;
      }
    }
  }

  // TypeScript exhaustiveness (unreachable -- loop always returns or throws)
  throw new Error('Unexpected: retry loop exited without return or throw');
};

/**
 * Mark a snap message as viewed by setting snap_viewed_at.
 *
 * This triggers the PostgreSQL handle_snap_viewed trigger which calls
 * the snap-cleanup Edge Function via pg_net to delete the Storage file.
 *
 * @param messageId - Snap message ID
 * @throws On update failure
 */
export const markSnapViewed = async (messageId: string): Promise<void> => {
  logger.debug('snapService.markSnapViewed: Starting', { messageId });

  const { error } = await supabase
    .from('messages')
    .update({ snap_viewed_at: new Date().toISOString() })
    .eq('id', messageId);

  if (error) {
    logger.error('snapService.markSnapViewed: Failed', {
      messageId,
      error: error.message,
    });
    throw error;
  }

  logger.info('snapService.markSnapViewed: Snap marked as viewed', { messageId });
};

/**
 * Get a short-lived signed URL for a snap photo from Supabase Storage.
 * Client-side generation -- no Edge Function needed.
 *
 * @param snapStoragePath - Storage path within the snaps bucket
 * @returns Signed URL string with 5-minute expiry
 * @throws On signed URL generation failure
 */
export const getSignedSnapUrl = async (snapStoragePath: string): Promise<string> => {
  logger.debug('snapService.getSignedSnapUrl: Starting', { snapStoragePath });

  const { data, error } = await supabase.storage
    .from('snaps')
    .createSignedUrl(snapStoragePath, 300);

  if (error) {
    logger.error('snapService.getSignedSnapUrl: Failed', {
      snapStoragePath,
      error: error.message,
    });
    throw error;
  }

  logger.info('snapService.getSignedSnapUrl: Success', { snapStoragePath });
  return data.signedUrl;
};
