# Auth & Profile Refactor

## What This Is

A complete refactor of Lapse Clone's authentication flow (login, signup) and profile system. Currently the auth screens are inconsistent with the app's dark aesthetic and the profile screen is a skeleton. This project delivers polished, cohesive auth UX and a full-featured profile with Selects banner, profile song, and album galleries.

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

### Active

- [ ] Login screen refactor — dark theme matching Camera/Feed/Darkroom aesthetic
- [ ] Signup flow refactor — consistent styling, clear step progression
- [ ] Profile creation onboarding — full setup flow (username, display name, photo, bio, Selects, song)
- [ ] Profile screen: Selects banner — user-selected photos in quick slideshow
- [ ] Profile screen: Profile info — photo, display name, username, short bio
- [ ] Profile screen: Profile song — tap to play preview (music provider TBD)
- [ ] Profile screen: User-created albums — horizontal scroll bar (Instagram highlights style)
- [ ] Profile screen: Auto-generated monthly albums — all user photos (archived + journaled) by month

### Out of Scope

- Album editing/creation UI — just display albums, creation flow comes later
- Other users' profiles — only viewing your own profile for now
- Settings/account management — password change, delete account, etc. deferred
- Music provider integration decision — Spotify vs Apple Music decided later (scaffold the feature)

## Context

**Existing State:**

- Auth screens have wrong colors/styling, confusing flow, and feel unpolished
- Profile screen is currently a skeleton placeholder
- App has established dark aesthetic in Camera, Feed, and Darkroom screens that auth/profile should match

**Technical Environment:**

- React Native + Expo managed workflow
- Firebase Auth (phone-based) — must remain unchanged
- Firebase Firestore for user data
- Service layer pattern for Firebase operations
- Context providers for global state

**Documentation Note:**

- CLAUDE.md incorrectly states client-side friend filtering for feed; actual implementation uses server-side filtering with Firebase index

## Constraints

- **Backend Auth**: Firebase Auth stays as-is — this is UI/UX refactor only
- **Data Compatibility**: Existing user documents in Firestore must continue working
- **Style Consistency**: Must match established dark theme from Camera/Feed/Darkroom screens

## Key Decisions

| Decision              | Rationale                                                         | Outcome   |
| --------------------- | ----------------------------------------------------------------- | --------- |
| Full onboarding setup | Include Selects + song selection in profile creation flow         | — Pending |
| Music provider TBD    | Spotify vs Apple Music decision deferred — scaffold feature first | — Pending |
| Own profile only      | Viewing other users' profiles out of scope for v1                 | — Pending |

---

_Last updated: 2026-01-26 after initialization_
