---
phase: 06-tech-debt-darkroom-optimization
plan: 05
subsystem: infrastructure
tags: [firestore, gcs, ttl, lifecycle, console-config]
---

## What Was Built

Configured two passive cleanup safety nets via Google Cloud Console:

1. **DEBT-03 — Firestore TTL:** Policy on collection group `messages`, field `expiresAt`. Snap message documents will auto-delete after their expiry timestamp.
2. **DEBT-04 — GCS Lifecycle:** Rule on Firebase Storage bucket for `snap-photos/` prefix with 14-day age condition, Delete action. Orphaned snap photos auto-delete after 14 days.

## Key Decisions

- gcloud CLI not available on dev machine — configured via Google Cloud Console manually
- `reactionBatches` TTL intentionally excluded: documents lack `expiresAt` field, existing `cleanupOldNotifications` Cloud Function handles 7-day cleanup
- Both configs complement existing Cloud Function cleanup as passive safety nets

## Self-Check: PASSED

- [x] Firestore TTL policy configured on messages.expiresAt
- [x] GCS lifecycle rule configured for snap-photos/ prefix, 14-day Delete
- [x] User confirmed both configurations via console

## key-files

### created
- No code files — console/infrastructure configuration only

## Commits

- No code commits — infrastructure-only changes configured in Google Cloud Console
