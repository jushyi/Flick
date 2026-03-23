-- Migration: Create PowerSync publication
-- Phase 12, Plan 03: Logical replication for offline sync
-- PowerSync uses PostgreSQL logical replication to sync data to client devices
-- Only include the 4 offline-capable tables (not all 18)

CREATE PUBLICATION powersync FOR TABLE photos, conversations, friendships, streaks;
