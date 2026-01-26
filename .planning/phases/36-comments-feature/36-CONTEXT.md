# Phase 36: Comments Feature - Context

**Gathered:** 2026-01-26
**Status:** Ready for planning

<vision>
## How This Should Work

Instagram-style threaded comments — the standard users expect from social apps. Comments live in the photo modal, integrated into the footer alongside emoji reactions. The left half of the footer becomes a text input field, with emojis compressed to the right.

When you tap the comment input, the footer expands upward into a bottom sheet showing the full comment thread plus the input. The photo stays visible at the top (sheet covers roughly half the screen) so users keep context of what they're commenting on.

**Preview comments** appear in two places:

- On feed cards: 1-2 recent comments shown as preview
- In the photo modal: above the progress bar, below the username

If the photo owner comments on their own photo, that comment gets priority display — essentially functioning as a caption for the photo.

Preview format is compact inline: **Username** comment text flows here...

</vision>

<essential>
## What Must Be Nailed

- **Full threaded comments** — the complete Instagram-style package (threading, likes, replies)
- **Smooth bottom sheet UX** — footer expands upward, keyboard handling works seamlessly
- **Comment row layout** — profile photo left, name + comment + reply button in middle, heart on right
- **Self-comment as caption** — owner's comment prioritized in preview display
- **Media comments** — pics/GIFs as thumbnail-sized comments (both Giphy search and camera roll)

</essential>

<boundaries>
## What's Out of Scope

No explicit exclusions — build whatever makes sense for a complete, standard comments experience.

</boundaries>

<specifics>
## Specific Ideas

**Comment row layout (expanded sheet):**

- Left: Profile photo
- Middle column: Name on top (bold), comment text below, "Reply" button at bottom-left under comment
- Right: Heart button to like the comment

**Preview comment format (feed cards + modal):**

- Inline format: **Username** comment text...
- Bold name on left, comment flowing to the right
- Compact single-line style

**Threading:**

- One level deep (Instagram-style) — comments can have replies, but replies can't have further replies

**Bottom sheet behavior:**

- Expands from footer when input tapped
- Photo stays visible at top (half-screen coverage)
- Scrollable comment list with input at bottom

**Media in comments:**

- GIF picker (Giphy-style search)
- Camera roll access for photos
- Displayed as thumbnails in the comment

**Management:**

- Users can delete their own comments
- Photo owner can delete any comment on their photo
- Notifications when someone comments on your photo

</specifics>

<notes>
## Additional Context

User wants the familiar Instagram experience — this is about meeting expectations, not reinventing. The comment input integrated into the existing modal footer (sharing space with emoji reactions) keeps the UI cohesive rather than adding new entry points.

The self-comment-as-caption pattern is elegant: no separate caption field needed, but owners can add context by commenting on their own photo.

</notes>

---

_Phase: 36-comments-feature_
_Context gathered: 2026-01-26_
