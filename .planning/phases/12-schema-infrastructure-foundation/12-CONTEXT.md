# Phase 12: Schema & Infrastructure Foundation - Context

**Gathered:** 2026-03-23
**Status:** Ready for planning

<domain>
## Phase Boundary

PostgreSQL schema designed and deployed to Supabase with normalized relational tables replacing all Firestore collections. PowerSync sync rules configured for offline-capable collections. Row-level security policies enforce per-user data access. TypeScript foundation configured with path aliases and Supabase-generated database types. No service rewrites -- this is pure infrastructure.

</domain>

<decisions>
## Implementation Decisions

### Schema design
- snake_case for all PostgreSQL column names (standard Postgres convention)
- Supabase-generated TypeScript types will be snake_case; camelCase mapping happens in the service layer (Phase 13+)
- JSONB columns for flexible/nested data: user selects (array of interests), song (name/artist/previewUrl), pinned snap data
- Fully normalized tables for relational data (photos, friendships, conversations, messages, etc.)
- Draft schema from research (17 tables) is the baseline -- Claude audits for completeness against current Firestore collections during planning

### PowerSync sync scope
- Sync 4 core tables: photos, conversations, friendships, streaks
- Photos: sync only last 30 days + all developing/revealed status photos. Older photos fetched on-demand from Supabase
- Only user's OWN photos sync -- friends' feed photos use TanStack Query cache for offline display (Phase 14)
- All conversations sync (metadata only, not messages) -- conversation list always available offline
- Messages, comments, notifications, albums stay online-only via Supabase Realtime or REST

### Dev environment setup
- Cloud Supabase dev project (no Docker dependency) -- mirrors existing Firebase dev/prod project split
- Supabase CLI for migrations (`supabase migration new` creates timestamped SQL files in `supabase/migrations/`)
- Seed script (`supabase/seed.sql`) with test users, sample photos, conversations for quick dev database resets
- Standard Supabase CLI layout at repo root: `supabase/config.toml`, `supabase/migrations/`, `supabase/functions/`, `supabase/seed.sql`

### RLS policy approach
- Full RLS enabled on ALL tables with explicit policies
- Friend-visibility for photos/feed: RLS subquery joins friendships table (`WHERE user_id IN (SELECT ... FROM friendships WHERE status = 'accepted')`)
- Block enforcement at RLS level -- blocked users physically cannot query your data (photos, comments, feed)
- Admin/debug access via service_role key (bypasses RLS). Used only in Edge Functions and admin scripts, never exposed to client

### Claude's Discretion
- Exact index strategy beyond what the draft schema specifies
- PowerSync sync rule syntax and configuration details
- RLS policy implementation patterns (security definer functions vs inline policies)
- TypeScript tsconfig fine-tuning beyond the research recommendations
- Whether to create database views for common query patterns (e.g., feed view)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Stack & architecture decisions
- `.planning/research/STACK.md` -- Full stack comparison, Supabase + PowerSync selection rationale, package versions, installation order, TypeScript migration strategy
- `.planning/research/ARCHITECTURE.md` -- Strangler Fig migration pattern, service layer restructuring, PostgreSQL schema draft (17 tables), Cloud Functions replacement map, data flow changes
- `.planning/research/PITFALLS.md` -- Known risks and mitigations for the migration

### Requirements
- `.planning/REQUIREMENTS.md` -- INFRA-01 through INFRA-05 define this phase's requirements
- `.planning/ROADMAP.md` -- Phase 12 success criteria (4 items)

### Project context
- `.planning/PROJECT.md` -- Key decisions table, constraints (dev-first migration, functionally identical)

### Current codebase
- `.planning/codebase/STACK.md` -- Current technology stack (what's being replaced)
- `.planning/codebase/ARCHITECTURE.md` -- Current service layer pattern (what the new schema must support)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- 20 Firebase service files in `src/services/firebase/` -- their export signatures define the API contract the schema must support
- `src/services/firebase/index.js` -- barrel file that all consumers import from (migration switch point)
- Existing `tsconfig.json` extends `expo/tsconfig.base` -- foundation for TypeScript setup exists

### Established Patterns
- Service layer: all Firebase ops return `{ success, error, data }` -- schema must support these query patterns
- Firestore collections map to: users, photos, friendships, comments, albums, notifications, blocks, reports, reactionBatches, conversations, messages, streaks, viewed_photos, support_requests, photo_tags, comment_likes, album_photos
- Upload queue uses AsyncStorage persistence -- will need PowerSync local table equivalent

### Integration Points
- `supabase/` directory sits alongside existing `functions/` (Firebase Cloud Functions) during dual-stack period
- TypeScript types generated from schema feed into `src/types/database.ts` (new file)
- PowerSync sync rules reference the PostgreSQL tables and RLS policies
- `app.config.js` will need Supabase project URL and anon key (via env vars or EAS secrets)

</code_context>

<specifics>
## Specific Ideas

No specific requirements -- open to standard approaches. The research docs contain a comprehensive schema draft that serves as the implementation starting point.

</specifics>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope.

</deferred>

---

*Phase: 12-schema-infrastructure-foundation*
*Context gathered: 2026-03-23*
