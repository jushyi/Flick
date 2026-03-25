/**
 * Notification templates for Flick push notifications.
 * Ported from Firebase Cloud Functions (functions/index.js + tasks/sendBatchedNotification.js).
 * All templates match the existing copy exactly.
 */

/**
 * Pick a random template from an array of strings.
 */
export function getRandomTemplate(templates: string[]): string {
  return templates[Math.floor(Math.random() * templates.length)];
}

/** Data passed to buildNotification for template interpolation. */
interface NotificationData {
  senderName?: string;
  otherName?: string; // for streak warnings
  count?: number;
  preview?: string; // comment text preview
  emoji?: string; // reaction summary (e.g. "heart-eyesx2 firex1")
  messageText?: string;
  type?: string; // sub-type for messages (reaction, tagged_photo, text)
  [key: string]: unknown;
}

/** The title + body content for a push notification. */
export interface NotificationContent {
  title: string;
  body: string;
}

/**
 * Build notification title + body for a given event type.
 * Templates are identical to the Cloud Functions originals.
 */
export function buildNotification(
  eventType: string,
  data: NotificationData
): NotificationContent {
  switch (eventType) {
    case 'photo_reveal':
      return {
        title: 'Flick',
        body:
          data.count && data.count > 1
            ? `Your ${data.count} photos are ready to reveal!`
            : 'Your photo is ready to reveal!',
      };

    case 'friend_request':
      return {
        title: data.senderName ?? 'Someone',
        body: 'sent you a friend request',
      };

    case 'friend_accept':
      return {
        title: data.senderName ?? 'Someone',
        body: 'accepted your friend request',
      };

    case 'comment':
      return {
        title: data.senderName ?? 'Someone',
        body: `commented on your photo: ${(data.preview ?? '').slice(0, 50)}`,
      };

    case 'tag':
      return {
        title: data.senderName ?? 'Someone',
        body: getRandomTemplate([
          'tagged you in a photo',
          'added you to their latest snap',
          'included you in a moment',
          'got you in their photo',
          'captured you!',
        ]),
      };

    case 'tag_batch':
      return {
        title: data.senderName ?? 'Someone',
        body: getRandomTemplate([
          `tagged you in ${data.count} photos`,
          `added you to ${data.count} of their snaps`,
          `included you in ${data.count} moments`,
        ]),
      };

    case 'snap':
      return {
        title: data.senderName ?? 'Someone',
        body: getRandomTemplate([
          'sent you a snap',
          'just snapped you',
          'New snap',
        ]),
      };

    case 'pinned_snap':
      return {
        title: data.senderName ?? 'Someone',
        body: 'pinned a snap to your screen',
      };

    case 'reaction_batch':
      return {
        title: data.senderName ?? 'Someone',
        body: `reacted ${data.emoji ?? ''} to your photo`,
      };

    case 'streak_warning':
      return {
        title: 'Flick',
        body: getRandomTemplate([
          `Your streak with ${data.otherName} is about to expire!`,
          `Don't let your streak with ${data.otherName} die!`,
          `Quick -- snap ${data.otherName} before your streak ends!`,
        ]),
      };

    case 'new_message':
      if (data.type === 'reaction') {
        return {
          title: data.senderName ?? 'Someone',
          body: 'Reacted',
        };
      }
      if (data.type === 'tagged_photo') {
        return {
          title: data.senderName ?? 'Someone',
          body: 'Tagged you in a photo',
        };
      }
      return {
        title: data.senderName ?? 'Someone',
        body: (data.messageText ?? '').slice(0, 100) || 'Sent you a message',
      };

    case 'system_screenshot':
      return {
        title: data.senderName ?? 'Someone',
        body: data.messageText ?? 'Someone screenshotted a snap',
      };

    case 'deletion_reminder':
      return {
        title: 'Flick',
        body: "Your account will be permanently deleted in 3 days. Log in to cancel if you've changed your mind.",
      };

    case 'cancel_pinned_snap':
      // Silent notification to dismiss Live Activity -- empty body
      return { title: 'Flick', body: '' };

    default:
      return { title: 'Flick', body: 'You have a new notification' };
  }
}
