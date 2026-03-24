import { PowerSyncDatabase } from '@powersync/react-native';

import { AppSchema } from './schema';

export const powerSyncDb = new PowerSyncDatabase({
  schema: AppSchema,
  database: { dbFilename: 'flick-powersync.db' },
});
