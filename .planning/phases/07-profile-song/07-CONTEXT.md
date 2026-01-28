# Phase 7: Profile Song - Context

**Gathered:** 2026-01-28
**Status:** Ready for planning

<vision>
## How This Should Work

When viewing a profile, there's a music card that shows the user's chosen song. The card has album art thumbnail on the left, song title with artist underneath, a duration indicator, and a play button on the right. It's minimal and matches the existing profile aesthetic — nothing flashy.

Tap the play button and the song starts playing. A progress bar fills, the play button becomes pause, and the card pulses/glows subtly to show it's active. If you're already playing music, the profile song takes over. When you navigate away from the profile, the song fades out smoothly over 1-2 seconds rather than cutting abruptly.

Song search uses iTunes Search API (no auth required, works for everyone). Preview clips are limited to ~30 seconds due to music licensing - this is standard across apps like Instagram, TikTok, and Snapchat.

Finding a song is simple: search within the app using a search bar. Results appear in the same card layout as the profile song, so you see exactly what it will look like. Tap the play button on any result to preview it, tap anywhere else on the card to select it.

The special part: after selecting a song, you get a waveform scrubber to pick exactly which portion of the 30-second preview plays. Classic vertical bars showing the audio amplitude. Drag to select your start and end points within the preview. The audio plays live as you scrub, and there's also a play button to preview your current selection. This scrubber appears during initial selection, and you can also go back to edit the timing later.

Quick tap on your profile song plays/pauses. Long-press brings up a simple menu: Change song, Remove. That's it.

For visitors viewing someone else's profile, the song plays using preview URLs so it works regardless of which music service the visitor uses.

</vision>

<essential>
## What Must Be Nailed

- **Visual presentation** — Card looks polished and fits the profile aesthetic (minimal, dark theme)
- **Audio playback** — Actually hearing the music is the core experience
- **Song selection flow** — Search, preview, select, customize clip — all smooth and intuitive
- **Waveform scrubber** — Users must be able to pick exactly which part of their song plays

</essential>

<boundaries>
## What's Out of Scope

- Animated visualizers (waveform animations, spectrum analyzers, etc.)
- Browse by genre/mood — just simple search
- Complex edit menus — keep it to Change/Remove only

</boundaries>

<specifics>
## Specific Ideas

- **Card layout:** Album art thumbnail left | Title + Artist (below) + Duration | Play button right
- **Playback feedback:** Progress bar fills + play/pause toggle + subtle glow animation
- **Search results:** Same card layout as profile song (WYSIWYG)
- **Selection:** Tap play to preview, tap elsewhere on card to select
- **Waveform:** Classic audio waveform bars, drag start AND end points
- **30s max:** Preview clips limited to ~30 seconds (music licensing constraint)
- **Scrubber audio:** Live feedback while dragging, plays from selection on release, play button to test
- **Fades out:** 1-2 seconds when navigating away
- **Universal playback:** iTunes preview URLs work for any visitor (no auth needed)
- **Empty state:** Placeholder card with "Add song" prompt
- **Edit:** Long-press for menu (Change song, Remove)
- **Onboarding:** Already has scaffold in profile setup, keep optional
- **Placement:** Uses existing placeholder position on profile

</specifics>

<notes>
## Additional Context

This is the FULL profile song feature, not just a scaffold.

**Research findings (2026-01-28):**

- Spotify deprecated preview_url Nov 2024 - using iTunes Search API instead
- iTunes API provides 30-second previews, no auth required
- Waveform library (@simform_solutions/react-native-audio-waveform) for clip selection
- expo-av (already installed) handles audio playback with fade out

The waveform scrubber for timestamp selection is a key differentiator — users get precise control over which part of their favorite song represents them. This should feel premium.

</notes>

---

_Phase: 07-profile-song_
_Context gathered: 2026-01-28_
