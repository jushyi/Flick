# Phase 11: Feed Reaction Emoji Enhancements - Research

**Researched:** 2026-01-30
**Domain:** React Native emoji picker/keyboard for photo reactions
**Confidence:** HIGH

<research_summary>

## Summary

Researched the React Native ecosystem for implementing curated emoji reactions with custom emoji selection. The core finding is that **iOS does not provide a public API to programmatically trigger the native emoji keyboard**. This means the context requirement of "Native iOS emoji keyboard" cannot be achieved directly - but a near-identical experience can be created using `rn-emoji-keyboard`, which renders iOS system emojis in a performant, fully customizable picker.

For curated emoji variety per photo, this needs to be implemented as custom logic - creating categorized emoji pools and rotating through them based on photo ID or index. No library provides this out-of-the-box.

**Primary recommendation:** Use `rn-emoji-keyboard` for "Add your own" custom emoji selection. Implement curated emoji rotation logic in-house using categorized emoji arrays with deterministic selection based on photo ID.
</research_summary>

<standard_stack>

## Standard Stack

### Core

| Library           | Version | Purpose                    | Why Standard                                                                                           |
| ----------------- | ------- | -------------------------- | ------------------------------------------------------------------------------------------------------ |
| rn-emoji-keyboard | ^1.x    | Full-featured emoji picker | Most performant RN emoji picker (score: 90), actively maintained, no native dependencies, customizable |

### Supporting

| Library       | Version | Purpose | When to Use                                     |
| ------------- | ------- | ------- | ----------------------------------------------- |
| None required | -       | -       | Curated rotation logic is custom implementation |

### Alternatives Considered

| Instead of        | Could Use                          | Tradeoff                                                         |
| ----------------- | ---------------------------------- | ---------------------------------------------------------------- |
| rn-emoji-keyboard | expo-emoji-keyboard                | Native access but very low adoption (1 star), poor documentation |
| rn-emoji-keyboard | react-native-emoji-selector        | Simpler but less performant, fewer features                      |
| rn-emoji-keyboard | Hidden TextInput + system keyboard | Requires user to manually switch to emoji keyboard (poor UX)     |

**Installation:**

```bash
npm install rn-emoji-keyboard
# or
yarn add rn-emoji-keyboard
```

**No peer dependencies required** - library is pure React Native JavaScript.
</standard_stack>

<architecture_patterns>

## Architecture Patterns

### Recommended Project Structure

```
src/
├── constants/
│   └── emojiPools.js         # Categorized emoji arrays for rotation
├── components/
│   └── EmojiReactionPicker/
│       ├── index.js          # Main picker with curated + custom
│       ├── CuratedEmojiRow.js    # Rotating 5-6 emoji display
│       └── AddEmojiButton.js     # Opens rn-emoji-keyboard
├── hooks/
│   └── useCuratedEmojis.js   # Hook for photo-based emoji selection
└── utils/
    └── emojiRotation.js      # Deterministic rotation algorithm
```

### Pattern 1: Categorized Emoji Pools

**What:** Organize emojis into category pools for thoughtful rotation
**When to use:** When displaying curated emoji options per photo
**Example:**

```javascript
// constants/emojiPools.js
export const EMOJI_POOLS = {
  faces: ['😂', '🤣', '😊', '😁', '😅', '😆', '🙂', '😄', '😃', '😀'],
  love: ['❤️', '😍', '🥰', '💕', '💖', '💗', '💓', '💞', '💘', '🫶'],
  fire: ['🔥', '💯', '⭐', '✨', '💥', '🌟', '💫', '🎯', '👑', '🏆'],
  animals: ['🐶', '🐱', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷'],
  food: ['🍕', '🍔', '🌮', '🍟', '🍩', '🍪', '🍰', '🧁', '🍦', '🍫'],
  objects: ['👏', '🙌', '🤝', '👍', '👎', '✌️', '🤞', '🫰', '💪', '👊'],
  nature: ['🌸', '🌺', '🌻', '🌷', '🌹', '💐', '🍀', '🌿', '🌱', '🌲'],
  expressions: ['😮', '😱', '😳', '🤯', '😢', '😭', '🥺', '😤', '🤔', '🤨'],
};

export const POOL_KEYS = Object.keys(EMOJI_POOLS);
```

### Pattern 2: Deterministic Emoji Rotation

**What:** Select emojis based on photo ID for consistent but varied display
**When to use:** Ensuring same photo always shows same emoji set (not random on re-render)
**Example:**

```javascript
// utils/emojiRotation.js
import { EMOJI_POOLS, POOL_KEYS } from '../constants/emojiPools';

/**
 * Get curated emojis for a photo based on its ID
 * Returns 5-6 emojis from different categories
 */
export function getCuratedEmojis(photoId, count = 5) {
  // Use photoId to seed selection (deterministic)
  const seed = hashCode(photoId);
  const result = [];

  // Pick from different categories for variety
  const poolCount = POOL_KEYS.length;
  for (let i = 0; i < count; i++) {
    const poolIndex = (seed + i) % poolCount;
    const pool = EMOJI_POOLS[POOL_KEYS[poolIndex]];
    const emojiIndex = (seed + i * 7) % pool.length; // Prime multiplier for spread
    result.push(pool[emojiIndex]);
  }

  return result;
}

function hashCode(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}
```

### Pattern 3: Custom Emoji Preview Flow

**What:** Selected custom emoji replaces add button, tap to confirm
**When to use:** "Add your own" custom emoji selection
**Example:**

```javascript
// Simplified flow state machine
const [customEmoji, setCustomEmoji] = useState(null);
const [pickerOpen, setPickerOpen] = useState(false);

// When emoji selected from picker
const handleEmojiPick = emojiObject => {
  setCustomEmoji(emojiObject.emoji);
  setPickerOpen(false);
  // Show preview in row (replaces add button)
};

// When preview is tapped
const handleCustomEmojiConfirm = () => {
  onReactionToggle(customEmoji, 0);
  setCustomEmoji(null); // Reset preview
};
```

### Anti-Patterns to Avoid

- **Random selection on every render:** Use deterministic selection based on photo ID to prevent emoji flickering
- **Triggering native keyboard:** No iOS API exists - don't waste time trying to access system emoji keyboard
- **Giant emoji arrays:** Keep pools manageable (10-15 per category), not all 3,700+ Unicode emojis
- **Forcing same emojis everywhere:** The point is variety - ensure rotation actually varies across photos
  </architecture_patterns>

<dont_hand_roll>

## Don't Hand-Roll

| Problem                  | Don't Build                              | Use Instead                | Why                                                                             |
| ------------------------ | ---------------------------------------- | -------------------------- | ------------------------------------------------------------------------------- |
| Full emoji picker UI     | Custom emoji grid with search/categories | rn-emoji-keyboard          | 29 open issues worth of edge cases, performance optimization, skin tone support |
| Emoji rendering          | Custom emoji font loading                | System fonts               | iOS/Android already have emoji fonts; emoji strings render correctly            |
| Category tabs/navigation | Custom tab bar for emoji categories      | rn-emoji-keyboard built-in | Already handles swipe gestures, category icons, recent emojis                   |
| Emoji search             | Full-text search implementation          | rn-emoji-keyboard search   | Unicode names, keywords already indexed                                         |

**Key insight:** The emoji picker itself is a solved problem. The curated rotation logic is what's custom here - and that's simple array/math operations, not complex UI work.
</dont_hand_roll>

<common_pitfalls>

## Common Pitfalls

### Pitfall 1: Trying to Force Native Emoji Keyboard

**What goes wrong:** Hours spent trying to trigger iOS system emoji keyboard programmatically
**Why it happens:** Assumption that iOS provides this API (it doesn't)
**How to avoid:** Accept that rn-emoji-keyboard provides equivalent UX with iOS system emojis
**Warning signs:** Searching for `keyboardType="emoji"` or native iOS bridges

### Pitfall 2: Random Emoji Selection Causing Flicker

**What goes wrong:** Emoji options change on every re-render
**Why it happens:** Using Math.random() instead of deterministic selection
**How to avoid:** Hash photo ID to seed selection, memoize result
**Warning signs:** Emojis jumping around when scrolling feed

### Pitfall 3: Emoji Render Inconsistency

**What goes wrong:** Some emojis look different or don't render on older devices
**Why it happens:** Using newer Unicode emojis (v14+) on older OS versions
**How to avoid:** Stick to Unicode v13 or earlier emojis for broad compatibility, or filter by `emoji.v` property
**Warning signs:** Empty boxes or weird characters on some devices

### Pitfall 4: Missing the "Add Your Own" Button Visual Parity

**What goes wrong:** Add button looks out of place next to emoji options
**Why it happens:** Different styling, size, or treatment
**How to avoid:** Context specifies "equal visual presence" - same size, same container style as emoji pills
**Warning signs:** Add button being smaller, different shape, or looking like secondary action
</common_pitfalls>

<code_examples>

## Code Examples

Verified patterns for implementation:

### rn-emoji-keyboard Basic Usage

```javascript
// Source: https://docs.thewidlarzgroup.com/rn-emoji-keyboard/docs/documentation/start
import EmojiPicker from 'rn-emoji-keyboard';

function CustomEmojiSelector({ onSelect, open, onClose }) {
  const handlePick = emojiObject => {
    // emojiObject: { emoji: '😀', name: 'grinning face', slug: 'grinning_face', v: '6.0' }
    onSelect(emojiObject.emoji);
    onClose();
  };

  return (
    <EmojiPicker
      onEmojiSelected={handlePick}
      open={open}
      onClose={onClose}
      // Optional customization
      enableRecentlyUsed={false} // Fresh selection each time per context
      enableSearchBar={true}
    />
  );
}
```

### Curated Emoji Row Component

```javascript
// Component for displaying curated emojis + add button
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useMemo } from 'react';
import { getCuratedEmojis } from '../utils/emojiRotation';

function CuratedEmojiRow({ photoId, onEmojiSelect, onAddPress, customPreview }) {
  // Memoize to prevent recalculation on re-renders
  const curatedEmojis = useMemo(() => getCuratedEmojis(photoId, 5), [photoId]);

  return (
    <View style={styles.row}>
      {curatedEmojis.map((emoji, index) => (
        <TouchableOpacity
          key={`${photoId}-${index}`}
          style={styles.emojiButton}
          onPress={() => onEmojiSelect(emoji)}
        >
          <Text style={styles.emoji}>{emoji}</Text>
        </TouchableOpacity>
      ))}

      {/* Add button OR preview of custom selection */}
      <TouchableOpacity
        style={styles.emojiButton}
        onPress={customPreview ? () => onEmojiSelect(customPreview) : onAddPress}
      >
        <Text style={styles.emoji}>{customPreview || '+'}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  emojiButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emoji: {
    fontSize: 24,
  },
});
```

### Integration with PhotoDetailModal

```javascript
// Updating usePhotoDetailModal hook
const [customEmoji, setCustomEmoji] = useState(null);
const [showEmojiPicker, setShowEmojiPicker] = useState(false);

// Get curated emojis based on current photo
const curatedEmojis = useMemo(() => getCuratedEmojis(currentPhoto?.id, 5), [currentPhoto?.id]);

// Combined emoji list: curated + custom preview slot
const displayEmojis = useMemo(() => {
  if (customEmoji) {
    return [...curatedEmojis.slice(0, 5), customEmoji];
  }
  return curatedEmojis;
}, [curatedEmojis, customEmoji]);
```

</code_examples>

<sota_updates>

## State of the Art (2025-2026)

| Old Approach                    | Current Approach             | When Changed | Impact                                      |
| ------------------------------- | ---------------------------- | ------------ | ------------------------------------------- |
| Native keyboard access attempts | Accept pure JS emoji pickers | Always true  | No native API ever existed for this         |
| react-native-emoji-input        | rn-emoji-keyboard            | 2023+        | Better performance, more active maintenance |
| Fixed emoji options             | Curated rotation per context | UX trend     | More engaging, less stale feeling           |

**New tools/patterns to consider:**

- **Unicode v17.0 (2025):** 164 new emojis proposed - filter by version for compatibility
- **Skin tone modifiers:** rn-emoji-keyboard supports long-press for skin tones since v1.0

**Deprecated/outdated:**

- **expo-emoji-keyboard:** Very low adoption (1 star), poor documentation - avoid
- **react-native-emoji-board:** Last published 6 years ago - avoid
- **Attempting native keyboard bridges:** No public iOS API exists - don't waste time
  </sota_updates>

<open_questions>

## Open Questions

Things that couldn't be fully resolved:

1. **Emoji version compatibility threshold**
   - What we know: Older devices may not render newer Unicode emojis
   - What's unclear: Exact cutoff for this app's target audience (iOS version minimum)
   - Recommendation: Start with Unicode v13 emojis (2020) for safety, expand if no issues

2. **Performance with many rapid reactions**
   - What we know: rn-emoji-keyboard scores 90 on performance benchmarks
   - What's unclear: Impact of opening picker on every "Add" tap in rapid succession
   - Recommendation: Monitor during implementation, add debounce if needed
     </open_questions>

<sources>
## Sources

### Primary (HIGH confidence)

- [rn-emoji-keyboard Documentation](https://docs.thewidlarzgroup.com/rn-emoji-keyboard/docs/documentation/about) - Official library docs
- [rn-emoji-keyboard GitHub](https://github.com/TheWidlarzGroup/rn-emoji-keyboard) - Source, issues, examples
- [React Native TextInput Docs](https://reactnative.dev/docs/textinput) - Keyboard types available
- [Unicode Full Emoji List v17.0](https://unicode.org/emoji/charts/full-emoji-list.html) - Official emoji data

### Secondary (MEDIUM confidence)

- [Apple Developer Forums - Emoji Keyboard](https://developer.apple.com/forums/thread/683363) - Confirms no API for forcing emoji keyboard
- [ISEmojiView GitHub](https://github.com/isaced/ISEmojiView) - Native iOS approach (for reference only)

### Tertiary (LOW confidence - needs validation)

- None - all critical findings verified against primary sources
  </sources>

<metadata>
## Metadata

**Research scope:**

- Core technology: React Native emoji input/picker
- Ecosystem: rn-emoji-keyboard, Unicode emoji standards
- Patterns: Curated rotation, deterministic selection, preview flow
- Pitfalls: Native keyboard myths, render consistency, visual parity

**Confidence breakdown:**

- Standard stack: HIGH - rn-emoji-keyboard is clearly the best RN option
- Architecture: HIGH - Patterns are straightforward, no complex dependencies
- Pitfalls: HIGH - Native keyboard limitation is well-documented
- Code examples: MEDIUM - Examples are conceptual, need validation during implementation

**Research date:** 2026-01-30
**Valid until:** 2026-03-01 (30 days - emoji ecosystem is stable)
</metadata>

---

_Phase: 11-feed-reaction-emoji_
_Research completed: 2026-01-30_
_Ready for planning: yes_
