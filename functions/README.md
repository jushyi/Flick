# Firebase Cloud Functions - Lapse Clone

This directory contains Firebase Cloud Functions for sending push notifications.

## Functions

### 1. sendPhotoRevealNotification
**Trigger:** Firestore `darkrooms/{userId}` document update
**Purpose:** Sends notification when photos are revealed in darkroom
**Notification Type:** `photo_reveal`
**Navigation:** Darkroom tab

### 2. sendFriendRequestNotification
**Trigger:** Firestore `friendships/{friendshipId}` document create
**Purpose:** Sends notification when friend request is received
**Notification Type:** `friend_request`
**Navigation:** Friends → FriendRequests screen

### 3. sendReactionNotification
**Trigger:** Firestore `photos/{photoId}` document update
**Purpose:** Sends notification when someone reacts to your photo
**Notification Type:** `reaction`
**Navigation:** Feed tab

## Setup

### Prerequisites
- Firebase CLI installed: `npm install -g firebase-tools`
- Firebase project initialized
- Logged in to Firebase: `firebase login`

### Installation
```bash
cd functions
npm install
```

### Deployment
```bash
# Deploy all functions
firebase deploy --only functions

# Deploy specific function
firebase deploy --only functions:sendPhotoRevealNotification
firebase deploy --only functions:sendFriendRequestNotification
firebase deploy --only functions:sendReactionNotification
```

### Local Testing
```bash
# Start Firebase emulator
firebase emulators:start --only functions

# View function logs
firebase functions:log
```

## Push Notification Flow

1. **Event occurs in app** (photo revealed, friend request sent, reaction added)
2. **Cloud Function triggered** by Firestore document change
3. **Function fetches user's FCM token** from `users/{userId}/fcmToken`
4. **Function sends notification** via Expo Push Notification service
5. **User's device receives notification**
6. **User taps notification** → App navigates to relevant screen

## Notification Payload Format

All notifications include:
- **title** - Notification title (e.g., "📸 Photos Ready!")
- **body** - Notification message
- **data** - Deep linking data:
  - `type` - Notification type (`photo_reveal`, `friend_request`, `reaction`)
  - Additional context (e.g., `photoId`, `friendshipId`)

## Error Handling

Functions handle these scenarios gracefully:
- User has no FCM token → Skip notification (logs warning)
- User document doesn't exist → Skip notification (logs error)
- Invalid token format → Skip notification (logs error)
- Network errors → Logged, function returns null

## Monitoring

View function logs in Firebase Console:
1. Go to Firebase Console → Functions
2. Click on function name
3. View "Logs" tab

Or use CLI:
```bash
firebase functions:log
```

## Dependencies

- `firebase-admin` - Firebase Admin SDK for server-side operations
- `firebase-functions` - Cloud Functions SDK
- `firebase-functions-test` - Testing utilities (dev dependency)

## Notes

- Functions use Expo Push Notification service (https://exp.host/--/api/v2/push/send)
- Expo Push Tokens start with "ExponentPushToken["
- All functions return null on success/error (Cloud Functions best practice)
- Console logs are available in Firebase Console for debugging
