---
status: complete
phase: 04-snap-streaks
source: 04-01-SUMMARY.md, 04-02-SUMMARY.md, 04-03-SUMMARY.md, 04-04-SUMMARY.md
started: 2026-02-25T12:00:00Z
updated: 2026-02-25T12:30:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Streak Indicator in Messages List

expected: Open the Messages tab. Each conversation row should show a streak indicator icon (small colored or muted gray icon) where the snap camera shortcut button is.
result: pass

### 2. Streak Indicator in Conversation Header

expected: Open any conversation. Next to the friend's display name in the header, there should be a streak indicator icon.
result: pass

### 3. Streak Indicator on DM Camera Button

expected: Inside a conversation, the camera/snap button in the message input area should show a streak-aware icon.
result: pass

### 4. Streak Warning Toggle in Notification Settings

expected: Navigate to Profile > Settings > Notification Settings. There should be a "Messaging" section with a "Streak Warnings" toggle.
result: pass

### 5. Streak Initiation via Snap

expected: Send a snap message to a friend. The streak system should begin tracking without permission errors.
result: issue
reported: "Firestore permission-denied error on streak subscription — security rule failed for non-existent streak documents"
severity: blocker

### 6. Streak Day Count Overlay

expected: For any conversation with an active streak, the streak indicator should display the day count number. Color should deepen with streak length.
result: issue
reported: "Overlay looks weird, number goes below the icon instead of in it. On Android has circle around it."
severity: cosmetic

## Summary

total: 6
passed: 4
issues: 2
pending: 0
skipped: 0

## Gaps

- truth: "Streak subscription works without errors for conversations with no existing streak document"
  status: fixed
  reason: "User reported: Firestore permission-denied error on streak subscription"
  severity: blocker
  test: 5
  root_cause: "Firestore security rule used resource.data.participants which fails when document doesn't exist"
  artifacts:
  - path: "firestore.rules"
    issue: "Rule checked resource.data.participants on non-existent document"
    missing: []
    fix: "Changed rule to resource == null || request.auth.uid in resource.data.participants"

- truth: "Day count overlay displays cleanly on the streak indicator icon"
  status: fixed
  reason: "User reported: overlay looks weird, number below icon, circle on Android"
  severity: cosmetic
  test: 6
  root_cause: "absoluteFillObject centering didn't work well with pixel font baseline; fontWeight bold caused Android artifacts"
  artifacts:
  - path: "src/components/StreakIndicator.js"
    issue: "Overlay positioning and Android font rendering"
    missing: []
    fix: "Moved day count below icon as plain text, removed fontWeight bold, increased font size. Also removed StreakIndicator from DMInput per user preference (plain PixelIcon only)."
