# Phase 36: Comments Feature - Research

**Researched:** 2026-01-26
**Domain:** React Native comments system with threaded replies, media support, bottom sheet UX
**Confidence:** HIGH

<research_summary>

## Summary

Researched the ecosystem for implementing Instagram-style threaded comments in React Native with Expo SDK 54. The feature requires a bottom sheet with keyboard handling, Giphy integration for GIF comments, and Firestore data modeling for threaded replies.

Key finding: The project's current Expo SDK 54 + Reanimated v4.1.1 combination has known compatibility issues with @gorhom/bottom-sheet v5. Two viable approaches exist: (1) extend the existing custom Animated bottom sheet with manual keyboard handling, or (2) install @gorhom/bottom-sheet and accept potential issues. The custom approach aligns with existing codebase patterns.

**Primary recommendation:** Use custom Animated bottom sheet (extending existing DarkroomBottomSheet pattern) with KeyboardAvoidingView for keyboard handling. For Giphy, use @giphy/react-native-sdk which requires a dev client (not Expo Go). For threaded comments, use Firestore subcollection with parent reference model.
</research_summary>

<standard_stack>

## Standard Stack

The established libraries/tools for this domain:

### Core (Already Installed)

| Library                      | Version  | Purpose            | Why Standard                                   |
| ---------------------------- | -------- | ------------------ | ---------------------------------------------- |
| react-native-reanimated      | ~4.1.1   | Animations         | Already in project, powers smooth transitions  |
| react-native-gesture-handler | ~2.28.0  | Gesture handling   | Already in project, enables swipe/pan gestures |
| expo-image-picker            | ~17.0.10 | Camera roll access | Already in project, handles image selection    |
| expo-image                   | ~3.0.11  | Fast image display | Already in project, handles thumbnails         |

### New Dependencies Required

| Library                 | Version | Purpose                 | When to Use                                  |
| ----------------------- | ------- | ----------------------- | -------------------------------------------- |
| @giphy/react-native-sdk | ^3.3.2+ | GIF picker              | Media comments feature                       |
| @gorhom/bottom-sheet    | ^5.2.8  | Bottom sheet (OPTIONAL) | Only if keyboard handling proves too complex |

### Alternatives Considered

| Instead of              | Could Use                      | Tradeoff                                                                                    |
| ----------------------- | ------------------------------ | ------------------------------------------------------------------------------------------- |
| @gorhom/bottom-sheet    | Custom Animated Modal          | Custom avoids Expo 54 compatibility issues, more control, matches existing codebase pattern |
| @giphy/react-native-sdk | GIPHY API direct calls         | SDK provides better UX (search, trending), but requires dev client                          |
| expo-image-picker       | react-native-image-crop-picker | Expo picker already installed, no need for alternative                                      |

**Installation:**

```bash
# Giphy SDK (requires dev client, not Expo Go)
npx expo install @giphy/react-native-sdk

# Optional: only if keyboard issues arise with custom approach
npx expo install @gorhom/bottom-sheet
```

**Important:** @giphy/react-native-sdk is NOT available in Expo Go - requires custom dev client build.
</standard_stack>

<architecture_patterns>

## Architecture Patterns

### Recommended Project Structure

```
src/
├── components/
│   ├── comments/
│   │   ├── CommentsBottomSheet.js    # Main bottom sheet container
│   │   ├── CommentInput.js           # Input with GIF/image buttons
│   │   ├── CommentRow.js             # Single comment display
│   │   ├── CommentReply.js           # Reply component (indented)
│   │   ├── CommentPreview.js         # Inline preview for feed cards
│   │   └── GifPicker.js              # Giphy search modal
│   └── ...
├── services/firebase/
│   └── commentService.js             # CRUD for comments
├── hooks/
│   └── useComments.js                # Comment state & real-time updates
└── ...
```

### Pattern 1: Firestore Threaded Comments (Parent Reference Model)

**What:** One-level threading using `parentId` field - matches Instagram's reply depth
**When to use:** Any threaded comments system with single reply depth
**Example:**

```javascript
// Firestore structure
photos/{photoId}/comments/{commentId}
{
  userId: string,
  text: string,
  mediaUrl: string | null,      // For image/GIF comments
  mediaType: 'image' | 'gif' | null,
  parentId: string | null,       // null = top-level, id = reply
  likeCount: number,
  createdAt: serverTimestamp(),
}

// Separate collection for likes (enables unlike without knowing like doc ID)
photos/{photoId}/comments/{commentId}/likes/{likeId}
{
  odId: `${photoId}_${commentId}_${userId}`, // Deterministic ID
  userId: string,
  createdAt: serverTimestamp(),
}
```

### Pattern 2: Custom Bottom Sheet with Keyboard Handling

**What:** Extend existing DarkroomBottomSheet pattern with keyboard awareness
**When to use:** When @gorhom/bottom-sheet has compatibility issues (Expo 54 case)
**Example:**

```javascript
// Use KeyboardAvoidingView inside the bottom sheet
import { KeyboardAvoidingView, Platform } from 'react-native';

const CommentsBottomSheet = ({ visible, onClose }) => {
  return (
    <Modal visible={visible} transparent animationType="slide">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <View style={styles.sheet}>
          <FlatList
            data={comments}
            renderItem={renderComment}
            inverted={false}
            keyboardShouldPersistTaps="handled"
          />
          <CommentInput onSubmit={handleSubmit} />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};
```

### Pattern 3: Optimistic UI for Comment Likes

**What:** Update UI immediately, sync to Firestore in background
**When to use:** All user interactions (likes, posts)
**Example:**

```javascript
const toggleCommentLike = async commentId => {
  // Optimistic update
  setComments(prev =>
    prev.map(c =>
      c.id === commentId
        ? { ...c, likeCount: c.isLiked ? c.likeCount - 1 : c.likeCount + 1, isLiked: !c.isLiked }
        : c
    )
  );

  // Firestore sync (fire and forget)
  try {
    await commentService.toggleLike(photoId, commentId, userId);
  } catch (error) {
    // Revert on failure
    setComments(prev =>
      prev.map(c =>
        c.id === commentId
          ? { ...c, likeCount: c.isLiked ? c.likeCount - 1 : c.likeCount + 1, isLiked: !c.isLiked }
          : c
      )
    );
  }
};
```

### Pattern 4: Owner Comment as Caption

**What:** Photo owner's first comment displays prominently as caption
**When to use:** Self-comment prioritization in preview
**Example:**

```javascript
const getPreviewComments = (comments, photoOwnerId) => {
  const ownerComment = comments.find(c => c.userId === photoOwnerId && !c.parentId);
  const recentComments = comments
    .filter(c => c.id !== ownerComment?.id && !c.parentId)
    .slice(0, ownerComment ? 1 : 2); // Show 1 if caption exists, 2 otherwise

  return ownerComment ? [ownerComment, ...recentComments] : recentComments;
};
```

### Anti-Patterns to Avoid

- **Nested subcollections for replies:** Creates query complexity; use flat collection with parentId instead
- **Storing all comments in photo document:** Document size limit (1MB) will be hit; use subcollection
- **Realtime listener on all comments:** Expensive; paginate and load replies on demand
- **KeyboardAvoidingView wrapping entire screen:** Only wrap the bottom sheet content, not the photo above it
  </architecture_patterns>

<dont_hand_roll>

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem                     | Don't Build            | Use Instead                           | Why                                                   |
| --------------------------- | ---------------------- | ------------------------------------- | ----------------------------------------------------- |
| GIF search & selection      | Custom GIPHY API calls | @giphy/react-native-sdk               | SDK handles caching, trending, search UX, attribution |
| Image picker                | Custom media access    | expo-image-picker                     | Already installed, handles permissions, cropping      |
| Keyboard position detection | Manual keyboard events | KeyboardAvoidingView + Platform check | Built-in, handles iOS/Android differences             |
| Comment count updates       | Manual count tracking  | FieldValue.increment()                | Atomic, handles race conditions                       |
| Real-time comment updates   | Polling                | onSnapshot listener                   | Built-in Firestore, efficient                         |

**Key insight:** The main complexity is UI/UX (keyboard handling with bottom sheet, smooth animations) not data modeling. Firestore subcollection patterns are well-established in this codebase. Focus effort on the bottom sheet interaction, not reinventing comment storage.
</dont_hand_roll>

<common_pitfalls>

## Common Pitfalls

### Pitfall 1: @gorhom/bottom-sheet + Expo SDK 54 Compatibility

**What goes wrong:** "TypeError: Cannot read property 'level' of undefined" when using bottom-sheet v5 with Expo 54 + Reanimated v4
**Why it happens:** bottom-sheet v5 was built for Reanimated v3, peer deps incorrectly allow v4
**How to avoid:** Use custom Animated bottom sheet (like DarkroomBottomSheet) OR downgrade reanimated to ^3.19.1 (may break other things)
**Warning signs:** App crashes on physical device, works in simulator

### Pitfall 2: Giphy SDK in Expo Go

**What goes wrong:** "@giphy/react-native-sdk" not working, module not found errors
**Why it happens:** Giphy SDK uses native modules not available in Expo Go
**How to avoid:** Build a custom dev client (`npx expo prebuild && npx expo run:ios`) OR defer Giphy to later phase
**Warning signs:** "Cannot find module" errors in Expo Go

### Pitfall 3: Keyboard Covering Input on Android

**What goes wrong:** Comment input hidden behind keyboard
**Why it happens:** Android keyboard behavior differs from iOS; KeyboardAvoidingView behavior prop needs platform-specific handling
**How to avoid:** Use `behavior={Platform.OS === 'ios' ? 'padding' : 'height'}` and test on both platforms
**Warning signs:** Works on iOS but not Android (or vice versa)

### Pitfall 4: Bottom Sheet Blocks Photo Context

**What goes wrong:** User loses sight of photo they're commenting on
**Why it happens:** Bottom sheet covers entire screen when expanded
**How to avoid:** Limit sheet height to ~60% of screen, keep photo visible at top
**Warning signs:** Users asking "which photo am I commenting on?"

### Pitfall 5: Comment Thread Query Performance

**What goes wrong:** Slow loading for photos with many comments
**Why it happens:** Loading all comments + replies at once
**How to avoid:** Paginate top-level comments (10-20 at a time), lazy load replies on "View replies" tap
**Warning signs:** Feed photos with 100+ comments cause lag
</common_pitfalls>

<code_examples>

## Code Examples

Verified patterns from official sources:

### Firestore Comment CRUD with Increment

```javascript
// Source: Firebase docs - FieldValue.increment
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  increment,
  query,
  where,
  orderBy,
  limit,
} from 'firebase/firestore';
import { db } from './firebase';

export const addComment = async (
  photoId,
  userId,
  text,
  mediaUrl = null,
  mediaType = null,
  parentId = null
) => {
  const commentsRef = collection(db, 'photos', photoId, 'comments');

  const commentDoc = await addDoc(commentsRef, {
    userId,
    text,
    mediaUrl,
    mediaType,
    parentId,
    likeCount: 0,
    createdAt: serverTimestamp(),
  });

  // Update photo's comment count
  await updateDoc(doc(db, 'photos', photoId), {
    commentCount: increment(1),
  });

  return commentDoc.id;
};

export const deleteComment = async (photoId, commentId) => {
  await deleteDoc(doc(db, 'photos', photoId, 'comments', commentId));
  await updateDoc(doc(db, 'photos', photoId), {
    commentCount: increment(-1),
  });
};
```

### Keyboard Avoiding Bottom Sheet

```javascript
// Source: React Native docs + Expo keyboard handling guide
import {
  Modal,
  View,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Dimensions,
  PanResponder,
} from 'react-native';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const SHEET_HEIGHT = SCREEN_HEIGHT * 0.6; // 60% of screen

const CommentsBottomSheet = ({ visible, onClose, children }) => {
  const translateY = useRef(new Animated.Value(SHEET_HEIGHT)).current;

  useEffect(() => {
    Animated.spring(translateY, {
      toValue: visible ? 0 : SHEET_HEIGHT,
      useNativeDriver: true,
    }).start();
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardAvoid}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          <Animated.View style={[styles.sheet, { transform: [{ translateY }] }]}>
            {children}
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};
```

### GIPHY SDK Integration

```javascript
// Source: @giphy/react-native-sdk docs
import { GiphyDialog, GiphyDialogEvent, GiphyMedia } from '@giphy/react-native-sdk';

// Initialize once at app startup
GiphyDialog.configure({ apiKey: 'YOUR_GIPHY_API_KEY' });

// In component
const openGifPicker = () => {
  GiphyDialog.show();
};

useEffect(() => {
  const listener = GiphyDialog.addListener(
    GiphyDialogEvent.MediaSelected,
    (media: GiphyMedia) => {
      // media.url contains the GIF URL
      handleGifSelected(media.url);
      GiphyDialog.hide();
    }
  );
  return () => listener.remove();
}, []);
```

</code_examples>

<sota_updates>

## State of the Art (2025-2026)

What's changed recently:

| Old Approach             | Current Approach                          | When Changed | Impact                                              |
| ------------------------ | ----------------------------------------- | ------------ | --------------------------------------------------- |
| Custom keyboard handling | react-native-keyboard-controller          | 2024         | Better consistency iOS/Android, but adds dependency |
| @gorhom/bottom-sheet v4  | v5 (Reanimated v3)                        | 2024         | Breaking change with Reanimated v4/Expo 54          |
| GIPHY API manual calls   | @giphy/react-native-sdk                   | 2023+        | SDK handles UX, caching, attribution                |
| Flat comment arrays      | Subcollections + collection group queries | 2019+        | Scale to any comment count                          |

**New tools/patterns to consider:**

- **react-native-keyboard-controller:** More robust keyboard handling than KeyboardAvoidingView, recommended by @gorhom/bottom-sheet docs
- **Expo Dev Client:** Required for native modules like Giphy SDK; build once, use for all testing

**Deprecated/outdated:**

- **@gorhom/bottom-sheet v4:** Superseded by v5, but v5 has Expo 54 issues
- **In-document comment arrays:** Don't store comments in photo document; use subcollection
  </sota_updates>

<open_questions>

## Open Questions

Things that couldn't be fully resolved:

1. **@gorhom/bottom-sheet + Expo 54 Timeline**
   - What we know: Issue exists with Reanimated v4, commit d12f3f7 may address it, v5.2.8 released Dec 2025
   - What's unclear: Whether v5.2.8 fully resolves the issue on physical devices
   - Recommendation: Start with custom Animated approach (lower risk), revisit @gorhom if keyboard handling proves too complex

2. **Giphy SDK Dev Client Requirement**
   - What we know: SDK requires native modules, won't work in Expo Go
   - What's unclear: User's willingness to maintain dev client for this feature
   - Recommendation: Treat Giphy as optional enhancement; implement text/image comments first, add GIFs if dev client already exists

3. **Comment Notifications Integration**
   - What we know: Project has existing notification system (Cloud Functions)
   - What's unclear: Exact trigger pattern for comment notifications
   - Recommendation: Follow existing reaction notification pattern (onCreate trigger)
     </open_questions>

<sources>
## Sources

### Primary (HIGH confidence)

- [Firebase Firestore Best Practices](https://firebase.google.com/docs/firestore/best-practices) - subcollection patterns, FieldValue.increment
- [Expo ImagePicker Documentation](https://docs.expo.dev/versions/latest/sdk/imagepicker/) - media library access
- [Expo Keyboard Handling Guide](https://docs.expo.dev/guides/keyboard-handling/) - KeyboardAvoidingView patterns
- [@gorhom/bottom-sheet Documentation](https://gorhom.dev/react-native-bottom-sheet/) - BottomSheetTextInput, keyboard handling

### Secondary (MEDIUM confidence)

- [Fireship Advanced Data Modeling](https://fireship.io/lessons/advanced-firestore-nosql-data-structure-examples/) - threaded comments pattern, verified against Firebase docs
- [GitHub Issue #2471](https://github.com/gorhom/react-native-bottom-sheet/issues/2471) - Expo 54 compatibility issues, workarounds confirmed by multiple users
- [GIPHY React Native SDK GitHub](https://github.com/Giphy/giphy-react-native-sdk) - integration patterns, Expo compatibility notes

### Tertiary (LOW confidence - needs validation)

- Custom bottom sheet keyboard handling - based on existing DarkroomBottomSheet pattern, needs testing
- Dev client requirement for Giphy - confirmed in docs but not personally tested
  </sources>

<metadata>
## Metadata

**Research scope:**

- Core technology: React Native comments with Expo SDK 54
- Ecosystem: Bottom sheet libraries, Giphy SDK, Firestore subcollections
- Patterns: Threaded comments, keyboard handling, optimistic UI
- Pitfalls: Expo 54 compatibility, native module requirements

**Confidence breakdown:**

- Standard stack: HIGH - mostly already installed, Giphy well-documented
- Architecture: HIGH - Firestore subcollection patterns established in codebase
- Pitfalls: HIGH - Expo 54 + bottom-sheet issues confirmed by multiple sources
- Code examples: MEDIUM - based on docs but custom bottom sheet needs testing

**Research date:** 2026-01-26
**Valid until:** 2026-02-26 (30 days - React Native ecosystem relatively stable)
</metadata>

---

_Phase: 36-comments-feature_
_Research completed: 2026-01-26_
_Ready for planning: yes_
