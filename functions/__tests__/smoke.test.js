describe('Cloud Functions Test Infrastructure', () => {
  it('should have mocks configured correctly', () => {
    const admin = require('firebase-admin');
    const { FieldValue, Timestamp } = require('firebase-admin/firestore');
    expect(admin.initializeApp).toBeDefined();
    expect(FieldValue.serverTimestamp).toBeDefined();
    expect(Timestamp.now).toBeDefined();
  });

  it('should mock expo-server-sdk correctly', () => {
    const { Expo } = require('expo-server-sdk');
    expect(Expo.isExpoPushToken).toBeDefined();
    expect(Expo.isExpoPushToken('ExponentPushToken[abc123]')).toBe(true);
    expect(Expo.isExpoPushToken('invalid')).toBe(false);
  });

  it('should be able to require logger without errors', () => {
    const logger = require('../logger');
    expect(logger.debug).toBeDefined();
    expect(logger.info).toBeDefined();
    expect(logger.warn).toBeDefined();
    expect(logger.error).toBeDefined();
  });
});
