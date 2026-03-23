import {
  AbstractPowerSyncDatabase,
  PowerSyncBackendConnector,
} from '@powersync/react-native';

import { supabase } from '@/lib/supabase';

/// PowerSync <-> Supabase connector
/// Handles authentication token exchange and CRUD operations
/// Full implementation in Phase 14 (Data Layer & Caching Foundation)
export class SupabaseConnector implements PowerSyncBackendConnector {
  async fetchCredentials() {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      throw new Error('No Supabase session found');
    }

    return {
      endpoint: process.env.EXPO_PUBLIC_POWERSYNC_URL ?? '',
      token: session.access_token,
    };
  }

  async uploadData(database: AbstractPowerSyncDatabase): Promise<void> {
    // TODO: Implement in Phase 14
    // Process CrudEntry items from local SQLite and push to Supabase
    const transaction = await database.getNextCrudTransaction();
    if (!transaction) return;

    // Stub: log and complete transaction
    console.warn(
      '[PowerSync] uploadData not yet implemented - completing transaction',
    );
    await transaction.complete();
  }
}
