# Phase 16: Camera Capture Feedback - Context

**Gathered:** 2026-01-21
**Status:** Ready for planning

<vision>
## How This Should Work

When you tap the capture button, it should feel like pressing a real camera shutter — mechanical, tactile, satisfying. The moment of capture needs to feel instant and responsive, like there's a direct connection between your finger and the camera.

The capture feedback should simulate a DSLR-style two-stage experience: a light haptic on press (finger down), then a stronger, punchier haptic on the actual capture (finger up/release). This gives that mechanical "click and resistance" feel of a physical shutter button.

The visual flash feedback should be contained within the camera preview window only — not the entire screen like it is now. The flash should be slightly more pronounced than currently, but bounded to just the photo capture area. This makes it feel more like a real camera viewfinder flash rather than a full-screen takeover.

</vision>

<essential>
## What Must Be Nailed

- **Haptic timing** — The haptic response must be instant and crisp, exactly when the button is pressed. No perceptible delay.
- **Two-stage haptic pattern** — Light haptic on press-down, stronger haptic on capture/release, mimicking DSLR shutter feel
- **Contained flash** — Visual flash stays within the camera preview bounds, not full screen

</essential>

<boundaries>
## What's Out of Scope

- Shutter sounds — No audio feedback, just haptic and visual
- Button redesign — Capture button already redesigned in Phase 15.2
- Post-capture animation — The bounce animation to darkroom button is already implemented in Phase 15.2
- Any changes to the darkroom card stack behavior

</boundaries>

<specifics>
## Specific Ideas

- Two-stage haptic like a DSLR: light feedback on press, stronger punch on actual capture
- Flash animation bounded to the camera preview area (rounded corners to match the preview)
- More pronounced flash than current, but not overwhelming
- Zero perceived lag — tap to "photo taken" should feel < 100ms

</specifics>

<notes>
## Additional Context

The current implementation has a full-screen flash which feels jarring and less camera-like. Containing it to the preview area will make it feel more authentic to a real camera viewfinder experience.

The haptics utility already exists in the codebase — this phase focuses on getting the timing and pattern right for that mechanical shutter feel.

</notes>

---

*Phase: 16-camera-capture-feedback*
*Context gathered: 2026-01-21*
