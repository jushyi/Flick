# Phase 47: Firebase Performance Monitoring - Research

**Researched:** 2026-02-10
**Domain:** Firebase Performance Monitoring SDK for React Native/Expo
**Confidence:** HIGH

<research_summary>

## Summary

Researched the Firebase Performance Monitoring ecosystem for integrating `@react-native-firebase/perf` into a 57K-line React Native + Expo SDK 54 social photo-sharing app. The project already uses five `@react-native-firebase/*` modules at v23.8.6 with `expo-dev-client`, so the integration surface is minimal — one package install, one Expo plugin entry, and a dev client rebuild.

The SDK provides three instrumentation mechanisms: **custom code traces** (user-defined start/stop around operations with up to 5 attributes and 32 metrics each), **automatic HTTP/S network monitoring** (captures all network requests without code changes), and **screen rendering traces** (slow/frozen frame detection, Android-only via RN API). Custom traces are the primary tool for this phase — wrapping critical flows like feed loading, photo uploads, auth, and story playback with feature-area-prefixed trace names.

Key constraint: the device enforces a **300-event-per-10-minute** rate limit, so traces must be at the right granularity — per-operation (e.g., `feed/load`), not per-document-read. The SDK adds negligible runtime overhead (batched transmission every ~30s) but the Android Gradle plugin adds 20-30s to build time (disable for debug builds).

**Primary recommendation:** Install `@react-native-firebase/perf`, add the Expo plugin, disable collection in `__DEV__`, then instrument ~15-20 custom traces organized by feature area (`auth/`, `feed/`, `camera/`, `social/`, `stories/`, `profile/`, `notif/`). Use a reusable `withTrace()` wrapper and a `useScreenTrace()` hook. Automatic network monitoring provides full-stack HTTP visibility with zero code. Establish baselines from the first week of production data.
</research_summary>

<standard_stack>

## Standard Stack

### Core

| Library                     | Version | Purpose                             | Why Standard                                                 |
| --------------------------- | ------- | ----------------------------------- | ------------------------------------------------------------ |
| @react-native-firebase/perf | ^23.8.6 | Firebase Performance Monitoring SDK | Official RNFirebase module, same version as existing modules |
| @react-native-firebase/app  | ^23.8.6 | Firebase core (already installed)   | Required peer dependency                                     |

### Supporting (Already Installed)

| Library                   | Version  | Purpose               | Relevance                                                               |
| ------------------------- | -------- | --------------------- | ----------------------------------------------------------------------- |
| expo-dev-client           | ~6.0.20  | Custom dev builds     | Required — perf module has native code, no Expo Go                      |
| expo-build-properties     | (plugin) | iOS static frameworks | Already configured with `useFrameworks: "static"`                       |
| ./plugins/withFirebaseFix | (plugin) | iOS build fix         | Already handles `CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES` |

### Alternatives Considered

| Instead of    | Could Use          | Tradeoff                                                                                                                           |
| ------------- | ------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| Firebase Perf | Sentry Performance | Sentry is more powerful (distributed tracing, profiling) but adds a new vendor; Firebase Perf is free and already in the ecosystem |
| Firebase Perf | New Relic Mobile   | Overkill for current scale; expensive; Firebase Perf is free                                                                       |
| Firebase Perf | Custom timing logs | No dashboard, no automatic network monitoring, no screen traces, no aggregation                                                    |

**Installation:**

```bash
npx expo install @react-native-firebase/perf
```

No additional dependencies needed. The Expo config plugin handles all native setup (Android Gradle plugin, iOS CocoaPods).
</standard_stack>

<architecture_patterns>

## Architecture Patterns

### Recommended Project Structure

```
src/
├── services/
│   └── firebase/
│       ├── performanceService.js    # NEW — trace helpers, withTrace(), initPerf()
│       └── index.js                 # Add perf exports to existing barrel
├── hooks/
│   └── useScreenTrace.js            # NEW — screen load timing hook
└── (existing screens/components — add trace calls inline)
```

### Pattern 1: Reusable Trace Wrapper

**What:** Generic async wrapper that starts a trace, runs an operation, records success/failure, and guarantees stop()
**When to use:** Every traced async operation (Firestore queries, uploads, API calls)
**Example:**

```javascript
// Source: Pattern derived from rnfirebase.io/perf/usage
import perf from '@react-native-firebase/perf';

export async function withTrace(traceName, operation, attributes) {
  const trace = await perf().startTrace(traceName);

  if (attributes) {
    for (const [key, value] of Object.entries(attributes)) {
      trace.putAttribute(key, String(value).slice(0, 100));
    }
  }

  try {
    const result = await operation(trace); // Pass trace so caller can add metrics
    trace.putAttribute('success', 'true');
    return result;
  } catch (error) {
    trace.putAttribute('success', 'false');
    trace.putAttribute('error', (error.code || error.message || 'unknown').slice(0, 100));
    throw error;
  } finally {
    await trace.stop();
  }
}
```

### Pattern 2: Screen Load Timing Hook

**What:** React hook that measures time from screen mount to data-ready
**When to use:** Any screen with async data loading (feed, profile, notifications)
**Example:**

```javascript
// Source: Community pattern verified against rnfirebase.io API
import { useEffect, useRef, useCallback } from 'react';
import perf from '@react-native-firebase/perf';

export function useScreenTrace(screenName) {
  const traceRef = useRef(null);

  useEffect(() => {
    let active = true;

    (async () => {
      const trace = await perf().startTrace(`screen/${screenName}`);
      if (active) {
        traceRef.current = trace;
      } else {
        await trace.stop();
      }
    })();

    return () => {
      active = false;
      if (traceRef.current) {
        traceRef.current.stop();
        traceRef.current = null;
      }
    };
  }, [screenName]);

  const markLoaded = useCallback(async metrics => {
    if (traceRef.current) {
      if (metrics) {
        for (const [key, value] of Object.entries(metrics)) {
          traceRef.current.putMetric(key, value);
        }
      }
      await traceRef.current.stop();
      traceRef.current = null;
    }
  }, []);

  return { markLoaded };
}
```

### Pattern 3: Feature-Area Trace Naming

**What:** Prefix all trace names with feature area for console organization
**When to use:** All custom traces
**Convention:**

```
auth/login              auth/signup             auth/token_refresh
feed/load               feed/refresh            feed/subscribe
camera/capture          camera/upload           camera/compress
stories/load            stories/playback        stories/mark_viewed
profile/load            profile/update          profile/upload_photo
social/load_friends     social/send_request     social/accept_request
notif/load_feed         notif/register_token    notif/mark_read
album/load              album/create            album/update
darkroom/load           darkroom/reveal         darkroom/triage
```

### Pattern 4: Disable in Development

**What:** Prevent dev data from polluting production metrics
**When to use:** App initialization
**Example:**

```javascript
// Source: rnfirebase.io/perf/usage
import perf from '@react-native-firebase/perf';

export function initPerformanceMonitoring() {
  if (__DEV__) {
    perf().setPerformanceCollectionEnabled(false);
    return;
  }
  // Production: collection enabled by default via firebase.json
}
```

### Anti-Patterns to Avoid

- **Tracing per-document reads:** Trace the aggregate operation (`feed/load`), not each individual Firestore read inside it
- **Tracing in hot paths:** Never create traces in scroll handlers, animation callbacks, or render functions — exhausts 300/10min budget
- **Missing stop() calls:** Always use try/finally or the `withTrace()` wrapper to guarantee cleanup
- **Tracing entire app session:** Unbounded traces produce meaningless duration data and risk never stopping
- **Adding >5 attributes:** The 6th attribute is silently dropped with no error — plan attributes carefully
  </architecture_patterns>

<dont_hand_roll>

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem                  | Don't Build                               | Use Instead                        | Why                                                                                           |
| ------------------------ | ----------------------------------------- | ---------------------------------- | --------------------------------------------------------------------------------------------- |
| Network request timing   | Custom fetch wrapper with Date.now()      | Firebase automatic HTTP monitoring | Captures all HTTP/S automatically, aggregates by URL pattern, shows in console with zero code |
| Screen frame performance | Custom requestAnimationFrame counter      | Firebase automatic screen traces   | Measures slow/frozen frames at native level, more accurate than JS-side measurement           |
| Performance dashboard    | Custom Firestore collection + admin panel | Firebase Performance console       | Free, real-time, aggregated, filterable by device/country/version/percentile                  |
| Trace data batching      | Custom queue with periodic flush          | Firebase SDK internal batching     | SDK batches every ~30s, compresses, handles offline, respects rate limits                     |
| Metric aggregation       | Client-side averages/percentiles          | Firebase console percentile views  | Server-side aggregation across all devices, no client-side compute needed                     |
| User session correlation | Custom session ID tracking                | Firebase automatic session traces  | SDK tracks foreground/background sessions with CPU and memory usage                           |

**Key insight:** Firebase Performance Monitoring's primary value is what it does automatically — HTTP monitoring, screen traces, session tracking, app start timing. Custom traces add targeted visibility for app-specific flows. The SDK + console together replace what would be thousands of lines of custom instrumentation, storage, and visualization code.
</dont_hand_roll>

<common_pitfalls>

## Common Pitfalls

### Pitfall 1: Exceeding the 300-Event Rate Limit

**What goes wrong:** Traces created in high-frequency code paths (scroll handlers, list item renders, per-document reads) exhaust the 300-events-per-10-minutes device budget, causing later traces to be silently dropped
**Why it happens:** Each `start()` + `stop()` cycle counts as one event. Tracing at the wrong granularity (per-item instead of per-batch) in a feed with 50+ items burns through the budget fast
**How to avoid:** Trace aggregate operations (`feed/load` for the entire feed query, not per-photo). Estimate trace frequency: 15-20 unique trace types × 2-3 invocations each = ~40-60 events per 10 minutes, well within budget
**Warning signs:** Custom traces stop appearing in Firebase console despite being in code; data gaps in monitoring

### Pitfall 2: Silent Attribute Drops

**What goes wrong:** The 6th `putAttribute()` call on a trace is silently ignored — no error, no warning, no log. Critical debugging attributes get lost without indication
**Why it happens:** Hard limit of 5 custom attributes per trace/httpMetric, enforced silently by the SDK
**How to avoid:** Plan attributes at design time. Use the 5 most valuable: `success`, `error`, `cache_status`, plus 2 context-specific ones. Encode multiple dimensions into single attributes if needed (e.g., `segment: 'new_wifi'` instead of separate `user_type` and `network`)
**Warning signs:** Attributes you expect to see in Firebase console are missing for some traces

### Pitfall 3: Screen Traces Crash on iOS

**What goes wrong:** `perf().startScreenTrace()` throws/rejects on iOS, Android 9.0/9.1, or devices without hardware acceleration
**Why it happens:** Custom screen traces via the React Native API are Android-only. Native iOS screen traces exist but aren't controllable from JS
**How to avoid:** Always wrap `startScreenTrace()` in try/catch. Better yet, use custom code traces (`startTrace('screen/FeedScreen')`) for cross-platform screen timing and reserve `startScreenTrace()` only if Android-specific frame metrics are needed
**Warning signs:** Unhandled promise rejection crashes on iOS when using `startScreenTrace()`

### Pitfall 4: Dev Data Pollutes Production Metrics

**What goes wrong:** React Native dev mode adds significant overhead (slower renders, extra checks). Development traces show inflated durations that skew production dashboards
**Why it happens:** Not disabling collection in `__DEV__` mode. Default is collection enabled
**How to avoid:** Call `perf().setPerformanceCollectionEnabled(false)` early in app startup when `__DEV__` is true
**Warning signs:** Unusually high latency values in Firebase console; duration distributions with bimodal peaks (dev vs production)

### Pitfall 5: Android Build Time Regression

**What goes wrong:** Android builds take 20-30+ seconds longer after adding the perf Gradle plugin
**Why it happens:** The `com.google.firebase.firebase-perf` Gradle plugin runs bytecode instrumentation (`transformClassesWithFirebasePerformancePlugin`) on every class for automatic network monitoring
**How to avoid:** Disable instrumentation in debug builds. With Expo, this requires a custom Expo config plugin or modifying the generated `android/app/build.gradle` post-prebuild. Alternatively, accept the build time cost since EAS Build runs remotely
**Warning signs:** Local `npx expo run:android` takes noticeably longer after adding the perf plugin

### Pitfall 6: Missing stop() Causes Trace Leaks

**What goes wrong:** If an error is thrown between `start()` and `stop()`, the trace never completes. The SDK may hold resources, and the trace data is lost
**Why it happens:** Not using try/finally pattern around traced operations
**How to avoid:** Always use `try { ... } finally { await trace.stop(); }` or the `withTrace()` wrapper. The wrapper pattern makes this impossible to forget
**Warning signs:** Traces appear in code but not in Firebase console; memory warnings in long sessions

### Pitfall 7: v23.8.0-23.8.2 Expo Plugin Bug

**What goes wrong:** The Expo config plugin shipped broken in these versions — missing native platform files in npm distribution
**Why it happens:** Publishing regression in react-native-firebase (GitHub Issue #8829)
**How to avoid:** Use `npx expo install` which resolves to the latest compatible version (23.8.6+). Avoid pinning to 23.8.0-23.8.2
**Warning signs:** Build errors during `expo prebuild` mentioning missing perf plugin files
</common_pitfalls>

<code_examples>

## Code Examples

Verified patterns from official sources:

### Performance Service Module

```javascript
// Source: rnfirebase.io/perf/usage — adapted to project patterns
// src/services/firebase/performanceService.js
import perf from '@react-native-firebase/perf';

/**
 * Initialize performance monitoring.
 * Disables collection in dev mode to prevent polluting production data.
 */
export function initPerformanceMonitoring() {
  if (__DEV__) {
    perf().setPerformanceCollectionEnabled(false);
  }
}

/**
 * Reusable trace wrapper with guaranteed stop().
 * @param {string} traceName - Feature-prefixed name (e.g., 'feed/load')
 * @param {Function} operation - Async function to trace. Receives trace as arg for adding metrics.
 * @param {Object} [attributes] - Up to 5 key-value string pairs
 * @returns {Promise<*>} Result of the operation
 */
export async function withTrace(traceName, operation, attributes) {
  if (__DEV__) return operation({ putMetric: () => {}, putAttribute: () => {} });

  const trace = await perf().startTrace(traceName);

  if (attributes) {
    const entries = Object.entries(attributes).slice(0, 4); // Reserve 1 slot for success/error
    for (const [key, value] of entries) {
      trace.putAttribute(key, String(value).slice(0, 100));
    }
  }

  try {
    const result = await operation(trace);
    trace.putAttribute('success', 'true');
    return result;
  } catch (error) {
    trace.putAttribute('success', 'false');
    throw error;
  } finally {
    await trace.stop();
  }
}
```

### Using withTrace in Feed Service

```javascript
// Source: Pattern applied to existing feedService.js
import { withTrace } from './performanceService';

export async function getFeedPhotos(userId, friendIds, lastDoc, limit = 20) {
  return withTrace(
    'feed/load',
    async trace => {
      const cutoff = getCutoffTimestamp(FEED_VISIBILITY_DAYS);
      // ... existing feed query logic ...
      const snapshot = await getDocs(q);

      trace.putMetric('photo_count', snapshot.size);
      trace.putMetric('friend_count', friendIds.length);
      trace.putMetric('from_cache', snapshot.metadata.fromCache ? 1 : 0);

      return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    },
    { cache_status: lastDoc ? 'paginated' : 'initial' }
  );
}
```

### Using withTrace for Photo Upload

```javascript
// Source: Pattern applied to existing storageService.js
import { withTrace } from './performanceService';

export async function uploadPhoto(userId, imageUri, compressionOptions) {
  return withTrace('camera/upload', async trace => {
    const compressed = await compressImage(imageUri, compressionOptions);
    trace.putMetric('file_size_kb', Math.round(compressed.size / 1024));

    const ref = storage().ref(`photos/${userId}/${Date.now()}.jpg`);
    await ref.putFile(compressed.uri);
    const downloadURL = await ref.getDownloadURL();

    return downloadURL;
  });
}
```

### Screen Trace Hook Usage

```javascript
// Source: Community pattern, verified against rnfirebase.io API
// In a screen component:
import { useScreenTrace } from '../hooks/useScreenTrace';

function FeedScreen() {
  const { markLoaded } = useScreenTrace('FeedScreen');

  useEffect(() => {
    loadFeed().then(photos => {
      setPhotos(photos);
      markLoaded({ photo_count: photos.length });
    });
  }, []);

  // ... render
}
```

### Custom HTTP Metric for Cloud Functions

```javascript
// Source: rnfirebase.io/perf/usage — for callable Cloud Functions
import perf from '@react-native-firebase/perf';
import { getFunctions, httpsCallable } from '@react-native-firebase/functions';

export async function callFunctionWithMetric(functionName, data) {
  const metric = perf().newHttpMetric(
    `https://us-central1-project.cloudfunctions.net/${functionName}`,
    'POST'
  );
  metric.putAttribute('function', functionName);

  await metric.start();
  try {
    const fn = httpsCallable(getFunctions(), functionName);
    const result = await fn(data);
    metric.setHttpResponseCode(200);
    await metric.stop();
    return result;
  } catch (error) {
    metric.setHttpResponseCode(error.code === 'functions/unavailable' ? 503 : 500);
    await metric.stop();
    throw error;
  }
}
```

### App Initialization Integration

```javascript
// Source: rnfirebase.io/perf/usage — in App.js or entry point
import { initPerformanceMonitoring } from './services/firebase/performanceService';

// Call early in app startup
initPerformanceMonitoring();
```

### firebase.json Configuration

```json
{
  "firestore": {
    "rules": "firestore.rules",
    "indexes": "firestore.indexes.json"
  },
  "storage": {
    "rules": "storage.rules"
  },
  "functions": {
    "source": "functions",
    "predeploy": [],
    "ignore": ["node_modules", ".git", "firebase-debug.log", "firebase-debug.*.log"]
  },
  "react-native": {
    "perf_auto_collection_enabled": true
  }
}
```

### app.json Plugin Configuration

```json
{
  "plugins": [
    "expo-splash-screen",
    "expo-secure-store",
    ["expo-camera", { "...": "..." }],
    ["expo-build-properties", { "...": "..." }],
    "@react-native-firebase/app",
    "@react-native-firebase/auth",
    "@react-native-firebase/perf",
    "./plugins/withFirebaseFix",
    "@giphy/react-native-sdk",
    "expo-audio"
  ]
}
```

</code_examples>

<sota_updates>

## State of the Art (2025-2026)

| Old Approach                      | Current Approach                             | When Changed | Impact                                                      |
| --------------------------------- | -------------------------------------------- | ------------ | ----------------------------------------------------------- |
| Manual Date.now() timing          | Firebase Performance custom traces           | Established  | Automatic aggregation, console dashboard, no custom backend |
| Custom network logging            | Firebase automatic HTTP monitoring           | Established  | Zero-code network visibility for all HTTP/S requests        |
| No frame metrics                  | Firebase automatic screen traces             | Established  | Slow/frozen frame detection without custom code             |
| perf v12-15 (legacy)              | perf v23.8.6 (current, Expo plugin built-in) | 2024-2025    | Native Expo config plugin, no manual native setup needed    |
| v23.8.0-23.8.2 broken Expo plugin | v23.8.3+ fixed                               | Dec 2025     | Expo config plugin works correctly again                    |

**New tools/patterns to consider:**

- **Firebase Performance console near real-time:** Latest SDK versions show data in console within minutes (previously up to 36 hours)
- **Custom URL patterns:** Up to 400 per app, 100 per domain — useful for grouping Cloud Function calls
- **Percentile views:** Console supports percentile analysis (p50, p90, p95, p99) for all trace durations

**Deprecated/outdated:**

- **Manual Gradle plugin setup for Expo:** The built-in Expo config plugin handles Android Gradle configuration automatically since RNFirebase v12.4.0+
- **Separate `expo-firebase-performance` wrapper packages:** Not needed — `@react-native-firebase/perf` has its own Expo plugin
- **`perf_collection_deactivated` in firebase.json:** Permanently disables monitoring with no runtime override — almost never the right choice
  </sota_updates>

<limits_reference>

## Firebase Performance Monitoring Limits

### Per-Trace Limits

| Limit                       | Value                           |
| --------------------------- | ------------------------------- |
| Custom attributes per trace | 5                               |
| Custom metrics per trace    | 32 (including default Duration) |
| Trace name max length       | 100 characters                  |
| Attribute name max length   | 40 characters                   |
| Attribute name characters   | A-Z, a-z, \_ only               |
| Attribute value max length  | 100 characters                  |
| Attribute value type        | String only                     |
| Metric name max length      | 32 characters                   |
| Metric value type           | number                          |

### Per-Device Limits

| Limit                 | Value                           |
| --------------------- | ------------------------------- |
| Events per 10 minutes | 300 (traces + network combined) |
| Concurrent traces     | Unlimited (thread-safe)         |

### Per-App Limits

| Limit                          | Value |
| ------------------------------ | ----- |
| Custom URL patterns per app    | 400   |
| Custom URL patterns per domain | 100   |

### Naming Rules

| Rule                           | Applies To                                 |
| ------------------------------ | ------------------------------------------ |
| No leading underscore (\_)     | Trace names, attribute names, metric names |
| No leading/trailing whitespace | All names                                  |
| No PII in attribute values     | All attributes (subject to deletion)       |

### Platform Restrictions

| Feature                            | iOS          | Android                      |
| ---------------------------------- | ------------ | ---------------------------- |
| Custom code traces                 | Yes          | Yes                          |
| Custom HTTP metrics                | Yes          | Yes                          |
| Custom screen traces               | No (throws)  | Yes (not on 9.0/9.1)         |
| Automatic HTTP monitoring          | Yes          | Yes (requires Gradle plugin) |
| Automatic screen traces            | Yes (native) | Yes (native)                 |
| Automatic app start trace          | Yes          | Yes                          |
| Custom attributes on screen traces | No           | No                           |
| Custom metrics on HTTP metrics     | No           | No                           |

</limits_reference>

<trace_inventory>

## Recommended Trace Inventory

Custom traces organized by feature area, mapped to existing service files:

### Auth Traces

| Trace Name         | Service File        | What It Measures        | Key Metrics |
| ------------------ | ------------------- | ----------------------- | ----------- |
| `auth/login`       | phoneAuthService.js | Phone auth sign-in flow | —           |
| `auth/signup`      | phoneAuthService.js | New user registration   | —           |
| `auth/verify_code` | phoneAuthService.js | SMS code verification   | —           |

### Feed Traces

| Trace Name       | Service File   | What It Measures              | Key Metrics                           |
| ---------------- | -------------- | ----------------------------- | ------------------------------------- |
| `feed/load`      | feedService.js | Initial feed query            | photo_count, friend_count, from_cache |
| `feed/refresh`   | feedService.js | Pull-to-refresh feed          | photo_count, from_cache               |
| `feed/subscribe` | feedService.js | Real-time feed listener setup | —                                     |

### Camera/Photo Traces

| Trace Name        | Service File      | What It Measures        | Key Metrics  |
| ----------------- | ----------------- | ----------------------- | ------------ |
| `camera/upload`   | storageService.js | Photo upload to Storage | file_size_kb |
| `camera/compress` | storageService.js | Image compression       | file_size_kb |
| `photo/triage`    | photoService.js   | Darkroom triage action  | —            |

### Stories Traces

| Trace Name            | Service File            | What It Measures      | Key Metrics |
| --------------------- | ----------------------- | --------------------- | ----------- |
| `stories/load`        | feedService.js          | Load stories bar data | story_count |
| `stories/mark_viewed` | viewedStoriesService.js | Mark story as viewed  | —           |

### Profile Traces

| Trace Name             | Service File      | What It Measures      | Key Metrics  |
| ---------------------- | ----------------- | --------------------- | ------------ |
| `profile/load`         | userService.js    | Load user profile     | —            |
| `profile/update`       | userService.js    | Update profile fields | —            |
| `profile/upload_photo` | storageService.js | Profile photo upload  | file_size_kb |

### Social Traces

| Trace Name              | Service File         | What It Measures      | Key Metrics  |
| ----------------------- | -------------------- | --------------------- | ------------ |
| `social/load_friends`   | friendshipService.js | Load friends list     | friend_count |
| `social/send_request`   | friendshipService.js | Send friend request   | —            |
| `social/accept_request` | friendshipService.js | Accept friend request | —            |

### Notification Traces

| Trace Name             | Service File           | What It Measures       | Key Metrics |
| ---------------------- | ---------------------- | ---------------------- | ----------- |
| `notif/load_feed`      | notificationService.js | Load notification feed | notif_count |
| `notif/register_token` | notificationService.js | FCM token registration | —           |

### Screen Traces (via useScreenTrace hook)

| Trace Name                   | Screen                 | What It Measures                   |
| ---------------------------- | ---------------------- | ---------------------------------- |
| `screen/FeedScreen`          | FeedScreen.js          | Feed screen load-to-interactive    |
| `screen/ProfileScreen`       | ProfileScreen.js       | Profile screen load-to-interactive |
| `screen/StoriesViewer`       | StoriesViewerModal.js  | Story viewer open-to-ready         |
| `screen/DarkroomScreen`      | DarkroomScreen.js      | Darkroom load-to-interactive       |
| `screen/NotificationsScreen` | NotificationsScreen.js | Notification feed load             |
| `screen/FriendsScreen`       | FriendsScreen.js       | Friends list load                  |

**Total:** ~22 custom traces + ~6 screen traces = ~28 trace types
**Estimated frequency:** 28 types × ~2 invocations per 10 min = ~56 events/10 min (well within 300 limit)
</trace_inventory>

<open_questions>

## Open Questions

1. **Android debug build time impact**
   - What we know: The Firebase Performance Gradle plugin adds 20-30s to Android builds via bytecode instrumentation. This only affects `npx expo run:android` local builds, not EAS Build (which runs remotely).
   - What's unclear: Whether a custom Expo config plugin can disable `instrumentationEnabled` for debug builds without conflicting with `@react-native-firebase/perf`'s own config plugin.
   - Recommendation: Accept the build time cost for now. If it becomes painful, create a `withPerfDebugDisable` config plugin that adds `FirebasePerformance { instrumentationEnabled false }` to debug buildType. Test during implementation.

2. **Automatic HTTP monitoring vs Firebase SDK calls**
   - What we know: Firebase automatically monitors all HTTP/S requests. The project uses Firestore, Auth, Storage, and Functions — all of which make HTTP/S calls internally.
   - What's unclear: Whether Firebase SDK internal calls (Firestore reads, Storage uploads) appear as individual network traces or are filtered out. The docs say "all HTTP/S requests" but don't clarify Firebase-to-Firebase traffic.
   - Recommendation: Enable automatic monitoring, observe what appears in the console for 24-48 hours, then decide if custom HTTP metrics are needed for specific Cloud Function calls.

3. **Custom screen traces vs code traces for screen timing**
   - What we know: `startScreenTrace()` is Android-only and measures native frame rendering. Custom code traces (`startTrace('screen/X')`) work cross-platform and measure time-to-data.
   - What's unclear: Whether both are needed or if custom code traces alone provide sufficient screen performance visibility.
   - Recommendation: Use custom code traces (`screen/X`) for cross-platform screen load timing. Skip `startScreenTrace()` to avoid iOS error handling complexity. Native automatic screen traces still capture frame metrics on both platforms without code.
     </open_questions>

<sources>
## Sources

### Primary (HIGH confidence)

- [rnfirebase.io/perf/usage](https://rnfirebase.io/perf/usage) — Setup, API, examples
- [rnfirebase.io/reference/perf](https://rnfirebase.io/reference/perf) — Module API reference
- [rnfirebase.io/reference/perf/trace](https://rnfirebase.io/reference/perf/trace) — Trace API reference (attributes, metrics, lifecycle)
- [rnfirebase.io/reference/perf/httpmetric](https://rnfirebase.io/reference/perf/httpmetric) — HttpMetric API reference
- [rnfirebase.io/reference/perf/screentrace](https://rnfirebase.io/reference/perf/screentrace) — ScreenTrace API reference
- [rnfirebase.io/app/json-config](https://rnfirebase.io/app/json-config) — firebase.json react-native configuration
- [firebase.google.com/docs/perf-mon](https://firebase.google.com/docs/perf-mon) — Firebase Performance overview
- [firebase.google.com/docs/perf-mon/custom-code-traces](https://firebase.google.com/docs/perf-mon/custom-code-traces) — Custom code traces
- [firebase.google.com/docs/perf-mon/attributes](https://firebase.google.com/docs/perf-mon/attributes) — Custom attributes
- [firebase.google.com/docs/perf-mon/network-traces](https://firebase.google.com/docs/perf-mon/network-traces) — HTTP/S network monitoring
- [firebase.google.com/docs/perf-mon/screen-traces](https://firebase.google.com/docs/perf-mon/screen-traces) — Screen rendering traces
- [firebase.google.com/docs/perf-mon/troubleshooting](https://firebase.google.com/docs/perf-mon/troubleshooting) — Limits, data latency, FAQ

### Secondary (MEDIUM confidence)

- [github.com/invertase/react-native-firebase/.../perf/plugin](https://github.com/invertase/react-native-firebase/blob/main/packages/perf/plugin/src/index.ts) — Expo config plugin source code, verified plugin behavior
- [github.com/invertase/react-native-firebase/issues/8829](https://github.com/invertase/react-native-firebase/issues/8829) — v23.8.0-23.8.2 Expo plugin regression, confirmed fix in 23.8.3+
- [npmjs.com/package/@react-native-firebase/perf](https://www.npmjs.com/package/@react-native-firebase/perf) — Package metadata, peer dependencies, version history
- [rnfirebase.io/perf/axios-integration](https://rnfirebase.io/perf/axios-integration) — HTTP client integration patterns

### Tertiary (LOW confidence - needs validation)

- Android debug build time impact (20-30s) — reported in community sources, needs measurement in this project
- Firebase SDK internal HTTP traffic visibility — unclear from docs whether Firestore/Auth/Storage calls appear as network traces
  </sources>

<metadata>
## Metadata

**Research scope:**

- Core technology: @react-native-firebase/perf v23.8.6 + Expo SDK 54
- Ecosystem: Firebase Performance Monitoring console, automatic network/screen traces
- Patterns: Trace wrapper, screen trace hook, feature-area naming convention
- Pitfalls: Rate limits, attribute limits, iOS screen trace crashes, dev data pollution, build time

**Confidence breakdown:**

- Standard stack: HIGH — one package, same version family as existing modules, verified peer deps
- Architecture: HIGH — patterns from official docs and API reference, adapted to project structure
- Pitfalls: HIGH — limits from official docs, v23.8.x bug from GitHub issue, build time from community reports
- Code examples: HIGH — based on rnfirebase.io API reference and official Firebase docs
- Trace inventory: MEDIUM — trace selection based on project codebase analysis, may need adjustment after initial data

**Codebase analysis:**

- 18 Firebase service files in src/services/firebase/ — all traced operations identified
- 5 existing @react-native-firebase modules at v23.8.6 — compatible
- expo-dev-client already installed — no workflow change needed
- No existing performance monitoring code — clean integration surface
- withFirebaseFix Expo plugin already handles iOS static framework build issues

**Research date:** 2026-02-10
**Valid until:** 2026-03-10 (30 days — Firebase Performance SDK stable, no breaking changes expected)
</metadata>

---

_Phase: 47-firebase-perf-monitoring_
_Research completed: 2026-02-10_
_Ready for planning: yes_
