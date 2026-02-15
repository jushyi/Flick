# Future Features

Tracking ideas and planned features for Flick.

---

## Admin Panel + User Response System

**Priority:** Medium
**Related:** Help & Support, Report User

Build a lightweight admin web app (hosted on Firebase Hosting) that allows responding to user support requests and reports. When a response is written, the user receives an in-app notification and push notification.

### How it would work

1. Admin web app queries `supportRequests` and `reports` collections from Firestore
2. Displays pending requests/reports in a list with user details and message
3. Admin writes a response in a text box, which updates the document with a `response` field
4. A Firestore `onUpdate` Cloud Function triggers when a response is added:
   - Creates a notification in the `notifications` collection for the user
   - Sends a push notification via existing FCM infrastructure
5. User sees the response in their Activity screen or via push notification

### Tech approach

- React web app on Firebase Hosting
- Protected with Firebase Auth (admin account only)
- Uses existing notification + push infrastructure (no new backend needed)
- Covers both `supportRequests` and `reports` collections
