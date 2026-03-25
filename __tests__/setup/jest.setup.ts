/**
 * Jest Setup File
 *
 * Configures all mocks before each test file runs.
 * Supabase and Sentry modules are mocked here to prevent native module errors.
 *
 * CRITICAL: Mock functions are defined OUTSIDE jest.mock() calls
 * and then referenced inside. This prevents "Cannot read property
 * 'mockResolvedValue' of undefined" errors.
 */

// ============================================================================
// Supabase Client Mock
// ============================================================================
const mockSupabaseAuth = {
  signInWithOtp: jest.fn().mockResolvedValue({ data: {}, error: null }),
  verifyOtp: jest
    .fn()
    .mockResolvedValue({ data: { user: { id: 'test-uid' } }, error: null }),
  signOut: jest.fn().mockResolvedValue({ error: null }),
  getSession: jest
    .fn()
    .mockResolvedValue({ data: { session: null }, error: null }),
  setSession: jest.fn().mockResolvedValue({ data: { session: null }, error: null }),
  onAuthStateChange: jest
    .fn()
    .mockReturnValue({ data: { subscription: { unsubscribe: jest.fn() } } }),
  getUser: jest.fn().mockResolvedValue({ data: { user: null }, error: null }),
};

const mockSupabaseStorageBucket = {
  upload: jest
    .fn()
    .mockResolvedValue({ data: { path: 'test/path' }, error: null }),
  getPublicUrl: jest.fn().mockReturnValue({
    data: { publicUrl: 'https://test.supabase.co/storage/test' },
  }),
  createSignedUrl: jest.fn().mockResolvedValue({
    data: { signedUrl: 'https://test.supabase.co/signed' },
    error: null,
  }),
  remove: jest.fn().mockResolvedValue({ data: null, error: null }),
  list: jest.fn().mockResolvedValue({ data: [], error: null }),
};

const mockSupabaseStorage = {
  from: jest.fn(() => mockSupabaseStorageBucket),
};

const mockSupabaseFunctions = {
  invoke: jest.fn().mockResolvedValue({ data: {}, error: null }),
};

const mockSupabaseFrom = jest.fn(() => ({
  select: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  delete: jest.fn().mockReturnThis(),
  upsert: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  neq: jest.fn().mockReturnThis(),
  in: jest.fn().mockReturnThis(),
  order: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  single: jest.fn().mockResolvedValue({ data: null, error: null }),
  maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
}));

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    auth: mockSupabaseAuth,
    storage: mockSupabaseStorage,
    functions: mockSupabaseFunctions,
    from: mockSupabaseFrom,
    rpc: jest.fn().mockResolvedValue({ data: null, error: null }),
    channel: jest.fn(() => ({
      on: jest.fn().mockReturnThis(),
      subscribe: jest.fn().mockReturnValue({ unsubscribe: jest.fn() }),
    })),
  })),
}));

// Export Supabase mocks for test access
(global as any).__supabaseMocks = {
  auth: mockSupabaseAuth,
  storage: mockSupabaseStorage,
  storageBucket: mockSupabaseStorageBucket,
  functions: mockSupabaseFunctions,
  from: mockSupabaseFrom,
};

// ============================================================================
// Sentry Mock
// ============================================================================
const mockSentryInit = jest.fn();
const mockSentrySetUser = jest.fn();
const mockSentryStartSpan = jest.fn(
  (_options: any, callback: (span: any) => any) => {
    return callback({ setAttribute: jest.fn(), setStatus: jest.fn() });
  }
);
const mockSentryStartInactiveSpan = jest.fn(() => ({
  end: jest.fn(),
  setAttribute: jest.fn(),
  setStatus: jest.fn(),
}));
const mockSentryCaptureException = jest.fn();
const mockSentryCaptureMessage = jest.fn();
const mockSentryAddBreadcrumb = jest.fn();

jest.mock('@sentry/react-native', () => ({
  init: mockSentryInit,
  setUser: mockSentrySetUser,
  startSpan: mockSentryStartSpan,
  startInactiveSpan: mockSentryStartInactiveSpan,
  captureException: mockSentryCaptureException,
  captureMessage: mockSentryCaptureMessage,
  addBreadcrumb: mockSentryAddBreadcrumb,
  reactNavigationIntegration: jest.fn(() => ({
    registerNavigationContainer: jest.fn(),
  })),
  reactNativeTracingIntegration: jest.fn(() => ({})),
  mobileReplayIntegration: jest.fn(() => ({})),
  feedbackIntegration: jest.fn(() => ({})),
  wrap: jest.fn((component: any) => component),
  Severity: {
    Fatal: 'fatal',
    Error: 'error',
    Warning: 'warning',
    Info: 'info',
    Debug: 'debug',
  },
}));

(global as any).__sentryMocks = {
  init: mockSentryInit,
  setUser: mockSentrySetUser,
  startSpan: mockSentryStartSpan,
  startInactiveSpan: mockSentryStartInactiveSpan,
  captureException: mockSentryCaptureException,
  captureMessage: mockSentryCaptureMessage,
  addBreadcrumb: mockSentryAddBreadcrumb,
};

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

(global as any).mockSecureStoreGetItemAsync = mockSecureStoreGetItemAsync;
(global as any).mockSecureStoreSetItemAsync = mockSecureStoreSetItemAsync;
(global as any).mockSecureStoreDeleteItemAsync = mockSecureStoreDeleteItemAsync;

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
const mockScheduleNotificationAsync = jest.fn(() =>
  Promise.resolve('notification-id')
);
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
  addNotificationResponseReceivedListener: jest.fn(() => ({
    remove: jest.fn(),
  })),
  AndroidImportance: { MAX: 5 },
  setNotificationChannelAsync: jest.fn(() => Promise.resolve()),
}));

(global as any).mockScheduleNotificationAsync = mockScheduleNotificationAsync;
(global as any).mockGetPermissionsAsync = mockGetPermissionsAsync;
(global as any).mockRequestPermissionsAsync = mockRequestPermissionsAsync;
(global as any).mockGetExpoPushTokenAsync = mockGetExpoPushTokenAsync;

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
    WEBP: 'webp',
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
  useCameraPermissions: jest.fn(() => [
    { granted: true, canAskAgain: true },
    jest.fn(() => Promise.resolve({ granted: true })),
  ]),
  useMicrophonePermissions: jest.fn(() => [
    { granted: true, canAskAgain: true },
    jest.fn(() => Promise.resolve({ granted: true })),
  ]),
  CameraView: 'CameraView',
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

// expo-screen-capture
const mockAddScreenshotListener = jest.fn(() => ({ remove: jest.fn() }));

jest.mock('expo-screen-capture', () => ({
  addScreenshotListener: mockAddScreenshotListener,
  usePreventScreenCapture: jest.fn(),
  preventScreenCaptureAsync: jest.fn(() => Promise.resolve()),
  allowScreenCaptureAsync: jest.fn(() => Promise.resolve()),
}));

(global as any).mockAddScreenshotListener = mockAddScreenshotListener;

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
// React Native Reanimated Mock
// ============================================================================
jest.mock('react-native-reanimated', () =>
  require('react-native-reanimated/mock')
);

// ============================================================================
// React Native Gesture Handler Mock
// ============================================================================
jest.mock('react-native-gesture-handler', () => {
  const View = require('react-native').View;
  return {
    GestureDetector: ({ children }: any) => children,
    Gesture: {
      Pan: () => ({
        activeOffsetX: () => ({
          failOffsetY: () => ({
            onStart: function onStart() {
              return this;
            },
            onUpdate: function onUpdate() {
              return this;
            },
            onEnd: function onEnd() {
              return this;
            },
            onFinalize: function onFinalize() {
              return this;
            },
          }),
        }),
      }),
    },
    GestureHandlerRootView: View,
    PanGestureHandler: View,
    TapGestureHandler: View,
    State: {},
    Directions: {},
  };
});

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
console.warn = (...args: any[]) => {
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
// expo-video Mock
// ============================================================================
const mockVideoPlayer = {
  play: jest.fn(),
  pause: jest.fn(),
  release: jest.fn(),
  replace: jest.fn(),
  seekBy: jest.fn(),
  replay: jest.fn(),
  muted: true,
  loop: false,
  currentTime: 0,
  duration: 0,
  playing: false,
  generateThumbnailsAsync: jest.fn(() =>
    Promise.resolve([{ uri: 'file://video-thumbnail.jpg' }])
  ),
  addListener: jest.fn(() => ({ remove: jest.fn() })),
};

const mockCreateVideoPlayer = jest.fn(() => mockVideoPlayer);

jest.mock('expo-video', () => ({
  __esModule: true,
  VideoView: 'VideoView',
  useVideoPlayer: jest.fn((source: any, setup: any) => {
    if (setup) setup(mockVideoPlayer);
    return mockVideoPlayer;
  }),
  createVideoPlayer: mockCreateVideoPlayer,
  isPictureInPictureSupported: jest.fn(() => Promise.resolve(false)),
}));

(global as any).mockVideoPlayer = mockVideoPlayer;
(global as any).mockCreateVideoPlayer = mockCreateVideoPlayer;

// ============================================================================
// expo Mock (useEvent hook used with expo-video)
// ============================================================================
jest.mock('expo', () => ({
  __esModule: true,
  useEvent: jest.fn(
    (_target: any, _eventName: string, initialValue: any) => initialValue || {}
  ),
}));

// ============================================================================
// expo-file-system/legacy Mock
// ============================================================================
const mockReadAsStringAsync = jest.fn(() =>
  Promise.resolve('bW9ja0Jhc2U2NERhdGE=')
);

jest.mock('expo-file-system/legacy', () => ({
  readAsStringAsync: mockReadAsStringAsync,
  EncodingType: {
    Base64: 'base64',
    UTF8: 'utf8',
  },
  documentDirectory: 'file:///mock-document-dir/',
  cacheDirectory: 'file:///mock-cache-dir/',
}));

(global as any).mockReadAsStringAsync = mockReadAsStringAsync;

// ============================================================================
// base64-arraybuffer Mock
// ============================================================================
jest.mock('base64-arraybuffer', () => ({
  decode: jest.fn((base64: string) => new ArrayBuffer(base64.length)),
  encode: jest.fn(() => 'bW9ja0Jhc2U2NERhdGE='),
}));

// ============================================================================
// Legacy Firebase Global Mocks (backward compatibility for .js tests)
// ============================================================================
// Old .js tests reference global.mockGetDoc, global.mockSignInWithEmailAndPassword, etc.
// These are populated from the manual mock files in __tests__/__mocks__/@react-native-firebase/
// and will be removed once all .js tests are converted to .ts with Supabase mocks.

try {
  const firestoreMock = require('../__mocks__/@react-native-firebase/firestore');
  (global as any).mockGetDoc = firestoreMock.mockGetDoc;
  (global as any).mockGetDocs = firestoreMock.mockGetDocs;
  (global as any).mockSetDoc = firestoreMock.mockSetDoc;
  (global as any).mockUpdateDoc = firestoreMock.mockUpdateDoc;
  (global as any).mockDeleteDoc = firestoreMock.mockDeleteDoc;
  (global as any).mockAddDoc = firestoreMock.mockAddDoc;
  (global as any).mockOnSnapshot = firestoreMock.mockOnSnapshot;
  (global as any).mockCollection = firestoreMock.mockCollection;
  (global as any).mockDoc = firestoreMock.mockDoc;
  (global as any).mockQuery = firestoreMock.mockQuery;
  (global as any).mockWhere = firestoreMock.mockWhere;
  (global as any).mockOrderBy = firestoreMock.mockOrderBy;
  (global as any).mockLimit = firestoreMock.mockLimit;
  (global as any).mockOr = firestoreMock.mockOr;
  (global as any).mockStartAfter = firestoreMock.mockStartAfter;
  (global as any).mockServerTimestamp = firestoreMock.mockServerTimestamp;
  (global as any).mockTimestamp = firestoreMock.mockTimestamp;
  (global as any).mockGetFirestore =
    firestoreMock.getFirestore || jest.fn(() => ({ collection: firestoreMock.mockCollection, doc: firestoreMock.mockDoc }));
  (global as any).mockGetCountFromServer = jest.fn(() => Promise.resolve({ data: () => ({ count: 0 }) }));
  (global as any).mockDocumentId = jest.fn(() => '__documentId__');
  (global as any).mockWriteBatch = jest.fn(() => ({
    set: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    commit: jest.fn(() => Promise.resolve()),
  }));
  (global as any).mockIncrement = jest.fn((n: number) => ({ _increment: n }));
  (global as any).mockArrayUnion = jest.fn((...items: any[]) => ({ _arrayUnion: items }));
  (global as any).mockAnd = jest.fn((..._queries: any[]) => ({}));
} catch {
  // Firebase mocks not available - ok for Supabase-only test runs
}

try {
  const authMock = require('../__mocks__/@react-native-firebase/auth');
  (global as any).mockSignInWithEmailAndPassword = authMock.mockSignInWithEmailAndPassword;
  (global as any).mockSignOut = authMock.mockSignOut;
  (global as any).mockOnAuthStateChanged = authMock.mockOnAuthStateChanged;
  (global as any).mockCreateUserWithEmailAndPassword = authMock.mockCreateUserWithEmailAndPassword;
  (global as any).mockSendPasswordResetEmail = authMock.mockSendPasswordResetEmail;
  (global as any).mockSignInWithPhoneNumber = authMock.mockSignInWithPhoneNumber;
  (global as any).mockCurrentUser = authMock.mockCurrentUser;
} catch {
  // Firebase auth mock not available
}

try {
  const storageMock = require('../__mocks__/@react-native-firebase/storage');
  (global as any).mockPutFile = storageMock.mockPutFile;
  (global as any).mockGetDownloadURL = storageMock.mockGetDownloadURL;
  (global as any).mockStorageDelete = storageMock.mockStorageDelete;
  (global as any).mockStorageRef = storageMock.mockStorageRef;
} catch {
  // Firebase storage mock not available
}

try {
  const functionsMock = require('../__mocks__/@react-native-firebase/functions');
  (global as any).mockHttpsCallable = functionsMock.mockHttpsCallable;
} catch {
  // Firebase functions mock not available
}

try {
  const perfMock = require('../__mocks__/@react-native-firebase/perf');
  (global as any).mockPerfTrace = perfMock.mockPerfTrace;
  (global as any).mockStartTrace = perfMock.mockStartTrace;
  (global as any).mockSetPerformanceCollectionEnabled = perfMock.mockSetPerformanceCollectionEnabled;
  (global as any).mockGetPerformance = perfMock.mockGetPerformance;
} catch {
  // Firebase perf mock not available
}

// ============================================================================
// Legacy performanceService global (for old .js tests)
// ============================================================================
try {
  const perfServiceMock = require('../__mocks__/performanceService');
  (global as any).mockWithTrace = perfServiceMock.mockWithTrace;
} catch {
  // performanceService mock not available
}

// ============================================================================
// Global Test Utilities
// ============================================================================

// Clear all mocks before each test for clean isolation
beforeEach(() => {
  jest.clearAllMocks();
});
