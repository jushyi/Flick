# Phase 11: Add Video Support to Main Camera - Context

**Gathered:** 2026-03-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Add video recording capability to the existing camera screen. Videos follow the same lifecycle as photos: capture, develop in darkroom, reveal, display in feed/stories. No new screens — video integrates into existing camera, darkroom, feed, PhotoDetail, and stories views.

</domain>

<decisions>
## Implementation Decisions

### Recording behavior
- Hold to record, tap for photo — no explicit mode toggle
- ~0.5s hold threshold before recording begins; releasing before threshold captures a photo
- 30 second maximum duration, auto-stops at limit with no warning
- Circular progress ring around the shutter button fills during recording
- Always record audio
- Front/back camera switch during recording if technically feasible, otherwise lock once recording starts
- Torch stays on during recording if flash was enabled beforehand
- Light haptic feedback on recording start and stop

### Darkroom & reveal
- Videos behave identically to photos in the darkroom
- Same 0-5 minute random developing timer
- Same blurred/hidden thumbnail treatment while developing
- Small video icon overlay to distinguish from photos

### Feed & playback
- Autoplay muted when video scrolls into view
- Tap to unmute; once unmuted, sound stays on for subsequent videos until user mutes again
- Videos loop continuously in feed until user scrolls away
- Small duration badge (e.g. "0:12") in the corner of the video card

### PhotoDetail modal
- Carries the current sound state from the feed (muted or unmuted)
- Progress bar + mute/unmute toggle — reuses the existing photo progress bar component
- Videos loop in PhotoDetail

### Stories view
- Same progress bar + mute toggle as PhotoDetail, leveraging existing UI
- Video plays once to completion, then auto-advances to next story
- No looping in stories — play once, advance
- Photos continue to work as they do now (no auto-advance)

### Capture mode switching
- Long press shutter = video, tap shutter = photo
- No explicit photo/video toggle UI
- No hint text or label — users discover hold-to-record through use

### Claude's Discretion
- Video compression and quality settings
- Thumbnail generation approach (which frame to use)
- Upload queue handling for videos vs photos
- Video file format choice
- Progress ring animation style and color

</decisions>

<specifics>
## Specific Ideas

- The interaction should feel seamless — one shutter button does both photo and video based on gesture
- Leverage existing UI components where possible (progress bar, darkroom tiles, feed cards)
- Videos in stories auto-advance after playing, creating a natural flow between friends' content

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 11-add-video-support-to-main-camera*
*Context gathered: 2026-03-04*
