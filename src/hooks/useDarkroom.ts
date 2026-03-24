/**
 * useDarkroom hook (Supabase + PowerSync)
 *
 * Provides reactive developing/revealed photo lists from PowerSync local SQLite,
 * a countdown timer to next reveal, and reveal check/trigger functions.
 *
 * This is the NEW hook (.ts) for the Supabase migration. The old .js file
 * is preserved for strangler fig -- screens will be switched later.
 */

import { useState, useEffect, useMemo, useCallback } from 'react';

import { useQuery as usePowerSyncQuery } from '@powersync/react';

import {
  checkAndRevealPhotos,
  calculateBatchRevealAt,
} from '@/services/supabase/darkroomService';
import { mapToPhoto, Photo } from '@/services/supabase/photoService';

import logger from '@/utils/logger';

export interface UseDarkroomResult {
  developingPhotos: Photo[];
  revealedPhotos: Photo[];
  developingCount: number;
  revealedCount: number;
  nextRevealAt: string | null;
  countdown: number;
  isRevealReady: boolean;
  isLoading: boolean;
  checkAndReveal: () => Promise<number>;
  getRevealTime: () => Promise<string>;
}

export function useDarkroom(userId: string | undefined): UseDarkroomResult {
  // Reactive developing photos via PowerSync local SQLite
  const { data: developingRows, isLoading: devLoading } = usePowerSyncQuery(
    `SELECT * FROM photos WHERE user_id = ? AND status = 'developing' AND deleted_at IS NULL ORDER BY created_at DESC`,
    [userId ?? ''],
  );

  // Reactive revealed photos via PowerSync local SQLite
  const { data: revealedRows, isLoading: revLoading } = usePowerSyncQuery(
    `SELECT * FROM photos WHERE user_id = ? AND status = 'revealed' AND deleted_at IS NULL ORDER BY created_at DESC`,
    [userId ?? ''],
  );

  // Map database rows to Photo objects
  const developingPhotos = useMemo(() => {
    if (!userId || !developingRows) return [];
    return developingRows.map(mapToPhoto);
  }, [userId, developingRows]);

  const revealedPhotos = useMemo(() => {
    if (!userId || !revealedRows) return [];
    return revealedRows.map(mapToPhoto);
  }, [userId, revealedRows]);

  // Derive next reveal time from developing photos
  const nextRevealAt = useMemo(() => {
    if (developingPhotos.length === 0) return null;
    const times = developingPhotos
      .filter((p) => p.revealAt)
      .map((p) => p.revealAt!);
    return times.length > 0
      ? times.reduce((min, t) => (t < min ? t : min))
      : null;
  }, [developingPhotos]);

  // Countdown timer
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    if (!nextRevealAt) {
      setCountdown(0);
      return;
    }

    const update = () => {
      const diff = Math.max(
        0,
        Math.floor(
          (new Date(nextRevealAt).getTime() - Date.now()) / 1000,
        ),
      );
      setCountdown(diff);
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [nextRevealAt]);

  const isRevealReady = countdown <= 0 && developingPhotos.length > 0;
  const isLoading = devLoading || revLoading;

  // Trigger reveal check
  const checkAndReveal = useCallback(async (): Promise<number> => {
    if (!userId) return 0;
    try {
      const count = await checkAndRevealPhotos(userId);
      logger.info('useDarkroom: checkAndReveal complete', { userId, count });
      return count;
    } catch (error) {
      logger.error('useDarkroom: checkAndReveal failed', {
        error: (error as Error).message,
      });
      return 0;
    }
  }, [userId]);

  // Get or create batch reveal time for new photos
  const getRevealTime = useCallback(async (): Promise<string> => {
    if (!userId) {
      throw new Error('Cannot get reveal time without userId');
    }
    return calculateBatchRevealAt(userId);
  }, [userId]);

  return {
    developingPhotos,
    revealedPhotos,
    developingCount: developingPhotos.length,
    revealedCount: revealedPhotos.length,
    nextRevealAt,
    countdown,
    isRevealReady,
    isLoading,
    checkAndReveal,
    getRevealTime,
  };
}
