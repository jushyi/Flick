const { Expo } = require('expo-server-sdk');

// Mock receipts module before requiring sender
jest.mock('../../notifications/receipts', () => ({
  storePendingReceipt: jest.fn().mockResolvedValue(),
}));

const {
  sendPushNotification,
  sendBatchNotifications,
  expo,
} = require('../../notifications/sender');
const { storePendingReceipt } = require('../../notifications/receipts');

const VALID_TOKEN = 'ExponentPushToken[abc123]';
const INVALID_TOKEN = 'not-a-valid-token';

describe('sendPushNotification', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset default mock for sendPushNotificationsAsync
    expo.sendPushNotificationsAsync.mockResolvedValue([{ status: 'ok', id: 'receipt-123' }]);
  });

  it('should successfully send notification with valid Expo push token', async () => {
    const result = await sendPushNotification(VALID_TOKEN, 'Test Title', 'Test Body', {
      screen: 'Feed',
    });

    expect(result.success).toBe(true);
    expect(result.tickets).toEqual([{ status: 'ok', id: 'receipt-123' }]);
    expect(expo.sendPushNotificationsAsync).toHaveBeenCalledWith([
      {
        to: VALID_TOKEN,
        sound: 'default',
        title: 'Test Title',
        body: 'Test Body',
        data: { screen: 'Feed' },
        priority: 'high',
        channelId: 'default',
      },
    ]);
  });

  it('should return error for invalid token', async () => {
    const result = await sendPushNotification(INVALID_TOKEN, 'Title', 'Body');

    expect(result.success).toBe(false);
    expect(result.error).toBe('Invalid token format');
    expect(expo.sendPushNotificationsAsync).not.toHaveBeenCalled();
  });

  it('should store pending receipt when userId is provided and ticket status is ok', async () => {
    await sendPushNotification(VALID_TOKEN, 'Title', 'Body', {}, 'user-123');

    // storePendingReceipt is called fire-and-forget, so we need to flush promises
    await new Promise(resolve => setImmediate(resolve));

    expect(storePendingReceipt).toHaveBeenCalledWith('receipt-123', 'user-123', VALID_TOKEN);
  });

  it('should NOT store receipt when userId is null', async () => {
    await sendPushNotification(VALID_TOKEN, 'Title', 'Body', {}, null);

    await new Promise(resolve => setImmediate(resolve));

    expect(storePendingReceipt).not.toHaveBeenCalled();
  });

  it('should NOT store receipt when ticket status is not ok', async () => {
    expo.sendPushNotificationsAsync.mockResolvedValue([
      { status: 'error', message: 'DeviceNotRegistered' },
    ]);

    await sendPushNotification(VALID_TOKEN, 'Title', 'Body', {}, 'user-123');

    await new Promise(resolve => setImmediate(resolve));

    expect(storePendingReceipt).not.toHaveBeenCalled();
  });

  it('should handle expo SDK error gracefully', async () => {
    expo.sendPushNotificationsAsync.mockRejectedValue(new Error('Network error'));

    const result = await sendPushNotification(VALID_TOKEN, 'Title', 'Body');

    expect(result.success).toBe(false);
    expect(result.error).toBe('Network error');
  });
});

describe('sendBatchNotifications', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset default mocks
    expo.sendPushNotificationsAsync.mockResolvedValue([{ status: 'ok', id: 'receipt-batch' }]);
    expo.chunkPushNotifications.mockImplementation(msgs => [msgs]);
  });

  it('should send batch with valid tokens', async () => {
    const messages = [
      { to: 'ExponentPushToken[user1]', title: 'Hello', body: 'World' },
      { to: 'ExponentPushToken[user2]', title: 'Hi', body: 'There' },
    ];

    const tickets = await sendBatchNotifications(messages);

    expect(tickets).toEqual([{ status: 'ok', id: 'receipt-batch' }]);
    expect(expo.chunkPushNotifications).toHaveBeenCalled();
    expect(expo.sendPushNotificationsAsync).toHaveBeenCalledTimes(1);

    // Check that default properties were added
    const sentChunk = expo.sendPushNotificationsAsync.mock.calls[0][0];
    expect(sentChunk[0]).toMatchObject({
      to: 'ExponentPushToken[user1]',
      sound: 'default',
      priority: 'high',
      channelId: 'default',
    });
    expect(sentChunk[1]).toMatchObject({
      to: 'ExponentPushToken[user2]',
      sound: 'default',
      priority: 'high',
      channelId: 'default',
    });
  });

  it('should filter out invalid tokens from batch', async () => {
    const messages = [
      { to: 'ExponentPushToken[valid]', title: 'Valid', body: 'Message' },
      { to: 'invalid-token', title: 'Invalid', body: 'Message' },
    ];

    await sendBatchNotifications(messages);

    // Only valid message should be chunked
    const chunkedMessages = expo.chunkPushNotifications.mock.calls[0][0];
    expect(chunkedMessages).toHaveLength(1);
    expect(chunkedMessages[0].to).toBe('ExponentPushToken[valid]');
  });

  it('should return empty array when all tokens are invalid', async () => {
    const messages = [
      { to: 'invalid-1', title: 'Bad', body: 'Token' },
      { to: 'invalid-2', title: 'Also Bad', body: 'Token' },
    ];

    const tickets = await sendBatchNotifications(messages);

    expect(tickets).toEqual([]);
    expect(expo.sendPushNotificationsAsync).not.toHaveBeenCalled();
  });

  it('should handle chunk send error gracefully and continue with remaining chunks', async () => {
    // Return two chunks
    expo.chunkPushNotifications.mockImplementation(msgs => {
      const mid = Math.ceil(msgs.length / 2);
      return [msgs.slice(0, mid), msgs.slice(mid)];
    });

    // First chunk fails, second succeeds
    expo.sendPushNotificationsAsync
      .mockRejectedValueOnce(new Error('Chunk 1 failed'))
      .mockResolvedValueOnce([{ status: 'ok', id: 'chunk-2-receipt' }]);

    const messages = [
      { to: 'ExponentPushToken[user1]', title: 'Msg 1', body: 'Body 1' },
      { to: 'ExponentPushToken[user2]', title: 'Msg 2', body: 'Body 2' },
    ];

    const tickets = await sendBatchNotifications(messages);

    // Only second chunk's tickets should be in result
    expect(tickets).toEqual([{ status: 'ok', id: 'chunk-2-receipt' }]);
    expect(expo.sendPushNotificationsAsync).toHaveBeenCalledTimes(2);
  });

  it('should add default properties (sound, priority, channelId) to messages', async () => {
    const messages = [{ to: 'ExponentPushToken[user1]', title: 'Test', body: 'Defaults' }];

    await sendBatchNotifications(messages);

    const chunkedMessages = expo.chunkPushNotifications.mock.calls[0][0];
    expect(chunkedMessages[0]).toEqual({
      to: 'ExponentPushToken[user1]',
      title: 'Test',
      body: 'Defaults',
      sound: 'default',
      priority: 'high',
      channelId: 'default',
    });
  });
});
