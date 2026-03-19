# Milestone Context: v1.2 Speed & Scale

> Captured 2026-03-19 during /gsd:new-milestone discussion. Resume from research phase.

## Vision

Same app, same features — rebuilt on a faster, more scalable backend with TypeScript. Every interaction feels Instagram/TikTok-level instant. No new features, pure infrastructure and performance.

## Three Pillars

### 1. Backend/Database Migration
- Migrate off Firebase to the fastest, most scalable option
- **Not locked into Supabase** — research phase should evaluate Supabase, custom API (Node/Go + PostgreSQL + Redis), and other options
- Performance is the #1 factor, but cost comparison needed so user can weigh pros/cons
- Custom backend from scratch is on the table
- Existing analysis: `.planning/SUPABASE-MIGRATION-ANALYSIS.md` (treat as one candidate, not the decision)

### 2. TypeScript Migration
- Migrate as files are touched (backend rewrite touches everything)
- Outliers converted after main migration
- Not a separate phase — happens organically

### 3. Performance Overhaul
- Feed loading, screen transitions, darkroom reveals, conversations, snaps — everything
- Consistent loading and empty states across every screen
- Current state: "clunky" — darkroom shows empty then pops, screens load slowly, feed feels sluggish
- Target: Instagram/Facebook/TikTok-level snappiness

## Key Constraints

- **Offline media capture is non-negotiable** — users lose connectivity in subways and rural areas (hiking). Photos/videos must be capturable offline, triageable offline, and uploaded when back online. Zero media loss.
- **Small, testable phases** — each piece verified thoroughly before moving on. Doesn't matter if it takes a while; end result quality is what matters.
- **Dev-first** — dev database and build migrated first, prod untouched until fully proven.
- **Per-screen audit** — as each feature/screen is touched, do a quick audit for potential changes and upgrades.
- **Dead code cleanup** — remove anything unused along the way.
- **App functionally identical** — no feature additions, same behavior but faster and more scalable.

## Resume Point

Workflow paused at Step 7 (init + model resolution). Next steps:
1. Run init to resolve models
2. Research decision (strongly recommended — need to evaluate backend options)
3. Define requirements
4. Create roadmap
