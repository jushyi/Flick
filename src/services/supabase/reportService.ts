/**
 * Supabase Report Service
 *
 * Handles user report submission via simple Supabase insert.
 * Reports are stored for admin review.
 */

import { supabase } from '@/lib/supabase';

import logger from '../../utils/logger';

/**
 * Submit a report against a user
 */
export async function reportUser(
  reporterId: string,
  reportedId: string,
  reason: string,
  details?: string
): Promise<void> {
  if (!reason) {
    throw new Error('Report reason is required');
  }

  const { error } = await supabase.from('reports').insert({
    reporter_id: reporterId,
    reported_id: reportedId,
    reason,
    details: details ?? null,
  });

  if (error) {
    logger.error('reportService.reportUser: Failed', {
      reporterId,
      error: error.message,
    });
    throw new Error(error.message);
  }

  logger.info('reportService.reportUser: Success', {
    reporterId,
    reportedId,
    reason,
  });
}
