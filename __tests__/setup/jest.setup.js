/**
 * Jest Setup File
 *
 * Configures all mocks before each test file runs.
 * Firebase modules are mocked here to prevent native module errors.
 *
 * CRITICAL: Mock functions are defined OUTSIDE jest.mock() calls
 * and then referenced inside. This prevents "Cannot read property
 * 'mockResolvedValue' of undefined" errors.
 */

// ============================================================================
// Firebase App Mock (MUST be first - other modules depend on it)
// ============================================================================
jest.mock('@react-native-firebase/app', () => ({
  __esModule: true,
  default: () => ({
    app: jest.fn(),
  }),
  firebase: {
    app: jest.fn(),
  },
}));

// ============================================================================
// Firebase Auth Mock
// ============================================================================
const mockSignInWithEmailAndPassword = jest.fn(() =>
  Promise.resolve({ user: { uid: 'test-uid', email: 'test@example.com' } })
);
const mockSignOut = jest.fn(() => Promise.resolve());
const mockOnAuthStateChanged = jest.fn(callback => {
  // Return unsubscribe function
  return jest.fn();
});
const mockCreateUserWithEmailAndPassword = jest.fn(() =>
  Promise.resolve({ user: { uid: 'new-user-uid', email: 'new@example.com' } })
);
const mockSendPasswordResetEmail = jest.fn(() => Promise.resolve());
const mockSignInWithPhoneNumber = jest.fn(() =>
  Promise.resolve({
    verificationId: 'test-verification-id',
    confirm: jest.fn(() => Promise.resolve({ user: { uid: 'phone-user-uid' } })),
  })
);
const mockConfirmationResult = {
  verificationId: 'test-verification-id',
  confirm: jest.fn(() => Promise.resolve({ user: { uid: 'phone-user-uid' } })),
};

const mockCurrentUser = { uid: 'test-uid', email: 'test@example.com', phoneNumber: '+11234567890' };

jest.mock('@react-native-firebase/auth', () => {
  const auth = () => ({
    signInWithEmailAndPassword: mockSignInWithEmailAndPassword,
    signOut: mockSignOut,
    onAuthStateChanged: mockOnAuthStateChanged,
    createUserWithEmailAndPassword: mockCreateUserWithEmailAndPassword,
    sendPasswordResetEmail: mockSendPasswordResetEmail,
    signInWithPhoneNumber: mockSignInWithPhoneNumber,
    currentUser: mockCurrentUser,
    verifyPhoneNumber: jest.fn(() => Promise.resolve('test-verification-id')),
  });

  // Add PhoneAuthProvider as static property
  auth.PhoneAuthProvider = {
    PROVIDER_ID: 'phone',
    credential: jest.fn((verificationId, code) => ({
      providerId: 'phone',
      verificationId,
      code,
    })),
  };

  return auth;
});

// Export auth mocks for test assertions
global.mockSignInWithEmailAndPassword = mockSignInWithEmailAndPassword;
global.mockSignOut = mockSignOut;
global.mockOnAuthStateChanged = mockOnAuthStateChanged;
global.mockCreateUserWithEmailAndPassword = mockCreateUserWithEmailAndPassword;
global.mockSendPasswordResetEmail = mockSendPasswordResetEmail;
global.mockSignInWithPhoneNumber = mockSignInWithPhoneNumber;
global.mockCurrentUser = mockCurrentUser;

// ============================================================================
// Firebase Firestore Mock
// ============================================================================
const mockGetDoc = jest.fn(() =>
  Promise.resolve({
    exists: () => true,
    data: () => ({ id: 'test-doc', name: 'Test' }),
    id: 'test-doc',
  })
);
const mockGetDocs = jest.fn(() =>
  Promise.resolve({
    docs: [],
    empty: true,
    forEach: jest.fn(),
    size: 0,
  })
);
const mockSetDoc = jest.fn(() => Promise.resolve());
const mockUpdateDoc = jest.fn(() => Promise.resolve());
const mockDeleteDoc = jest.fn(() => Promise.resolve());
const mockAddDoc = jest.fn(() => Promise.resolve({ id: 'new-doc-id' }));
const mockOnSnapshot = jest.fn(callback => {
  // Return unsubscribe function
  return jest.fn();
});

const mockCollection = jest.fn(() => ({
  doc: jest.fn(),
}));
const mockDoc = jest.fn(() => ({
  get: mockGetDoc,
  set: mockSetDoc,
  update: mockUpdateDoc,
  delete: mockDeleteDoc,
}));
const mockQuery = jest.fn(() => ({}));
const mockWhere = jest.fn(() => ({}));
const mockOrderBy = jest.fn(() => ({}));
const mockLimit = jest.fn(() => ({}));
const mockStartAfter = jest.fn(() => ({}));
const mockOr = jest.fn((...queries) => ({}));
const mockAnd = jest.fn((...queries) => ({}));
const mockServerTimestamp = jest.fn(() => ({ _seconds: Date.now() / 1000, _nanoseconds: 0 }));
const mockIncrement = jest.fn(n => ({ _increment: n }));
const mockArrayUnion = jest.fn((...items) => ({ _arrayUnion: items }));
const mockTimestamp = {
  now: jest.fn(() => ({ _seconds: Date.now() / 1000, _nanoseconds: 0 })),
  fromDate: jest.fn(date => ({
    _seconds: date.getTime() / 1000,
    _nanoseconds: 0,
    toDate: () => date,
  })),
};
const mockGetFirestore = jest.fn(() => ({ collection: mockCollection, doc: mockDoc }));
const mockGetCountFromServer = jest.fn(() => Promise.resolve({ data: () => ({ count: 0 }) }));
const mockDocumentId = jest.fn(() => '__documentId__');
const mockWriteBatch = jest.fn(() => ({
  set: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  delete: jest.fn().mockReturnThis(),
  commit: jest.fn(() => Promise.resolve()),
}));

jest.mock('@react-native-firebase/firestore', () => {
  const firestore = () => ({
    collection: mockCollection,
    doc: mockDoc,
  });

  // Static methods (legacy API compatibility)
  firestore.FieldValue = {
    serverTimestamp: mockServerTimestamp,
    increment: mockIncrement,
    arrayUnion: mockArrayUnion,
    arrayRemove: jest.fn((...items) => ({ _arrayRemove: items })),
    delete: jest.fn(() => ({ _delete: true })),
  };

  // Named modular API exports
  firestore.getFirestore = mockGetFirestore;
  firestore.collection = mockCollection;
  firestore.doc = mockDoc;
  firestore.getDoc = mockGetDoc;
  firestore.getDocs = mockGetDocs;
  firestore.setDoc = mockSetDoc;
  firestore.updateDoc = mockUpdateDoc;
  firestore.deleteDoc = mockDeleteDoc;
  firestore.addDoc = mockAddDoc;
  firestore.query = mockQuery;
  firestore.where = mockWhere;
  firestore.orderBy = mockOrderBy;
  firestore.limit = mockLimit;
  firestore.startAfter = mockStartAfter;
  firestore.onSnapshot = mockOnSnapshot;
  firestore.serverTimestamp = mockServerTimestamp;
  firestore.Timestamp = mockTimestamp;
  firestore.increment = mockIncrement;
  firestore.arrayUnion = mockArrayUnion;
  firestore.writeBatch = mockWriteBatch;
  firestore.getCountFromServer = mockGetCountFromServer;
  firestore.documentId = mockDocumentId;
  firestore.or = mockOr;
  firestore.and = mockAnd;

  return firestore;
});

// Export firestore mocks for test assertions
global.mockGetDoc = mockGetDoc;
global.mockGetDocs = mockGetDocs;
global.mockSetDoc = mockSetDoc;
global.mockUpdateDoc = mockUpdateDoc;
global.mockDeleteDoc = mockDeleteDoc;
global.mockAddDoc = mockAddDoc;
global.mockOnSnapshot = mockOnSnapshot;
global.mockCollection = mockCollection;
global.mockDoc = mockDoc;
global.mockQuery = mockQuery;
global.mockWhere = mockWhere;
global.mockOrderBy = mockOrderBy;
global.mockLimit = mockLimit;
global.mockStartAfter = mockStartAfter;
global.mockOr = mockOr;
global.mockAnd = mockAnd;
global.mockServerTimestamp = mockServerTimestamp;
global.mockIncrement = mockIncrement;
global.mockArrayUnion = mockArrayUnion;
global.mockTimestamp = mockTimestamp;
global.mockGetFirestore = mockGetFirestore;
global.mockGetCountFromServer = mockGetCountFromServer;
global.mockDocumentId = mockDocumentId;
global.mockWriteBatch = mockWriteBatch;

// ============================================================================
// Firebase Storage Mock
// ============================================================================
const mockPutFile = jest.fn(() =>
  Promise.resolve({
    state: 'success',
    metadata: { fullPath: 'photos/test-photo.jpg' },
  })
);
const mockGetDownloadURL = jest.fn(() => Promise.resolve('https://mock-storage.com/photo.jpg'));
const mockStorageDelete = jest.fn(() => Promise.resolve());

const mockStorageRef = jest.fn(path => ({
  putFile: mockPutFile,
  getDownloadURL: mockGetDownloadURL,
  delete: mockStorageDelete,
  child: jest.fn(childPath => ({
    putFile: mockPutFile,
    getDownloadURL: mockGetDownloadURL,
    delete: mockStorageDelete,
  })),
}));

jest.mock('@react-native-firebase/storage', () => {
  return () => ({
    ref: mockStorageRef,
  });
});

// Export storage mocks for test assertions
global.mockPutFile = mockPutFile;
global.mockGetDownloadURL = mockGetDownloadURL;
global.mockStorageDelete = mockStorageDelete;
global.mockStorageRef = mockStorageRef;

// ============================================================================
// Firebase Functions Mock
// ============================================================================
const mockHttpsCallable = jest.fn(() => jest.fn(() => Promise.resolve({ data: {} })));

jest.mock('@react-native-firebase/functions', () => {
  return () => ({
    httpsCallable: mockHttpsCallable,
  });
});

global.mockHttpsCallable = mockHttpsCallable;

// ============================================================================
// Expo Modules Mocks
// ============================================================================

// expo-secure-store
const mockSecureStoreGetItemAsync = jest.fn(() => Promise.resolve(null));
const mockSecureStoreSetItemAsync = jest.fn(() => Promise.resolve());
const mockSecureStoreDeleteItemAsync = jest.fn(() => Promise.resolve());

jest.mock('expo-secure-store', () => ({
  getItemAsync: mockSecureStoreGetItemAsync,
  setItemAsync: mockSecureStoreSetItemAsync,
  deleteItemAsync: mockSecureStoreDeleteItemAsync,
  AFTER_FIRST_UNLOCK: 'AFTER_FIRST_UNLOCK',
}));

global.mockSecureStoreGetItemAsync = mockSecureStoreGetItemAsync;
global.mockSecureStoreSetItemAsync = mockSecureStoreSetItemAsync;
global.mockSecureStoreDeleteItemAsync = mockSecureStoreDeleteItemAsync;

// expo-haptics
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
  selectionAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: {
    Light: 'Light',
    Medium: 'Medium',
    Heavy: 'Heavy',
  },
  NotificationFeedbackType: {
    Success: 'Success',
    Warning: 'Warning',
    Error: 'Error',
  },
}));

// expo-notifications
const mockScheduleNotificationAsync = jest.fn(() => Promise.resolve('notification-id'));
const mockGetPermissionsAsync = jest.fn(() =>
  Promise.resolve({
    status: 'granted',
    canAskAgain: true,
    granted: true,
  })
);
const mockRequestPermissionsAsync = jest.fn(() =>
  Promise.resolve({
    status: 'granted',
    canAskAgain: true,
    granted: true,
  })
);
const mockGetExpoPushTokenAsync = jest.fn(() =>
  Promise.resolve({ data: 'ExponentPushToken[test-token]' })
);

jest.mock('expo-notifications', () => ({
  scheduleNotificationAsync: mockScheduleNotificationAsync,
  getPermissionsAsync: mockGetPermissionsAsync,
  requestPermissionsAsync: mockRequestPermissionsAsync,
  getExpoPushTokenAsync: mockGetExpoPushTokenAsync,
  setNotificationHandler: jest.fn(),
  addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  AndroidImportance: { MAX: 5 },
  setNotificationChannelAsync: jest.fn(() => Promise.resolve()),
}));

global.mockScheduleNotificationAsync = mockScheduleNotificationAsync;
global.mockGetPermissionsAsync = mockGetPermissionsAsync;
global.mockRequestPermissionsAsync = mockRequestPermissionsAsync;
global.mockGetExpoPushTokenAsync = mockGetExpoPushTokenAsync;

// expo-image-manipulator
jest.mock('expo-image-manipulator', () => ({
  manipulateAsync: jest.fn(() =>
    Promise.resolve({
      uri: 'file://manipulated-image.jpg',
      width: 1080,
      height: 1920,
    })
  ),
  SaveFormat: {
    JPEG: 'jpeg',
    PNG: 'png',
  },
}));

// expo-camera
jest.mock('expo-camera', () => ({
  Camera: {
    useCameraPermissions: jest.fn(() => [
      { granted: true, canAskAgain: true },
      jest.fn(() => Promise.resolve({ granted: true })),
    ]),
    Constants: {
      Type: { back: 'back', front: 'front' },
      FlashMode: { off: 'off', on: 'on', auto: 'auto' },
    },
  },
  CameraType: {
    back: 'back',
    front: 'front',
  },
  FlashMode: {
    off: 'off',
    on: 'on',
    auto: 'auto',
  },
}));

// expo-image-picker
jest.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: jest.fn(() =>
    Promise.resolve({
      canceled: false,
      assets: [{ uri: 'file://picked-image.jpg' }],
    })
  ),
  MediaTypeOptions: {
    Images: 'Images',
    Videos: 'Videos',
    All: 'All',
  },
}));

// @react-native-async-storage/async-storage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
  removeItem: jest.fn(() => Promise.resolve()),
  clear: jest.fn(() => Promise.resolve()),
  getAllKeys: jest.fn(() => Promise.resolve([])),
  multiGet: jest.fn(() => Promise.resolve([])),
  multiSet: jest.fn(() => Promise.resolve()),
  multiRemove: jest.fn(() => Promise.resolve()),
}));

// ============================================================================
// Firebase Performance Mock
// ============================================================================
const mockPerfTrace = {
  start: jest.fn(() => Promise.resolve()),
  stop: jest.fn(() => Promise.resolve()),
  putAttribute: jest.fn(),
  putMetric: jest.fn(),
};
const mockNewTrace = jest.fn(() => mockPerfTrace);
const mockSetPerformanceCollectionEnabled = jest.fn();

jest.mock('@react-native-firebase/perf', () => {
  return () => ({
    newTrace: mockNewTrace,
    setPerformanceCollectionEnabled: mockSetPerformanceCollectionEnabled,
  });
});

global.mockPerfTrace = mockPerfTrace;
global.mockNewTrace = mockNewTrace;
global.mockSetPerformanceCollectionEnabled = mockSetPerformanceCollectionEnabled;

// ============================================================================
// Service Module Mocks
// ============================================================================

// performanceService - withTrace wraps async operations, pass through in tests
const mockWithTrace = jest.fn((name, operation) =>
  operation({ putAttribute: jest.fn(), putMetric: jest.fn() })
);

jest.mock('../../src/services/firebase/performanceService', () => ({
  withTrace: mockWithTrace,
}));

global.mockWithTrace = mockWithTrace;

// ============================================================================
// React Native Reanimated Mock
// ============================================================================
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));

// ============================================================================
// React Navigation Mock
// ============================================================================
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: jest.fn(),
    goBack: jest.fn(),
    setOptions: jest.fn(),
    dispatch: jest.fn(),
    reset: jest.fn(),
    addListener: jest.fn(() => jest.fn()),
  }),
  useRoute: () => ({ params: {} }),
  useFocusEffect: jest.fn(),
  useIsFocused: () => true,
}));

// ============================================================================
// React Native Mocks
// ============================================================================

// Mock console.warn to suppress React Native specific warnings in tests
const originalWarn = console.warn;
console.warn = (...args) => {
  // Suppress known harmless warnings
  if (
    args[0]?.includes?.('Animated') ||
    args[0]?.includes?.('useNativeDriver') ||
    args[0]?.includes?.('Require cycle')
  ) {
    return;
  }
  originalWarn(...args);
};

// ============================================================================
// Global Test Utilities
// ============================================================================

// Clear all mocks before each test for clean isolation
beforeEach(() => {
  jest.clearAllMocks();
});
