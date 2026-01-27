# Phase 35: Stories Redesign - Context

**Gathered:** 2026-01-25
**Status:** Ready for planning

<vision>
## How This Should Work

Stories become the PRIMARY way to browse content. When you open the app, the stories row is where you go to see what your friends have been capturing. Tap into someone's story and flip through all their photos at your own pace — no auto-play rushing you, just tap left/right to move through.

The feed below becomes a curated "hot" feed — only posts with lots of engagement (comments, reactions) surface there. This is the highlights reel, not the main experience.

The stories row itself is mini Polaroid cards — the same aesthetic as the new feed cards, just scaled down. The photos in the thumbnails are blurred, creating anticipation. You see shapes and colors but have to tap in to actually see the photo clearly. Maintains that darkroom mystery feel.

When you finish one friend's photos, it auto-advances to the next (or you can swipe to skip ahead anytime). Purple/pink gradient glow around cards with unviewed content. Once viewed, subtle gray ring and the card moves to the end of the row.

The full-screen viewing experience uses the existing PhotoDetailModal — consistency with the feed. Segmented progress bars at the top show how many photos and where you are.

</vision>

<essential>
## What Must Be Nailed

- **Stories as primary experience** - This is THE way to browse friends' photos, not a secondary feature
- **Polaroid mini-card aesthetics** - Consistent visual language with Phase 34 feed cards
- **Blurred thumbnails** - Creates anticipation, tap to reveal clearly
- **Manual pace control** - No auto-advance timer, you control the experience with taps
- **Clear viewing indicators** - Gradient glow for unviewed, gray ring + move to end for viewed

</essential>

<boundaries>
## What's Out of Scope

- Story creation/posting flow - just viewing experience
- Story replies or reactions while viewing - uses existing reaction system
- Story duration/expiry - not changing how long content persists
- Changes to the PhotoDetailModal - reuse existing modal

</boundaries>

<specifics>
## Specific Ideas

- **Thumbnail size:** Large (100-120px) to give the Polaroid frame room to breathe
- **Blur effect:** Photos blurred in thumbnails, revealed when tapped into
- **Navigation:** Tap left/right within photos, swipe or auto-advance between friends
- **Progress:** Segmented bar at top (Instagram-style) showing photo count and position
- **Viewing states:**
  - Unviewed: Purple/pink gradient border glow (Rewind brand colors)
  - Viewed: Subtle gray ring, card moves to end of stories row
- **Scroll behavior:** Standard horizontal scroll, no snapping
- **Feed change:** Feed becomes "hot highlights" only — posts with high engagement

</specifics>

<notes>
## Additional Context

This is a significant content model shift. Stories are promoted from supplementary feature to primary browsing experience. The feed becomes curated rather than comprehensive.

The blurred thumbnails with tap-to-reveal reinforces the darkroom/anticipation aesthetic that's core to the app identity.

Manual pacing (no auto-play) is a deliberate choice — each photo gets intentional attention rather than rushing past on a timer.

</notes>

---

_Phase: 35-stories-redesign_
_Context gathered: 2026-01-25_
