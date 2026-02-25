---
status: investigating
trigger: 'TaggedPhotoBubble uses teal accent styling instead of matching reply bubble style'
created: 2026-02-25T00:00:00Z
updated: 2026-02-25T00:00:00Z
---

## Current Focus

hypothesis: TaggedPhotoBubble was designed with a unique teal identity instead of reusing the existing message bubble image style. Three specific issues: (1) teal border/background/shadow accent, (2) 4:3 aspect ratio constrains photo, (3) "Add to feed" button is outside the photo in a separate container below.
test: Compare TaggedPhotoBubble styles vs MessageBubble bubbleMedia styles and image rendering
expecting: Will find that TaggedPhotoBubble card uses TAG_ACCENT/TAG_BG/TAG_BORDER instead of transparent/no-border media approach, uses aspectRatio 4/3 instead of unconstrained, and button is in a sibling View below the photo
next_action: Document all three root causes with specific lines, then describe fix

## Symptoms

expected: Tagged photo card should look like the reply/snap message image bubble (no teal, no special accent border), show the full photo without 4:3 constraint, and have the "Add to feed" button overlaid INSIDE the photo at bottom center (not outside below it)
actual: Card has teal border (rgba(0,184,212,0.3)), teal background (rgba(0,184,212,0.08)), teal shadow, 4:3 aspect ratio constraining photo, and "Add to feed" button in a separate row below the photo
errors: N/A (visual styling issue, not runtime error)
reproduction: Open any DM conversation containing a tagged_photo message
started: Always been this way since initial implementation

## Eliminated

(none yet)

## Evidence

- timestamp: 2026-02-25T00:01:00Z
  checked: TaggedPhotoBubble.styles.js lines 18-49
  found: TAG_ACCENT=#00B8D4, TAG_BG=rgba(0,184,212,0.08), TAG_BORDER=rgba(0,184,212,0.3) used for card border, background, and iOS shadow color
  implication: The entire card is wrapped in a teal-themed visual identity that differs from all other message types

- timestamp: 2026-02-25T00:02:00Z
  checked: TaggedPhotoBubble.styles.js line 63
  found: photoContainer has aspectRatio: 4/3 which constrains the photo to landscape ratio
  implication: Photo is forced to 4:3 regardless of original aspect ratio; user wants full unconstrained photo

- timestamp: 2026-02-25T00:03:00Z
  checked: TaggedPhotoBubble.styles.js lines 77-81
  found: buttonContainer is a separate View with paddingHorizontal:10, paddingVertical:8 placed AFTER (below) the photoContainer
  implication: Button is outside the photo as a separate row, not overlaid inside the photo

- timestamp: 2026-02-25T00:04:00Z
  checked: MessageBubble.js lines 434-441 (bubbleMedia style)
  found: Image messages use bubbleMedia: paddingHorizontal:0, paddingVertical:0, backgroundColor:'transparent', borderWidth:0, borderColor:'transparent', overflow:'hidden'
  implication: Regular image messages have no border, no background, no padding - just the raw image in a rounded container. This is the target look.

- timestamp: 2026-02-25T00:05:00Z
  checked: MessageBubble.js lines 457-461 (messageImage style)
  found: Regular image messages use fixed width:200, height:250 with borderRadius:3
  implication: Image messages have a fixed size. TaggedPhotoBubble could match this approach instead of using aspect ratio.

## Resolution

root_cause: Three design decisions in TaggedPhotoBubble create the wrong visual identity: (1) Teal accent color system (TAG_ACCENT, TAG_BG, TAG_BORDER) applied to card border, background, and shadow makes it look like a special "tagged" card instead of a normal photo message; (2) The 4:3 aspectRatio on photoContainer constrains the photo artificially; (3) The "Add to feed" button is in a separate buttonContainer View below the photo instead of positioned as an overlay inside the photo.
fix: (pending)
verification: (pending)
files_changed: []
