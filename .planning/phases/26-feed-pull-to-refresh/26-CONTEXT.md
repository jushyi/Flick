# Phase 26: Feed Pull-to-Refresh & Loading Skeleton - Context

**Gathered:** 2026-02-05
**Status:** Ready for planning

<vision>
## How This Should Work

When opening the feed or pulling down to refresh, users see a polished loading experience that feels native and branded. The pull-to-refresh uses a standard iOS spinner — nothing fancy, just reliable and expected behavior.

The real focus is the loading skeleton. While content loads, users see a skeleton that mirrors the actual feed structure: story bar circles at the top, photo cards below with avatar and text placeholders. The skeleton uses Instagram-style shimmer effects, and content fades in smoothly when ready.

The whole experience should feel seamless — skeleton matches real content so closely that the transition from loading to loaded is barely noticeable.

</vision>

<essential>
## What Must Be Nailed

- **Skeleton accuracy** - Skeleton must closely match the real feed structure (story bar + photo cards with avatar/text placeholders) so transition feels seamless
- **Smooth transitions** - The fade from skeleton to real content should be polished, no jarring jumps
- **Pull-to-refresh feel** - The refresh gesture should feel responsive and native

</essential>

<boundaries>
## What's Out of Scope

- **Infinite scroll/pagination** - Not adding load-more-on-scroll, just refresh existing feed
- **Error states** - Not designing failed-to-load states, assume success
- **Other screens** - Only feed screen, not profile or other areas

</boundaries>

<specifics>
## Specific Ideas

- Instagram-style shimmer effect for skeleton cards
- Instagram-style fade-in pattern when content loads
- Standard iOS spinner for pull-to-refresh (not custom branded)
- Skeleton includes: story bar circles at top, photo cards with avatar + text placeholders

</specifics>

<notes>
## Additional Context

No additional notes

</notes>

---

_Phase: 26-feed-pull-to-refresh_
_Context gathered: 2026-02-05_
