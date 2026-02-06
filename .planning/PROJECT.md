# Auth & Profile Refactor

## What This Is

A social photo-sharing app (Lapse Clone / REWIND) with complete dark-themed authentication, comprehensive profile system including Selects banner slideshows, iTunes profile songs, user-created albums, and monthly photo archives. Full social features including friend management, blocking, reactions with emoji picker, threaded comments with @mentions, and content visibility lifecycle management.

## Core Value

All three areas (login/signup flow, profile creation onboarding, profile screen) must be solid and functional — the app's first impression and personal identity depend on it.

## Requirements

### Validated

- Phone-based authentication via Firebase Auth — existing
- Camera & photo capture system — existing
- Darkroom reveal system — existing
- Feed with server-side friend filtering — existing
- Photo reactions system — existing
- Push notifications — existing
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

### Active

- [ ] Additional features before release (v1.7 planning)

### Out of Scope

- Music provider full integration — iTunes 30s previews sufficient for MVP
- Other users' private profile viewing — only friends see full profile
- Settings/account management beyond implemented features — more settings deferred
- Social login (Apple/Google) — phone-only authentication preferred for simplicity

## Context

**Current State (v1.6 shipped):**

- 40,354 lines of JavaScript/JSX
- Tech stack: React Native + Expo, Firebase Auth, Firestore, expo-av, expo-image
- 31 integer phases + 14 decimal insertions completed
- 108 plans executed over 16 days

**Known Issues:**

- ISS-001: Optimize photo capture for full-screen display
- ISS-004: Comments sheet closes when navigating to profile
- ISS-005: Swipe up on photo to open comments
- ISS-011: Custom profile photo crop UI

## Constraints

- **Backend Auth**: Firebase Auth stays as-is — this is UI/UX refactor only
- **Data Compatibility**: Existing user documents in Firestore must continue working
- **Style Consistency**: Must match established dark theme from Camera/Feed/Darkroom screens

## Key Decisions

| Decision                               | Rationale                                                   | Outcome |
| -------------------------------------- | ----------------------------------------------------------- | ------- |
| Full onboarding setup                  | Include Selects + song selection in profile creation flow   | Good    |
| iTunes 30s previews                    | Spotify SDK deprecated 2022, iTunes API free and reliable   | Good    |
| Own profile first, then other profiles | Built foundation before social profile viewing              | Good    |
| Flat comment threading with @mentions  | Instagram-style UX, simpler than nested threads             | Good    |
| 7-day story / 1-day feed visibility    | Stories get more time, feed stays fresh                     | Good    |
| Pure black (#000000) background        | True dark theme, consistent across all screens              | Good    |
| 30-day grace periods                   | Industry standard for account/photo deletion recovery       | Good    |
| expo-image migration                   | Significant performance improvement for image-heavy screens | Good    |
| Phone-only authentication              | Simpler UX, social login deferred                           | Good    |

---

_Last updated: 2026-02-06 after v1.6 milestone_
