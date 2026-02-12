/**
 * Cloud Functions Test Setup
 *
 * Comprehensive mocks for firebase-admin, firebase-functions, expo-server-sdk,
 * and zod. Loaded via Jest setupFiles before each test suite.
 */

// Mock firebase-functions (needed by logger.js)
jest.mock('firebase-functions', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
  runWith: jest.fn(() => ({
    firestore: {
      document: jest.fn(() => ({
        onCreate: jest.fn(handler => handler),
        onUpdate: jest.fn(handler => handler),
        onWrite: jest.fn(handler => handler),
        onDelete: jest.fn(handler => handler),
      })),
    },
    pubsub: {
      schedule: jest.fn(() => ({
        timeZone: jest.fn(() => ({
          onRun: jest.fn(handler => handler),
        })),
        onRun: jest.fn(handler => handler),
      })),
    },
  })),
}));

// Mock firebase-functions/v2/https (needed by index.js for onCall)
jest.mock('firebase-functions/v2/https', () => ({
  onCall: jest.fn((options, handler) => handler),
  HttpsError: class HttpsError extends Error {
    constructor(code, message) {
      super(message);
      this.code = code;
    }
  },
}));

// Mock firebase-admin
jest.mock('firebase-admin', () => {
  const mockFirestore = jest.fn();
  // Define FieldValue and Timestamp as properties of the function
  mockFirestore.FieldValue = {
    serverTimestamp: jest.fn(() => 'mock-timestamp'),
    increment: jest.fn(n => n),
    arrayUnion: jest.fn((...args) => args),
    arrayRemove: jest.fn((...args) => args),
    delete: jest.fn(() => 'mock-field-delete'),
  };
  mockFirestore.Timestamp = {
    now: jest.fn(() => ({
      toDate: () => new Date(),
      toMillis: () => Date.now(),
    })),
    fromMillis: jest.fn(ms => ({
      toDate: () => new Date(ms),
      toMillis: () => ms,
    })),
    fromDate: jest.fn(date => ({
      toDate: () => date,
      toMillis: () => date.getTime(),
    })),
  };

  return {
    initializeApp: jest.fn(),
    firestore: mockFirestore,
    auth: jest.fn(() => ({
      getUser: jest.fn(),
      deleteUser: jest.fn(),
    })),
    storage: jest.fn(() => ({
      bucket: jest.fn(() => ({
        file: jest.fn(() => ({
          delete: jest.fn().mockResolvedValue(),
          getSignedUrl: jest.fn().mockResolvedValue(['https://mock-signed-url.com']),
        })),
      })),
    })),
  };
});

// Mock firebase-admin/app (needed by index.js)
jest.mock('firebase-admin/app', () => ({
  initializeApp: jest.fn(),
  getApps: jest.fn(() => ['mock-app']),
  getApp: jest.fn(() => 'mock-app'),
}));

// Mock firebase-admin/firestore (needed by index.js)
// IMPORTANT: Use a singleton mockDb so index.js and tests share the same instance
jest.mock('firebase-admin/firestore', () => {
  const mockDocRef = {
    get: jest.fn().mockResolvedValue({ exists: false, data: () => null }),
    set: jest.fn().mockResolvedValue(),
    update: jest.fn().mockResolvedValue(),
    delete: jest.fn().mockResolvedValue(),
  };
  const mockCollectionRef = {
    doc: jest.fn(() => mockDocRef),
    add: jest.fn().mockResolvedValue({ id: 'mock-id' }),
    get: jest.fn().mockResolvedValue({ docs: [], empty: true }),
    where: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
  };
  const mockDb = {
    collection: jest.fn(() => mockCollectionRef),
    doc: jest.fn(() => mockDocRef),
    batch: jest.fn(() => ({
      set: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      commit: jest.fn().mockResolvedValue(),
    })),
    runTransaction: jest.fn(fn => fn({ get: jest.fn(), set: jest.fn(), update: jest.fn() })),
  };

  return {
    initializeFirestore: jest.fn(() => mockDb),
  };
});

// Mock firebase-admin/storage (needed by deleteUserAccount, processScheduledDeletions, etc.)
jest.mock('firebase-admin/storage', () => {
  const mockFile = {
    delete: jest.fn().mockResolvedValue(),
    exists: jest.fn().mockResolvedValue([true]),
    getSignedUrl: jest.fn().mockResolvedValue(['https://mock-signed-url.com']),
  };
  const mockBucket = {
    file: jest.fn(() => mockFile),
  };
  return {
    getStorage: jest.fn(() => ({
      bucket: jest.fn(() => mockBucket),
    })),
  };
});

// Mock expo-server-sdk
jest.mock('expo-server-sdk', () => {
  const mockSend = jest.fn().mockResolvedValue([{ status: 'ok', id: 'receipt-123' }]);

  class MockExpo {
    constructor() {
      this.sendPushNotificationsAsync = mockSend;
      this.chunkPushNotifications = jest.fn(msgs => [msgs]);
      this.chunkPushNotificationReceiptIds = jest.fn(ids => [ids]);
      this.getPushNotificationReceiptsAsync = jest.fn().mockResolvedValue({});
    }
  }
  MockExpo.isExpoPushToken = jest.fn(
    token => typeof token === 'string' && token.startsWith('ExponentPushToken[')
  );
  return { Expo: MockExpo };
});

// Mock zod (used by validation.js)
jest.mock('zod', () => {
  // Create a fully chainable mock schema where every method returns itself
  const createChainableSchema = () => {
    const schema = {
      safeParse: jest.fn(() => ({ success: true, data: {} })),
      parse: jest.fn(data => data),
    };
    // All chainable methods return the same schema object
    const chainMethods = [
      'optional',
      'nullable',
      'min',
      'max',
      'email',
      'url',
      'int',
      'positive',
      'negative',
      'nonnegative',
    ];
    for (const method of chainMethods) {
      schema[method] = jest.fn(() => schema);
    }
    return schema;
  };

  return {
    z: {
      object: jest.fn(() => createChainableSchema()),
      string: jest.fn(() => createChainableSchema()),
      number: jest.fn(() => createChainableSchema()),
      boolean: jest.fn(() => createChainableSchema()),
      enum: jest.fn(() => createChainableSchema()),
      array: jest.fn(() => createChainableSchema()),
      record: jest.fn(() => createChainableSchema()),
      any: jest.fn(() => createChainableSchema()),
    },
  };
});
