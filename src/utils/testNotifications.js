import * as Notifications from 'expo-notifications';

/**
 * Test notification navigation by scheduling local notifications
 * These can be used to test deep linking without backend
 */

export const testPhotoRevealNotification = async () => {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: '📸 Photos Ready!',
      body: 'Your photos are ready to view in the darkroom',
      data: {
        type: 'photo_reveal',
      },
    },
    trigger: {
      type: 'timeInterval',
      seconds: 3,
    },
  });
  console.log('Photo reveal notification scheduled for 3 seconds');
};

export const testFriendRequestNotification = async () => {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: '👋 Friend Request',
      body: 'Someone sent you a friend request',
      data: {
        type: 'friend_request',
        friendshipId: 'test-friendship-id',
      },
    },
    trigger: {
      type: 'timeInterval',
      seconds: 3,
    },
  });
  console.log('Friend request notification scheduled for 3 seconds');
};

export const testReactionNotification = async () => {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: '❤️ New Reaction',
      body: 'Someone reacted to your photo',
      data: {
        type: 'reaction',
        photoId: 'test-photo-id',
      },
    },
    trigger: {
      type: 'timeInterval',
      seconds: 3,
    },
  });
  console.log('Reaction notification scheduled for 3 seconds');
};

export const testAllNotifications = async () => {
  // Schedule all three notification types with delays
  await testPhotoRevealNotification();

  setTimeout(async () => {
    await testFriendRequestNotification();
  }, 1000);

  setTimeout(async () => {
    await testReactionNotification();
  }, 2000);

  console.log('All test notifications scheduled!');
};
