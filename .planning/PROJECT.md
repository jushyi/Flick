# Auth & Profile Refactor

## What This Is

A social photo-sharing app (Lapse Clone / REWIND) with complete dark-themed authentication, comprehensive profile system, full push notification infrastructure, photo tagging, and security-hardened backend. Features include Selects banner slideshows, iTunes profile songs, user-created albums, monthly photo archives, mutual friend suggestions, in-app notification banners, and a polished notification activity feed with deep linking.

## Core Value

All three areas (login/signup flow, profile creation onboarding, profile screen) must be solid and functional — the app's first impression and personal identity depend on it.

## Requirements

### Validated

- Phone-based authentication via Firebase Auth — existing
- Camera & photo capture system — existing
- Darkroom reveal system — existing
- Feed with server-side friend filtering — existing
- Photo reactions system — existing
- Friend/friendship system — existing
- Login screen refactor — v1.6 (dark theme matching Camera/Feed/Darkroom aesthetic)
- Signup flow refactor — v1.6 (consistent styling, clear step progression)
- Profile creation onboarding — v1.6 (full setup flow with username, display name, photo, bio, Selects, song)
- Profile screen: Selects banner — v1.6 (user-selected photos in quick slideshow with edit capability)
- Profile screen: Profile info — v1.6 (photo, display name, username, short bio)
- Profile screen: Profile song — v1.6 (iTunes 30s previews with clip selection)
- Profile screen: User-created albums — v1.6 (horizontal scroll bar, full CRUD, photo viewer)
- Profile screen: Auto-generated monthly albums — v1.6 (all user photos by month with grid view)
- Friend suggestions via contacts sync — v1.6
- Block/report users — v1.6
- Edit profile — v1.6 (display name, username, bio, profile photo)
- Photo deletion & archiving — v1.6 (soft delete with 30-day recovery)
- Account deletion with 30-day grace period — v1.6
- Content visibility duration — v1.6 (7-day stories, 1-day feed)
- Color constants standardization — v1.6 (centralized theme system)
- Nested reply comments — v1.6 (@mention threading)
- Empty feed state guidance — v1.6 (contextual prompts)
- Own snaps in stories bar — v1.6 (with disabled self-reactions)
- Split activity into notifications & friends — v1.6
- Push notifications with Cloud Functions — v0.9.0 (expo-server-sdk, receipt checking, token refresh)
- Notification settings UI — v0.9.0 (master toggle + per-type toggles)
- Social notification events — v0.9.0 (likes, comments, @mentions, friend accepted)
- Story & photo tag notifications — v0.9.0 (Cloud Functions with debounce batching)
- In-app notification banner — v0.9.0 (custom dark-themed slide animation)
- Notification activity feed — v0.9.0 (reaction clumping, time grouping, deep linking)
- Photo tagging in darkroom & feed — v0.9.0 (multi-select, tag removal cancellation)
- Mutual friends suggestions — v0.9.0 (Cloud Function with cross-user queries)
- Photo display fix — v0.9.0 (letterboxing with contentFit=contain)
- Profile photo crop UI — v0.9.0 (circular preview, pinch-zoom, pan gestures)
- Comments sheet refactor — v0.9.0 (Animated.View with swipe-up gesture)
- Security audit — v0.9.0 (Storage rules, Cloud Functions auth, input validation, client-side defense)
- Comment cleanup audit — v0.9.0 (removed ~400+ lines of noise/stale comments)

### Active

- [ ] Additional features before release (next milestone planning)

### Out of Scope

- Music provider full integration — iTunes 30s previews sufficient for MVP
- Other users' private profile viewing — only friends see full profile
- Settings/account management beyond implemented features — more settings deferred
- Social login (Apple/Google) — phone-only authentication preferred for simplicity

## Context

**Current State (v0.9.0 shipped):**

- 57,005 lines of JavaScript/JSX
- Tech stack: React Native + Expo, Firebase Auth, Firestore, Cloud Functions, expo-audio, expo-image
- 45 phases completed across 2 milestones (v1.6 + v0.9.0)
- 138 plans executed over 20 days total
- All known issues resolved (ISS-001 through ISS-011)

**Known Issues:**

None — all issues closed.

## Constraints

- **Backend Auth**: Firebase Auth stays as-is — this is UI/UX refactor only
- **Data Compatibility**: Existing user documents in Firestore must continue working
- **Style Consistency**: Must match established dark theme from Camera/Feed/Darkroom screens

## Key Decisions

| Decision                                     | Rationale                                                                          | Outcome |
| -------------------------------------------- | ---------------------------------------------------------------------------------- | ------- |
| Full onboarding setup                        | Include Selects + song selection in profile creation flow                          | Good    |
| iTunes 30s previews                          | Spotify SDK deprecated 2022, iTunes API free and reliable                          | Good    |
| Own profile first, then other profiles       | Built foundation before social profile viewing                                     | Good    |
| Flat comment threading with @mentions        | Instagram-style UX, simpler than nested threads                                    | Good    |
| 7-day story / 1-day feed visibility          | Stories get more time, feed stays fresh                                            | Good    |
| Pure black (#000000) background              | True dark theme, consistent across all screens                                     | Good    |
| 30-day grace periods                         | Industry standard for account/photo deletion recovery                              | Good    |
| expo-image migration                         | Significant performance improvement for image-heavy screens                        | Good    |
| Phone-only authentication                    | Simpler UX, social login deferred                                                  | Good    |
| Mutual friend computation via Cloud Function | Firestore rules block client-side cross-user queries; admin SDK is correct pattern | Good    |
| Photo notification taps open PhotoDetail     | FeedScreen has no photoId handler; openPhotoDetail context is correct pattern      | Good    |
| Main photos owner-only in Storage            | Admin SDK bypasses Storage rules; getSignedPhotoUrl is correct access path         | Good    |
| Comments as Animated.View not Modal          | Persistent state, swipe gestures, better navigation integration                    | Good    |
| 30-second tag notification debounce          | Batch multiple tags into single notification, allow cancellation                   | Good    |

---

_Last updated: 2026-02-10 after v0.9.0 milestone_
