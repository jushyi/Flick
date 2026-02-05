# Phase 30: Optimization and Performance Enhancements - Research

**Researched:** 2026-02-05
**Domain:** React Native performance optimization (Expo, image loading, list virtualization)
**Confidence:** HIGH

<research_summary>

## Summary

Researched the React Native/Expo performance optimization ecosystem for fixing monthly album photo loading and preparing the app for scale. The primary finding is that the codebase inconsistently uses image components: 24 files use React Native's unoptimized `Image` while only 10 files use the already-installed `expo-image` with proper caching.

The monthly album performance issue stems from two key problems: (1) using React Native's `Image` component which has unreliable caching and blocks the UI thread when resizing images, and (2) FlatLists missing optimization props like `getItemLayout`, `initialNumToRender`, and `windowSize`.

**Primary recommendation:** Migrate all image-heavy screens (MonthlyAlbumGridScreen, AlbumPhotoViewer, AlbumGridScreen) to `expo-image` with proper caching policies, priority settings, and placeholder/transition support. Add FlatList optimization props to all photo grids.

</research_summary>

<standard_stack>

## Standard Stack

### Core (Already Installed)

| Library                      | Version | Purpose                 | Why Standard                                                 |
| ---------------------------- | ------- | ----------------------- | ------------------------------------------------------------ |
| expo-image                   | ~3.0.11 | Optimized image loading | Expo's official solution with caching, priority, transitions |
| react-native-reanimated      | ~4.1.1  | Animations              | High-performance native animations                           |
| react-native-gesture-handler | ~2.28.0 | Gestures                | Native gesture handling                                      |

### Supporting (Consider Adding)

| Library                  | Version | Purpose                | When to Use                 |
| ------------------------ | ------- | ---------------------- | --------------------------- |
| @shopify/flash-list      | ^1.6.0  | List virtualization    | Photo grids with 100+ items |
| react-native-performance | ^5.0.0  | Performance monitoring | Production metrics tracking |

### Current Issue: Mixed Image Components

| Component Type       | Files Using | Problem                                     |
| -------------------- | ----------- | ------------------------------------------- |
| React Native `Image` | 24 files    | No caching, UI thread blocking, no priority |
| `expo-image`         | 10 files    | Properly optimized                          |

**Key files using unoptimized Image (Priority):**

- MonthlyAlbumGridScreen.js - PRIMARY ISSUE
- AlbumPhotoViewer.js - PRIMARY ISSUE (fullscreen + thumbnails)
- AlbumGridScreen.js - Album photo grid
- RecentlyDeletedScreen.js - Deleted photos grid
- SelectsScreen.js - Selects photo picking
- SelectsBanner.js - Selects slideshow
- AlbumPhotoPickerScreen.js - Photo picker

**Files already using expo-image (Good):**

- PhotoDetailScreen.js
- SwipeablePhotoCard.js
- MeStoryCard.js
- FriendStoryCard.js
- CommentRow.js/CommentInput.js

**Installation (expo-image already installed):**

```bash
# expo-image already in package.json v3.0.11
# For FlashList (optional but recommended for large grids):
npx expo install @shopify/flash-list
```

</standard_stack>

<architecture_patterns>

## Architecture Patterns

### Recommended: expo-image with Caching

**What:** Replace React Native `Image` with `expo-image` for all remote images
**When to use:** Any image loaded from a URL (Firebase Storage, CDN, etc.)
**Example:**

```typescript
// Source: Expo Image documentation
import { Image } from 'expo-image';

// Grid thumbnail - disk cache, normal priority
<Image
  source={{ uri: photo.imageURL }}
  style={styles.photoImage}
  contentFit="cover"
  cachePolicy="memory-disk"
  priority="normal"
  recyclingKey={photo.id}
  transition={200}
/>

// Full-screen photo - high priority, no transition needed
<Image
  source={{ uri: photo.imageURL }}
  style={styles.fullscreenPhoto}
  contentFit="cover"
  cachePolicy="memory-disk"
  priority="high"
/>

// Thumbnail in list - low priority, enable recycling
<Image
  source={{ uri: photo.imageURL }}
  style={styles.thumbnail}
  contentFit="cover"
  cachePolicy="memory-disk"
  priority="low"
  recyclingKey={`thumb-${photo.id}`}
/>
```

### Recommended: FlatList Optimization Props

**What:** Add optimization props to FlatLists displaying photos
**When to use:** Any FlatList with images, especially grids
**Example:**

```typescript
// Source: React Native FlatList documentation
<FlatList
  data={rowData}
  renderItem={renderRowItem}
  keyExtractor={item => item.key}
  // Performance optimizations
  getItemLayout={(data, index) => ({
    length: ROW_HEIGHT,
    offset: ROW_HEIGHT * index,
    index,
  })}
  initialNumToRender={8}  // Enough to fill screen
  maxToRenderPerBatch={4}  // Smaller batches for smoother scrolling
  windowSize={5}  // 2 screens above + 1 visible + 2 below
  removeClippedSubviews={true}  // Detach offscreen views
  // Memoization
  renderItem={useCallback(({ item }) => <PhotoRow item={item} />, [])}
/>
```

### Pattern: Prefetch for Known Navigation

**What:** Prefetch images before user navigates to a screen
**When to use:** When user interaction predicts next images needed
**Example:**

```typescript
// Source: Expo Image documentation
import { Image } from 'expo-image';

// Prefetch full-size images when viewing album grid
const handleAlbumOpen = async albumPhotos => {
  const firstFiveUrls = albumPhotos.slice(0, 5).map(p => p.imageURL);
  await Image.prefetch(firstFiveUrls);
};
```

### Anti-Patterns to Avoid

- **Using React Native `Image` for remote URLs:** No reliable caching, blocks UI thread during resize
- **Missing `getItemLayout` on fixed-height grids:** Forces async layout calculations
- **Loading full-size images for thumbnails:** Memory waste, slow rendering
- **Creating images in render loop:** Create once, update transforms only
- **Not using `recyclingKey` in lists:** Causes flicker when scrolling fast
  </architecture_patterns>

<dont_hand_roll>

## Don't Hand-Roll

| Problem             | Don't Build                            | Use Instead                             | Why                                                    |
| ------------------- | -------------------------------------- | --------------------------------------- | ------------------------------------------------------ |
| Image caching       | Custom AsyncStorage cache              | expo-image `cachePolicy`                | Native disk/memory cache is faster, handles edge cases |
| Image priority      | Custom loading queues                  | expo-image `priority` prop              | Native implementation handles system resources         |
| Placeholder shimmer | Custom animated views                  | expo-image `placeholder` + `transition` | Built-in cross-dissolve eliminates flicker             |
| List virtualization | Custom windowing                       | FlatList with props or FlashList        | Proven implementations handle recycling                |
| Image resizing      | Manual ImageManipulator before display | expo-image `contentFit`                 | Native resize is faster, automatic                     |
| Memory management   | Manual cache clearing                  | expo-image `cachePolicy`                | Library handles memory pressure                        |

**Key insight:** expo-image is already installed and solves the monthly album issue. The problem is inconsistent adoption - 24 files still use React Native's `Image`. Migration is the fix, not building new solutions.

</dont_hand_roll>

<common_pitfalls>

## Common Pitfalls

### Pitfall 1: Using React Native Image for Remote URLs

**What goes wrong:** Photos load slowly, app feels sluggish, memory spikes
**Why it happens:** RN Image has unreliable HTTP header-based caching, blocks UI thread during resize
**How to avoid:** Always use expo-image for remote URLs with `cachePolicy="memory-disk"`
**Warning signs:** Slow grid scrolling, blank cells during fast scroll, photos reloading on back navigation

### Pitfall 2: Missing FlatList Optimization Props

**What goes wrong:** Stuttery scrolling, delayed renders, blank areas while scrolling
**Why it happens:** FlatList has to calculate layouts async without `getItemLayout`
**How to avoid:** Always provide `getItemLayout` for fixed-height items, tune `windowSize` and `initialNumToRender`
**Warning signs:** JS thread spikes during scroll, visible layout jumps

### Pitfall 3: Loading Full Images for Thumbnails

**What goes wrong:** Memory bloat, slow initial load, potential OOM crashes
**Why it happens:** Downloading and decoding 3264x2448 image for 50x67 thumbnail
**How to avoid:** Use different image URLs for different sizes (Firebase Storage resize extension) OR let expo-image handle downscaling
**Warning signs:** High memory usage, slow grid population

### Pitfall 4: Not Using recyclingKey in Lists

**What goes wrong:** Image flicker when scrolling, wrong images briefly visible
**Why it happens:** View recycling shows old image before new one loads
**How to avoid:** Set `recyclingKey={photo.id}` on expo-image in lists
**Warning signs:** Brief flash of wrong image when scrolling fast

### Pitfall 5: Forgetting to Memoize renderItem

**What goes wrong:** Unnecessary re-renders, sluggish scrolling
**Why it happens:** New function created every render without useCallback
**How to avoid:** Wrap renderItem in useCallback or define outside component
**Warning signs:** High JS thread usage, slow scroll response
</common_pitfalls>

<code_examples>

## Code Examples

Verified patterns from official sources:

### expo-image Grid Cell (Primary Fix)

```javascript
// Source: Expo Image documentation + project context
import { Image } from 'expo-image';

// In MonthlyAlbumGridScreen renderRowItem
const PhotoCell = React.memo(({ photo, onPress }) => (
  <TouchableOpacity style={styles.photoCell} onPress={onPress} activeOpacity={0.8}>
    <Image
      source={{ uri: photo.imageURL }}
      style={styles.photoImage}
      contentFit="cover"
      cachePolicy="memory-disk"
      priority="normal"
      recyclingKey={photo.id}
      transition={150}
    />
  </TouchableOpacity>
));
```

### Optimized FlatList for Photo Grid

```javascript
// Source: React Native FlatList docs
<FlatList
  data={rowData}
  renderItem={renderRowItem}
  keyExtractor={item => item.key}
  // Critical optimizations
  getItemLayout={(_, index) => ({
    length: ROW_HEIGHT, // dayHeader height OR photoRow height
    offset: ROW_HEIGHT * index,
    index,
  })}
  initialNumToRender={6}
  maxToRenderPerBatch={3}
  windowSize={5}
  removeClippedSubviews={true}
  showsVerticalScrollIndicator={false}
/>
```

### Full-Screen Photo Viewer with expo-image

```javascript
// Source: Expo Image docs + current AlbumPhotoViewer pattern
import { Image } from 'expo-image';

const renderPhoto = useCallback(
  ({ item }) => (
    <TouchableOpacity activeOpacity={1} onPress={handleImagePress} style={styles.photoContainer}>
      <Image
        source={{ uri: item.imageURL }}
        style={styles.photo}
        contentFit="cover"
        cachePolicy="memory-disk"
        priority="high"
      />
    </TouchableOpacity>
  ),
  [handleImagePress]
);
```

### Thumbnail Strip with Recycling

```javascript
// Source: Expo Image docs
const renderThumbnail = useCallback(
  ({ item, index }) => (
    <TouchableOpacity
      onPress={() => goToIndex(index)}
      activeOpacity={0.8}
      style={styles.thumbnailWrapper}
    >
      <Image
        source={{ uri: item.imageURL }}
        style={[styles.thumbnail, index === currentIndex && styles.thumbnailActive]}
        contentFit="cover"
        cachePolicy="memory-disk"
        priority="low"
        recyclingKey={`thumb-${item.id}`}
      />
    </TouchableOpacity>
  ),
  [currentIndex, goToIndex]
);
```

</code_examples>

<sota_updates>

## State of the Art (2025-2026)

| Old Approach            | Current Approach             | When Changed | Impact                               |
| ----------------------- | ---------------------------- | ------------ | ------------------------------------ |
| RN Image for all images | expo-image for Expo projects | 2023-2024    | 50%+ faster loading, proper caching  |
| Manual image caching    | expo-image cachePolicy       | 2023         | Eliminates custom AsyncStorage hacks |
| FlatList only           | FlashList for large lists    | 2022-2023    | 10x faster, cell recycling           |
| Flipper for profiling   | Chrome DevTools via CDP      | 2024-2025    | RN moving away from Flipper          |
| JavaScriptCore          | Hermes (default)             | RN 0.70+     | 20-40% startup improvement           |

**New tools/patterns to consider:**

- **expo-image prefetch():** Preload images before navigation for instant display
- **FlashList:** Drop-in FlatList replacement with cell recycling (10x faster)
- **React Native Performance library:** Production metrics for identifying bottlenecks

**Deprecated/outdated:**

- **react-native-fast-image:** For Expo projects, expo-image is now preferred (better integration)
- **Manual image cache management:** expo-image handles this natively
- **Flipper for RN debugging:** Being phased out for Chrome DevTools
  </sota_updates>

<open_questions>

## Open Questions

Things that couldn't be fully resolved:

1. **Thumbnail image sizing**
   - What we know: Loading full-size images for thumbnails wastes memory
   - What's unclear: Does Firebase Storage have resize-on-the-fly capability, or do we need to generate thumbnails on upload?
   - Recommendation: Investigate Firebase Storage resize extension during implementation; if not available, expo-image's automatic downscaling may be sufficient

2. **FlashList adoption**
   - What we know: FlashList provides 10x performance over FlatList
   - What's unclear: Is the complexity worth it given expo-image migration may solve the issue?
   - Recommendation: Start with expo-image migration + FlatList optimization; add FlashList only if still needed

3. **Profiling baseline**
   - What we know: User reports monthly albums feel slow
   - What's unclear: No quantified metrics (FPS, time-to-first-image, memory)
   - Recommendation: Establish baseline metrics before optimization, measure after each change
     </open_questions>

<sources>
## Sources

### Primary (HIGH confidence)

- [Expo Image Documentation](https://docs.expo.dev/versions/latest/sdk/image/) - caching, priority, recycling props
- [React Native FlatList Optimization](https://reactnative.dev/docs/optimizing-flatlist-configuration) - getItemLayout, windowSize, batching
- [React Native Image](https://reactnative.dev/docs/image) - baseline comparison

### Secondary (MEDIUM confidence)

- [FlashList Documentation](https://shopify.github.io/flash-list/) - cell recycling, performance claims
- [React Native Performance Guide](https://reactnative.dev/docs/performance) - general optimization strategies
- [Hermes Engine Benefits](https://reactnative.dev/docs/hermes) - startup time, memory improvements

### Tertiary (verified via official docs)

- [Ficus Technologies - RN Image Optimization 2025](https://ficustechnologies.com/blog/react-native-image-optimization-2025-fastimage-caching-strategies-and-jank-free-scrolling/) - expo-image vs FastImage comparison
- [Medium - RN Image Performance Essentials](https://medium.com/@engin.bolat/react-native-image-optimization-performance-essentials-9e8ce6a1193e) - best practices verified
- [Shopify Engineering - FlatList to FlashList](https://shopify.engineering/instant-performance-upgrade-flatlist-flashlist) - migration benefits
  </sources>

<metadata>
## Metadata

**Research scope:**

- Core technology: React Native 0.81.5, Expo SDK 54, Hermes
- Ecosystem: expo-image (installed), FlashList (candidate), react-native-performance (candidate)
- Patterns: Image caching, list virtualization, memory management
- Pitfalls: RN Image issues, FlatList misconfiguration, memory leaks

**Confidence breakdown:**

- Standard stack: HIGH - expo-image is official Expo solution, already installed
- Architecture: HIGH - patterns from official documentation
- Pitfalls: HIGH - verified against codebase findings (24 files using unoptimized Image)
- Code examples: HIGH - adapted from official docs for project context

**Codebase findings:**

- 24 files using React Native `Image` (unoptimized)
- 10 files using `expo-image` (optimized)
- Only 2 files use `getItemLayout` for FlatList optimization
- Primary issue: MonthlyAlbumGridScreen + AlbumPhotoViewer use RN Image

**Research date:** 2026-02-05
**Valid until:** 2026-03-05 (30 days - RN/Expo ecosystem stable)
</metadata>

---

_Phase: 30-optimization-performance_
_Research completed: 2026-02-05_
_Ready for planning: yes_
