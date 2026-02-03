# Phase 17: Nested Reply Comments - Context

**Gathered:** 2026-02-03
**Status:** Ready for planning

<vision>
## How This Should Work

Instagram-style reply system where all comments stay in one flat list. When you tap "Reply" on any comment, the @username gets auto-inserted at the front of your message. No nested threading or indentation - everything stays inline and easy to scan.

When you tap an @mention in a comment, it smoothly scrolls the list to highlight the referenced comment, so you can follow the conversation context without leaving the view.

The reply action should be a small "Reply" text link under each comment - subtle but discoverable, exactly like Instagram does it.

</vision>

<essential>
## What Must Be Nailed

- **Clear conversation flow** - Easy to follow who's replying to whom, even in busy comment threads
- **Quick reply experience** - Tap, type, done. Replying should feel instant and frictionless
- **@mention navigation** - Tapping @mentions to scroll to referenced comments is core to making conversations trackable

All three aspects are equally important - they work together to create a coherent reply experience.

</essential>

<boundaries>
## What's Out of Scope

- Push notifications for replies - notification system is a separate concern
- Rich text formatting - just plain text with @mentions, no bold/italic/links
- Editing/deleting comments - focus only on the reply feature itself

</boundaries>

<specifics>
## Specific Ideas

- Match Instagram's comment reply UX as closely as possible - they've solved this well
- When scrolling to a referenced comment, briefly highlight it so the user knows where they landed

</specifics>

<notes>
## Additional Context

Building on the existing comments system (CommentsSheet). This phase extends comments with reply threading while keeping the flat list structure that's already in place.

</notes>

---

_Phase: 17-nested-reply-comments_
_Context gathered: 2026-02-03_
