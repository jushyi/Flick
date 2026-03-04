# Phase 11: Add Video Support to Main Camera - Research

**Researched:** 2026-03-04
**Domain:** Video capture, upload, playback, and integration into existing photo lifecycle
**Confidence:** MEDIUM

## Summary

Adding video support to the Flick camera requires changes across five major systems: (1) camera capture (expo-camera `mode` prop + `recordAsync`), (2) upload pipeline (new storage upload function + Firestore schema extension), (3) darkroom (video icon overlay on developing tiles), (4) feed (autoplay muted with expo-video), and (5) PhotoDetail/stories (video playback with progress bar and mute controls). The interaction model -- tap for photo, hold for video -- requires replacing the current `Pressable` shutter with gesture detection that distinguishes taps from long presses.

The critical architectural decision is the expo-camera `mode` prop. CameraView requires `mode="video"` to call `recordAsync`, but switching modes at runtime causes reconfiguration delays and known issues (dead frames on iOS). The recommended approach is to **keep the camera in `video` mode at all times** and use `takePictureAsync` from video mode, which works but has minor quality trade-offs. Alternatively, start in `picture` mode and switch to `video` on long-press with a brief delay before recording starts (the ~0.5s hold threshold absorbs this reconfiguration time naturally).

`expo-video` is the required playback library (expo-av is deprecated, removed in SDK 55). It is included in Expo Go and the existing SDK 54 runtime, so **no new native EAS build is needed** for the JS-side playback. However, enabling microphone permission for video recording (`microphonePermission` is currently `false` in app.json expo-camera plugin config) and adding `expo-video` as a native dependency **will require a new EAS build**. Firebase Storage rules must also be updated to allow `video/*` content types alongside `image/*`.

**Primary recommendation:** Use `expo-camera` with dynamic mode switching (leveraging the ~500ms hold threshold as natural reconfiguration buffer), `expo-video` for playback, and extend the existing upload queue and Firestore schema with a `mediaType` discriminator field.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Hold to record, tap for photo -- no explicit mode toggle
- ~0.5s hold threshold before recording begins; releasing before threshold captures a photo
- 30 second maximum duration, auto-stops at limit with no warning
- Circular progress ring around the shutter button fills during recording
- Always record audio
- Front/back camera switch during recording if technically feasible, otherwise lock once recording starts
- Torch stays on during recording if flash was enabled beforehand
- Light haptic feedback on recording start and stop
- Videos behave identically to photos in the darkroom (same 0-5 minute random developing timer, same blurred/hidden thumbnail treatment while developing, small video icon overlay to distinguish from photos)
- Autoplay muted when video scrolls into view in feed
- Tap to unmute; once unmuted, sound stays on for subsequent videos until user mutes again
- Videos loop continuously in feed until user scrolls away
- Small duration badge (e.g. "0:12") in the corner of the video card
- PhotoDetail modal carries the current sound state from the feed (muted or unmuted)
- Progress bar + mute/unmute toggle in PhotoDetail -- reuses the existing photo progress bar component
- Videos loop in PhotoDetail
- Stories: same progress bar + mute toggle as PhotoDetail, video plays once to completion then auto-advances to next story, no looping in stories, photos continue to work as they do now (no auto-advance)
- Long press shutter = video, tap shutter = photo, no explicit photo/video toggle UI, no hint text or label

### Claude's Discretion
- Video compression and quality settings
- Thumbnail generation approach (which frame to use)
- Upload queue handling for videos vs photos
- Video file format choice
- Progress ring animation style and color

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| expo-camera | ~17.0.10 | Video recording via `recordAsync` + photo via `takePictureAsync` | Already installed; CameraView supports `mode="video"` prop |
| expo-video | ~2.x (SDK 54) | Video playback (`VideoView` + `useVideoPlayer`) | Official Expo replacement for expo-av; included in Expo Go; supports autoplay, looping, muted playback |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| expo-file-system | ~19.0.21 (installed) | Read video file for base64 thumbnail, get file info | Thumbnail generation, file size checks |
| react-native-reanimated | ~4.1.1 (installed) | Progress ring animation on shutter button | Smooth circular progress during recording |
| expo-haptics | ~15.0.8 (installed) | Haptic feedback on recording start/stop | Already used for photo capture |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| expo-video | react-native-video | More features but requires separate native module; expo-video is official Expo solution and already in runtime |
| expo-camera recordAsync | react-native-vision-camera | More powerful video API but requires new native dependency; expo-camera already installed |
| expo-video-thumbnails | expo-video generateThumbnailsAsync | expo-video-thumbnails is deprecated (removed in SDK 56); generateThumbnailsAsync is built into expo-video |

**Installation:**
```bash
npx expo install expo-video
```

**IMPORTANT: Requires new EAS build** because:
1. `expo-video` adds native modules (even though it's in Expo Go, adding to a production build with CNG requires rebuild)
2. `microphonePermission` change in expo-camera plugin config modifies native Info.plist
3. Storage rules changes require `firebase deploy --only storage`

## Architecture Patterns

### Recommended Project Structure
```
src/
├── hooks/
│   ├── useCameraBase.js          # Extended: add recording state, hold gesture logic
│   ├── useCamera.ios.js          # Extended: iOS-specific recording behavior
│   ├── useCamera.android.js      # Extended: Android-specific recording behavior
│   └── useVideoPlayback.js       # NEW: shared video player management for feed/detail/stories
├── services/
│   ├── uploadQueueService.js     # Extended: handle video uploads (larger files, different content type)
│   └── firebase/
│       ├── storageService.js     # Extended: uploadVideo function (no image compression, just putFile)
│       └── photoService.js       # Extended: createPhoto accepts mediaType field
├── components/
│   ├── FeedPhotoCard.js          # Extended: video playback with expo-video when mediaType === 'video'
│   ├── FeedVideoCard.js          # NEW (optional): separate component for video cards in feed
│   ├── VideoPlayer.js            # NEW: wrapper around expo-video VideoView with mute/progress controls
│   ├── RecordingProgressRing.js  # NEW: circular SVG progress ring for shutter button
│   └── SwipeablePhotoCard.js     # Extended: video icon overlay, thumbnail display for videos
├── screens/
│   ├── CameraScreen.js           # Extended: hold-to-record gesture, progress ring, mode switching
│   ├── PhotoDetailScreen.js      # Extended: video playback mode with progress bar + mute toggle
│   └── DarkroomScreen.js         # Minimal change: video icon overlay via SwipeablePhotoCard
└── context/
    └── VideoMuteContext.js        # NEW: global mute state (persists across feed -> detail -> stories)
```

### Pattern 1: Camera Mode Switching with Hold Threshold
**What:** Use the ~500ms hold threshold as a natural buffer for camera mode reconfiguration
**When to use:** On shutter button interaction
**Example:**
```javascript
// In useCameraBase.js
const HOLD_THRESHOLD_MS = 500;
const MAX_RECORDING_DURATION = 30;

const holdTimerRef = useRef(null);
const [isRecording, setIsRecording] = useState(false);
const [cameraMode, setCameraMode] = useState('picture'); // Start in picture mode

const handlePressIn = useCallback(() => {
  lightImpact();
  // Start timer -- if held past threshold, switch to video mode and start recording
  holdTimerRef.current = setTimeout(async () => {
    setCameraMode('video');
    // Small delay for camera reconfiguration
    await new Promise(resolve => setTimeout(resolve, 100));
    lightImpact(); // Recording start haptic
    setIsRecording(true);
    const result = await cameraRef.current.recordAsync({
      maxDuration: MAX_RECORDING_DURATION,
    });
    // result.uri contains the video file
    handleRecordingComplete(result);
  }, HOLD_THRESHOLD_MS);
}, []);

const handlePressOut = useCallback(() => {
  if (holdTimerRef.current) {
    clearTimeout(holdTimerRef.current);
    holdTimerRef.current = null;
  }
  if (isRecording) {
    // Stop recording
    lightImpact(); // Recording stop haptic
    cameraRef.current.stopRecording();
    setIsRecording(false);
    setCameraMode('picture'); // Switch back to picture mode
  } else {
    // Was a tap -- take photo (camera is still in picture mode)
    takePicture();
  }
}, [isRecording]);
```

### Pattern 2: Video Upload Queue Extension
**What:** Extend uploadQueueService to handle both photos and videos
**When to use:** After video recording completes
**Example:**
```javascript
// Extended addToQueue with mediaType
export const addToQueue = async (userId, mediaUri, mediaType = 'photo') => {
  const queueItem = {
    id: generateId(),
    mediaUri, // renamed from photoUri
    userId,
    mediaType, // 'photo' | 'video'
    createdAt: Date.now(),
    attempts: 0,
    status: 'pending',
  };
  queue.push(queueItem);
  await saveQueue();
  processQueue();
  return queueItem.id;
};
```

### Pattern 3: Global Mute State
**What:** Track whether user has unmuted videos, persisted across feed/detail/stories navigation
**When to use:** Feed autoplay muted, user taps to unmute, stays unmuted across views
**Example:**
```javascript
// VideoMuteContext.js
const VideoMuteContext = createContext({ isMuted: true, toggleMute: () => {} });

export const VideoMuteProvider = ({ children }) => {
  const [isMuted, setIsMuted] = useState(true);
  const toggleMute = useCallback(() => setIsMuted(prev => !prev), []);
  return (
    <VideoMuteContext.Provider value={{ isMuted, toggleMute }}>
      {children}
    </VideoMuteContext.Provider>
  );
};
```

### Pattern 4: Feed Autoplay with Viewport Detection
**What:** Play videos when they scroll into view, pause when they scroll out
**When to use:** Feed video cards
**Example:**
```javascript
// Use onViewableItemsChanged from FlatList/ScrollView
// or IntersectionObserver-like pattern with measure + scroll position
const player = useVideoPlayer(videoUrl, (p) => {
  p.loop = true;
  p.muted = isMuted;
});

// When item enters viewport:
player.play();
// When item leaves viewport:
player.pause();
```

### Anti-Patterns to Avoid
- **Switching camera mode mid-gesture:** Don't switch from `picture` to `video` mode and immediately call `recordAsync` -- the camera needs reconfiguration time. Use the hold threshold delay.
- **Creating VideoPlayer instances for all feed items:** expo-video players consume resources. Only create players for visible/near-visible items. Destroy when scrolled far away.
- **Storing video as base64 in Firestore:** Videos are large. Store the URL in Firestore, the file in Firebase Storage.
- **Using expo-av for playback:** Deprecated, removed in SDK 55. Use expo-video.
- **Compressing video with ImageManipulator:** expo-image-manipulator is for images only. Use expo-camera's built-in quality/bitrate settings for video compression.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Video playback | Custom AVPlayer/ExoPlayer wrapper | expo-video `VideoView` + `useVideoPlayer` | Handles platform differences, loop/mute/seek, memory management |
| Thumbnail generation | FFmpeg frame extraction | expo-video `generateThumbnailsAsync` | Built into expo-video, returns native image refs compatible with expo-image |
| Circular progress animation | Manual SVG arc calculation | react-native-reanimated + react-native-svg animated circle | Precise stroke-dasharray animation on UI thread |
| Video compression | Custom FFmpeg pipeline | expo-camera `recordAsync` quality/bitrate options | Camera handles encoding during capture; post-capture compression rarely needed |
| Viewport detection | Manual scroll + measure calculations | `onViewableItemsChanged` on FlatList/VirtualizedList | Built-in, performant, handles edge cases |

**Key insight:** The video pipeline is fundamentally different from photos at capture (streaming vs snapshot) and playback (stateful player vs static image), but the metadata lifecycle (developing -> revealed -> journal/archive) is identical. Reuse the photo lifecycle, extend the schema.

## Common Pitfalls

### Pitfall 1: Camera Mode Switching Delay
**What goes wrong:** Calling `recordAsync` immediately after setting `mode="video"` produces dead frames or fails silently on iOS
**Why it happens:** iOS requires full AVCaptureSession reconfiguration when switching between photo and video output
**How to avoid:** The user's ~500ms hold threshold naturally absorbs this delay. Add a small safety buffer (100ms) after mode switch before calling `recordAsync`. Test on physical iOS devices.
**Warning signs:** First ~200ms of video is black/frozen; `recordAsync` resolves immediately with no URI

### Pitfall 2: Video File Size
**What goes wrong:** 30-second videos at high quality are 50-100MB, causing upload failures and Firebase Storage costs
**Why it happens:** Default camera quality is high; no compression applied
**How to avoid:** Use `videoQuality: '720p'` and set `videoBitrate` (recommend 2-4 Mbps). A 30s video at 720p/3Mbps is ~11MB.
**Warning signs:** Upload takes >10 seconds on WiFi; users on cellular see failures

### Pitfall 3: Firebase Storage Rules Block Video Upload
**What goes wrong:** Video upload returns permission denied
**Why it happens:** Current storage rules only allow `image/*` content types: `request.resource.contentType.matches('image/.*')`
**How to avoid:** Update `storage.rules` for `photos/` path to allow both `image/*` and `video/*` content types. Also update file size limit (current 10MB is too small for video).
**Warning signs:** Storage upload fails with "PERMISSION_DENIED" even though auth is correct

### Pitfall 4: Microphone Permission Not Configured
**What goes wrong:** Videos record without audio, or recording fails on iOS
**Why it happens:** `microphonePermission` is set to `false` in app.json expo-camera plugin config
**How to avoid:** Change `microphonePermission` to a permission string (e.g., "Allow Flick to access your microphone to record video with audio."). This requires a new EAS build.
**Warning signs:** Silent videos; iOS permission dialog never appears for microphone

### Pitfall 5: Multiple Video Players in Feed
**What goes wrong:** Memory pressure crashes app, especially on older devices
**Why it happens:** Each `useVideoPlayer` instance allocates native playback resources; feed could have many video items
**How to avoid:** Only create video players for items currently visible + 1 item ahead. Use `onViewableItemsChanged` to manage player lifecycle. Consider a player pool (max 3 concurrent players).
**Warning signs:** App slows down after scrolling through many videos; memory warnings in logs

### Pitfall 6: Camera Facing Switch During Recording
**What goes wrong:** Recording stops when user flips camera during video recording
**Why it happens:** expo-camera documentation states: "Flipping camera during a recording results in stopping it"
**How to avoid:** Lock camera facing once recording starts. Disable the flip button during recording. This aligns with the user's decision: "Front/back camera switch during recording if technically feasible, otherwise lock once recording starts." Lock it.
**Warning signs:** Video recording stops abruptly; user gets a truncated video

### Pitfall 7: Stories Auto-Advance Timing
**What goes wrong:** Video in stories doesn't auto-advance, or advances before video finishes
**Why it happens:** Photos use a fixed timer for stories; videos have variable duration
**How to avoid:** For videos in stories, listen to expo-video's `playToEnd` event to trigger advance instead of a timer. Photos continue using the existing timer.
**Warning signs:** Stories freeze on video, or skip video before it plays

## Code Examples

### expo-camera Video Recording
```javascript
// Source: https://docs.expo.dev/versions/latest/sdk/camera/
import { CameraView } from 'expo-camera';

// CameraView with video mode
<CameraView
  ref={cameraRef}
  style={styles.camera}
  facing={facing}
  flash={flash}
  zoom={zoom.cameraZoom}
  mode="video"           // Required for recordAsync
  mute={false}           // Record with audio
  videoQuality="720p"    // Balance quality and file size
  videoBitrate={3000000} // 3 Mbps
/>

// Start recording
const result = await cameraRef.current.recordAsync({
  maxDuration: 30, // 30 seconds max
});
// result.uri is the video file path

// Stop recording (resolves the recordAsync promise)
cameraRef.current.stopRecording();
```

### expo-video Playback
```javascript
// Source: https://docs.expo.dev/versions/latest/sdk/video/
import { VideoView, useVideoPlayer } from 'expo-video';
import { useEvent } from 'expo';

const player = useVideoPlayer(videoUrl, (player) => {
  player.loop = true;
  player.muted = true;  // Autoplay muted in feed
});

// Listen for playback end (for stories auto-advance)
useEvent(player, 'playToEnd', () => {
  onVideoComplete(); // Advance to next story
});

// Listen for time updates (for progress bar)
const { currentTime } = useEvent(player, 'timeUpdate', {
  currentTime: player.currentTime,
});

<VideoView
  player={player}
  style={styles.video}
  contentFit="cover"
  nativeControls={false}  // Custom controls
/>
```

### expo-video Thumbnail Generation
```javascript
// Source: https://docs.expo.dev/versions/latest/sdk/video/
// generateThumbnailsAsync is a method on the VideoPlayer instance
const player = useVideoPlayer(videoUrl);
const thumbnails = await player.generateThumbnailsAsync([0], {
  maxWidth: 20,  // Tiny thumbnail for progressive loading placeholder
});
// thumbnails[0] is a native image reference usable with expo-image
```

### Firestore Document Extension
```javascript
// Photo document (existing + new fields for video)
const docData = {
  userId,
  imageURL: uploadResult.url,       // Keep for backward compatibility
  videoURL: uploadResult.videoUrl,   // NEW: video URL (null for photos)
  thumbnailURL: thumbnailUrl,        // NEW: video thumbnail URL
  mediaType: 'video',                // NEW: 'photo' | 'video'
  duration: videoDuration,           // NEW: video duration in seconds (null for photos)
  storagePath,
  capturedAt: serverTimestamp(),
  status: 'developing',
  photoState: null,
  visibility: 'friends-only',
  month: getCurrentMonth(),
  reactions: {},
  reactionCount: 0,
  ...(thumbnailDataURL && { thumbnailDataURL }),
};
```

### Storage Rules Update
```
// Updated photos/ rule to allow video content types
match /photos/{userId}/{allPaths=**} {
  allow read: if isAuthenticated() && isOwner(userId);
  allow write: if isAuthenticated() && isOwner(userId)
               && (request.resource.contentType.matches('image/.*')
                   || request.resource.contentType.matches('video/.*'))
               && request.resource.size < 100 * 1024 * 1024; // 100MB for video
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| expo-av Video component | expo-video VideoView + useVideoPlayer | SDK 52+ (expo-av deprecated) | Must use expo-video; expo-av removed in SDK 55 |
| expo-video-thumbnails | expo-video generateThumbnailsAsync | SDK 54+ (expo-video-thumbnails deprecated) | Use built-in thumbnail generation |
| Camera mode fixed at mount | Camera mode switchable via prop | expo-camera/next (SDK 50+) | Can switch between picture/video without remount, but reconfiguration delay exists |

**Deprecated/outdated:**
- **expo-av**: Deprecated, not receiving patches, removed in SDK 55. Use expo-video for playback.
- **expo-video-thumbnails**: Deprecated, removed in SDK 56. Use expo-video's `generateThumbnailsAsync`.

## Open Questions

1. **Camera mode approach: static video mode vs dynamic switching**
   - What we know: CameraView supports both `picture` and `video` modes. Switching at runtime works but has iOS reconfiguration delay. Keeping in `video` mode allows both `takePictureAsync` and `recordAsync`.
   - What's unclear: Whether `takePictureAsync` in `video` mode produces equivalent quality photos on both iOS and Android. Need to test on physical devices.
   - Recommendation: Start with dynamic switching (the 500ms hold threshold absorbs the delay naturally). If issues arise, fall back to static `video` mode.

2. **Video file format**
   - What we know: iOS defaults to `.mov` (H.264/AAC), Android to `.mp4` (H.264/AAC). Both work with Firebase Storage and expo-video playback.
   - What's unclear: Whether the file extension matters for playback or if content-type header is sufficient.
   - Recommendation: Accept whatever format each platform produces. Store content type in Firestore for safety.

3. **Thumbnail for progressive loading placeholder**
   - What we know: Photos currently generate a 20px-wide JPEG thumbnail as base64 data URL for progressive loading. Videos need a similar approach.
   - What's unclear: Whether `generateThumbnailsAsync` can run before upload (it needs a player instance, which needs a URL or local file path).
   - Recommendation: Generate thumbnail from the local video file URI before upload, similar to how photo thumbnails are generated from local URI. Use expo-image-manipulator on the thumbnail image to create the tiny base64 data URL.

4. **Feed video visibility detection**
   - What we know: Current feed uses FlatList-like scrolling. `onViewableItemsChanged` can detect which items are visible.
   - What's unclear: Current feed implementation details -- whether it already uses FlatList (which supports `onViewableItemsChanged`) or plain ScrollView.
   - Recommendation: If using ScrollView, migrate to FlatList or implement manual visibility detection via `onScroll` + item measurement.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest 29.7 + jest-expo 54.0.17 |
| Config file | `jest.config.js` |
| Quick run command | `npx jest --testPathPattern="__tests__/(hooks\|services\|components)" --bail` |
| Full suite command | `npm test` |
| Estimated runtime | ~15 seconds |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| (none specified) | Hold-to-record gesture triggers video recording | unit | `npx jest __tests__/hooks/useCameraBase.test.js -x` | No -- Wave 0 gap |
| (none specified) | Video upload queue handles video mediaType | unit | `npx jest __tests__/services/uploadQueueService.test.js -x` | No -- Wave 0 gap |
| (none specified) | Firestore doc created with mediaType/duration/videoURL fields | unit | `npx jest __tests__/services/uploadQueueService.test.js -x` | No -- Wave 0 gap |
| (none specified) | FeedPhotoCard renders video player for video mediaType | unit | `npx jest __tests__/components/FeedPhotoCard.test.js -x` | Yes (exists, needs video tests) |
| (none specified) | Video mute state persists across navigation | unit | `npx jest __tests__/context/VideoMuteContext.test.js -x` | No -- Wave 0 gap |
| (none specified) | Stories auto-advance after video playback ends | unit | `npx jest __tests__/hooks/usePhotoDetailModal.test.js -x` | Yes (exists, needs video story tests) |

### Nyquist Sampling Rate
- **Minimum sample interval:** After every committed task -> run: `npx jest --bail`
- **Full suite trigger:** Before merging final task of any plan wave
- **Phase-complete gate:** Full suite green before `/gsd:verify-work` runs
- **Estimated feedback latency per task:** ~15 seconds

### Wave 0 Gaps (must be created before implementation)
- [ ] `__tests__/hooks/useCameraBase.test.js` -- covers hold-to-record gesture and recording state
- [ ] `__tests__/services/uploadQueueService.test.js` -- covers video upload queue (file exists but no video tests)
- [ ] `__tests__/context/VideoMuteContext.test.js` -- covers global mute state
- [ ] Jest setup: add `expo-video` mock to `__tests__/setup/jest.setup.js`

## Sources

### Primary (HIGH confidence)
- [Expo Camera docs](https://docs.expo.dev/versions/latest/sdk/camera/) -- CameraView mode prop, recordAsync API, CameraRecordingOptions, microphone permissions
- [Expo Video docs](https://docs.expo.dev/versions/latest/sdk/video/) -- VideoView, useVideoPlayer, generateThumbnailsAsync, events (playToEnd, timeUpdate)
- [Expo Video Thumbnails docs](https://docs.expo.dev/versions/latest/sdk/video-thumbnails/) -- Confirmed deprecated in favor of expo-video generateThumbnailsAsync

### Secondary (MEDIUM confidence)
- [expo-camera GitHub issue #27528](https://github.com/expo/expo/issues/27528) -- Mode switching delay workaround, dead frames issue (resolved April 2024)
- [expo-camera GitHub issue #40267](https://github.com/expo/expo/issues/40267) -- Video mode audio session interruption on iOS 18+ (closed stale, unresolved)
- [Expo SDK 54 changelog](https://expo.dev/changelog/sdk-54) -- expo-av deprecated, expo-video recommended

### Tertiary (LOW confidence)
- Camera facing switch during recording -- documentation states "Flipping camera during a recording results in stopping it" but behavior may have changed in newer SDK versions. Needs physical device testing.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- expo-camera (already installed) + expo-video (official Expo package, included in Go) are the clear choices
- Architecture: MEDIUM -- mode switching approach needs physical device validation; feed autoplay viewport detection pattern depends on current FlatList vs ScrollView implementation
- Pitfalls: HIGH -- well-documented issues (mode switching delay, storage rules, microphone permissions) with clear solutions

**Research date:** 2026-03-04
**Valid until:** 2026-04-04 (30 days -- stable Expo SDK 54 ecosystem)
