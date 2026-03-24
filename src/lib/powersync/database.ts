import { PowerSyncDatabase } from '@powersync/react-native';

import { AppSchema } from './schema';

let _powerSyncDb: PowerSyncDatabase | null = null;

export function getPowerSyncDb(): PowerSyncDatabase {
  if (!_powerSyncDb) {
    _powerSyncDb = new PowerSyncDatabase({
      schema: AppSchema,
      database: { dbFilename: 'flick-powersync.db' },
    });
  }
  return _powerSyncDb;
}

// Backwards compat — lazy getter
export const powerSyncDb = new Proxy({} as PowerSyncDatabase, {
  get(_target, prop) {
    return (getPowerSyncDb() as any)[prop];
  },
});
