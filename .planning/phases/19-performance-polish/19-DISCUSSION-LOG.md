# Phase 19: Performance Polish - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md -- this log preserves the alternatives considered.

**Date:** 2026-03-24
**Phase:** 19-performance-polish
**Areas discussed:** Skeleton screens, Optimistic updates, Image loading & CDN, Empty states

---

## Skeleton Screens

| Option | Description | Selected |
|--------|-------------|----------|
| Shimmer pulse | Left-to-right shimmer gradient, Instagram/TikTok style | ✓ |
| Static placeholders | Dark gray shapes, no animation | |
| Fade pulse | Gentle opacity fade in/out | |

**User's choice:** Shimmer pulse
**Notes:** None

| Option | Description | Selected |
|--------|-------------|----------|
| Exact layout match | Each screen gets a skeleton mirroring its real layout | ✓ |
| Generic list skeleton | One reusable skeleton with configurable rows | |
| You decide | Claude picks per screen | |

**User's choice:** Exact layout match
**Notes:** None

| Option | Description | Selected |
|--------|-------------|----------|
| All 6 from criteria | Feed, conversations, friends, comments, notifications, albums | |
| All 6 + darkroom + profile | Add darkroom and profile to required list | |
| Core 3 only | Feed, conversations, notifications | |

**User's choice:** Custom -- "would you recommend more than just the 6? why not all screens"
**Notes:** After discussion, agreed on 9 screens: the 6 required + darkroom, profile (photo grid), and activity. Camera, settings, PhotoDetail, SongSearch excluded as they don't have list loading states.

---

## Optimistic Updates

| Option | Description | Selected |
|--------|-------------|----------|
| Silent rollback + toast | UI reverts, brief toast shows error | ✓ |
| Silent rollback only | UI reverts quietly, no visible error | |
| Retry prompt | Inline retry button like iMessage | |

**User's choice:** Silent rollback + toast
**Notes:** None

| Option | Description | Selected |
|--------|-------------|----------|
| 5 required + extras | 5 from criteria + commenting, blocking, album edits | ✓ |
| Strict 5 only | Only the 5 in success criteria | |
| You decide | Claude evaluates each mutation | |

**User's choice:** 5 required + a few extras
**Notes:** None

| Option | Description | Selected |
|--------|-------------|----------|
| TanStack only | Focus on TanStack mutations, PowerSync is already instant | ✓ |
| Unified pattern | Shared wrapper for both PowerSync and TanStack | |

**User's choice:** TanStack only
**Notes:** PowerSync local writes are already optimistic by nature

---

## Image Loading & CDN

| Option | Description | Selected |
|--------|-------------|----------|
| Supabase transforms | Append ?width=400&format=webp to URLs | ✓ |
| Pre-generate sizes | Generate 400px and 1080px variants at upload time | |
| You decide | Claude picks based on tradeoffs | |

**User's choice:** Supabase transforms
**Notes:** None

| Option | Description | Selected |
|--------|-------------|----------|
| Next 3 images | Prefetch 3 ahead in feed/stories | |
| Next 5 images | Prefetch 5 ahead | |
| You decide | Claude tunes count | |

**User's choice:** Custom -- "next 3, does this include fetching the first of every story on app load?"
**Notes:** After discussion, agreed on two-tier prefetching: (1) prefetch first image of each story on feed load at 400px, (2) prefetch next 3 within story viewing at full-res

| Option | Description | Selected |
|--------|-------------|----------|
| Proactive refresh | Check expiry before rendering, background refresh | ✓ |
| Refresh on error | Render as-is, catch 403 and refresh | |
| You decide | Claude implements most robust pattern | |

**User's choice:** Proactive refresh
**Notes:** None

---

## Empty States

| Option | Description | Selected |
|--------|-------------|----------|
| Pixel art + text | Small pixel art icon + message, matching retro aesthetic | ✓ |
| Text only | Centered message, minimal | |
| Emoji + text | Large emoji + message | |

**User's choice:** Pixel art illustration + text
**Notes:** None

| Option | Description | Selected |
|--------|-------------|----------|
| Contextual CTAs | CTA buttons relevant to each empty screen | ✓ |
| No CTAs | Text only, navigation via tab bar | |
| You decide | Claude adds CTAs where sensible | |

**User's choice:** Yes, contextual CTAs
**Notes:** None

| Option | Description | Selected |
|--------|-------------|----------|
| Shared component | One EmptyState with icon/message/CTA props | ✓ |
| Per-screen custom | Each screen builds own empty state | |

**User's choice:** Shared component with props
**Notes:** None

---

## Claude's Discretion

- Shimmer animation implementation (Reanimated vs Animated API)
- Toast library/pattern selection
- Supabase transform URL helpers
- Prefetch timing/throttling
- Signed URL expiry check implementation
- Pixel art asset sourcing
- Per-screen empty state copy and CTAs

## Deferred Ideas

None -- discussion stayed within phase scope.
