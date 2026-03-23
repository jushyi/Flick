/**
 * PowerSync Database Provider
 *
 * Provides access to the PowerSync database instance.
 * PowerSync is not yet installed (deferred to Phase 14), so this module
 * provides a graceful fallback with a warning when the db is not available.
 *
 * The upload queue service uses this to persist queue items in a local-only
 * SQLite table managed by PowerSync.
 */

import logger from '../../utils/logger';

let powerSyncDb: any = null;

/**
 * Set the PowerSync database instance (called during app initialization)
 */
export const setPowerSyncDb = (db: any): void => {
  powerSyncDb = db;
  logger.info('PowerSyncProvider: Database instance set');
};

/**
 * Get the PowerSync database instance
 * Returns null if PowerSync is not yet initialized
 */
export const getPowerSyncDb = (): any => {
  if (!powerSyncDb) {
    logger.warn('PowerSyncProvider: Database not yet initialized');
  }
  return powerSyncDb;
};
