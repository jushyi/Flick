/**
 * Mock for @react-native-firebase/messaging
 */
const messaging = () => ({
  getToken: jest.fn(() => Promise.resolve('mock-fcm-token')),
  deleteToken: jest.fn(() => Promise.resolve()),
  onMessage: jest.fn(() => jest.fn()),
  onNotificationOpenedApp: jest.fn(() => jest.fn()),
  getInitialNotification: jest.fn(() => Promise.resolve(null)),
  requestPermission: jest.fn(() => Promise.resolve(1)),
  hasPermission: jest.fn(() => Promise.resolve(1)),
  subscribeToTopic: jest.fn(() => Promise.resolve()),
  unsubscribeFromTopic: jest.fn(() => Promise.resolve()),
});

messaging.AuthorizationStatus = {
  NOT_DETERMINED: -1,
  DENIED: 0,
  AUTHORIZED: 1,
  PROVISIONAL: 2,
};

module.exports = {
  __esModule: true,
  default: messaging,
};
