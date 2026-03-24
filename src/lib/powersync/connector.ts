import {
  AbstractPowerSyncDatabase,
  CrudEntry,
  PowerSyncBackendConnector,
  UpdateType,
} from '@powersync/react-native';

import { supabase } from '@/lib/supabase';

import logger from '@/utils/logger';

const POWERSYNC_URL = process.env.EXPO_PUBLIC_POWERSYNC_URL ?? '';

// Fatal PostgreSQL error codes that should NOT be retried
// (data exception, integrity constraint violation, insufficient privilege)
const FATAL_RESPONSE_CODES = [
  /^22...$/, // Data Exception
  /^23...$/, // Integrity Constraint Violation
  /^42501$/, // INSUFFICIENT PRIVILEGE
];

export class SupabaseConnector implements PowerSyncBackendConnector {
  async fetchCredentials() {
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    if (error) {
      throw new Error(`Could not fetch Supabase session: ${error.message}`);
    }

    if (!session) {
      return null;
    }

    return {
      endpoint: POWERSYNC_URL,
      token: session.access_token,
      expiresAt: session.expires_at
        ? new Date(session.expires_at * 1000)
        : undefined,
    };
  }

  async uploadData(database: AbstractPowerSyncDatabase): Promise<void> {
    const transaction = await database.getNextCrudTransaction();
    if (!transaction) return;

    let lastOp: CrudEntry | null = null;
    try {
      for (const op of transaction.crud) {
        lastOp = op;
        const table = supabase.from(op.table);
        let result;

        switch (op.op) {
          case UpdateType.PUT:
            result = await table.upsert({ ...op.opData, id: op.id });
            break;
          case UpdateType.PATCH:
            result = await table.update(op.opData!).eq('id', op.id);
            break;
          case UpdateType.DELETE:
            result = await table.delete().eq('id', op.id);
            break;
        }

        if (result?.error) {
          throw new Error(
            `Could not ${op.op} to ${op.table}: ${JSON.stringify(result.error)}`,
          );
        }
      }
      await transaction.complete();
    } catch (ex: unknown) {
      const error = ex as { code?: string; message?: string };
      logger.error('PowerSync uploadData failed', {
        op: lastOp?.op,
        table: lastOp?.table,
        id: lastOp?.id,
        error: error.message,
        code: error.code,
      });

      if (
        typeof error.code === 'string' &&
        FATAL_RESPONSE_CODES.some((regex) => regex.test(error.code!))
      ) {
        // Fatal error - discard transaction to avoid infinite retry loop
        logger.warn('PowerSync discarding transaction due to fatal error', {
          code: error.code,
        });
        await transaction.complete();
      } else {
        // Retryable error - let PowerSync retry
        throw ex;
      }
    }
  }
}
