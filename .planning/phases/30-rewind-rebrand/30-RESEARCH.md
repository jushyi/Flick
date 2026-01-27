# Phase 30: Rewind Rebrand - Research

**Researched:** 2026-01-25
**Domain:** Expo splash screen transitions, Reanimated animations, app icon generation
**Confidence:** HIGH

<research_summary>

## Summary

Researched animation patterns for the Rewind rebrand startup experience: shutter opening + blur-to-focus transition. Key finding: the codebase already has a working `AnimatedSplash.js` component with a 6-blade aperture shutter animation using Reanimated. The existing patterns are solid and just need color/timing updates.

For the blur-to-focus effect, `expo-blur` can animate its `intensity` prop with Reanimated - an Expo 52 issue affecting this was fixed in Reanimated PR #6736. The approach is to overlay a BlurView on the camera, then animate intensity from high to 0.

App icon generation is straightforward: provide 1024x1024 PNGs and Expo/EAS handles the rest.

**Primary recommendation:** Update existing `AnimatedSplash.js` with new brand colors (purple-to-pink gradient), add blur-to-focus overlay using `expo-blur` + Reanimated, and use expo-assets-generator for icon sizes.
</research_summary>

<standard_stack>

## Standard Stack

### Core (Already Installed)

| Library                 | Version     | Purpose                          | Why Standard                             |
| ----------------------- | ----------- | -------------------------------- | ---------------------------------------- |
| react-native-reanimated | ~4.1.1      | Animation engine                 | Already in use, 60fps worklet animations |
| expo-splash-screen      | (bundled)   | Control native splash visibility | Official Expo solution                   |
| expo-blur               | (bundled)   | Blur effects                     | Official Expo solution for BlurView      |
| expo-haptics            | (installed) | Haptic feedback                  | Already used for tactile feedback        |

### Supporting (May Need to Add)

| Library              | Version   | Purpose              | When to Use                        |
| -------------------- | --------- | -------------------- | ---------------------------------- |
| expo-font            | (bundled) | Custom fonts         | For retro display font in wordmark |
| expo-linear-gradient | (bundled) | Gradient backgrounds | Purple-to-pink gradient treatment  |

### Alternatives Considered

| Instead of    | Could Use         | Tradeoff                                                                |
| ------------- | ----------------- | ----------------------------------------------------------------------- |
| Reanimated    | Moti              | Moti is declarative but adds dependency; Reanimated already established |
| expo-blur     | react-native-blur | RN-blur has more features but expo-blur is simpler for managed workflow |
| CSS triangles | react-native-svg  | SVG would be cleaner but existing triangles work fine                   |

**Installation:**

```bash
# Core already installed, may need:
npx expo install expo-linear-gradient expo-font
```

</standard_stack>

<architecture_patterns>

## Architecture Patterns

### Existing Pattern (AnimatedSplash.js)

The codebase already has a well-structured animated splash component at [src/components/AnimatedSplash.js](src/components/AnimatedSplash.js):

```
src/
├── components/
│   └── AnimatedSplash.js  # 6-blade aperture animation (UPDATE THIS)
├── App.js                 # Controls splash visibility (UPDATE THIS)
└── assets/
    ├── icon.png           # Main app icon (REPLACE)
    ├── adaptive-icon.png  # Android foreground (REPLACE)
    └── splash.png         # Static splash (REPLACE)
```

### Pattern 1: Splash → Animated Transition

**What:** Native splash stays visible while JS loads, then hand off to animated component
**When to use:** Any custom splash animation
**Example (from expo-splash-screen docs):**

```typescript
// In global scope (before component)
SplashScreen.preventAutoHideAsync();

function App() {
  const [appReady, setAppReady] = useState(false);
  const [animationComplete, setAnimationComplete] = useState(false);

  useEffect(() => {
    async function prepare() {
      // Load fonts, fetch data, etc.
      await loadAssets();
      setAppReady(true);
      await SplashScreen.hideAsync();
    }
    prepare();
  }, []);

  if (!appReady || !animationComplete) {
    return (
      <AnimatedSplash onAnimationComplete={() => setAnimationComplete(true)} />
    );
  }

  return <MainApp />;
}
```

### Pattern 2: Blur-to-Focus Effect

**What:** Overlay BlurView on content, animate intensity from high to 0
**When to use:** "Lens finding clarity" reveal effect
**Example:**

```typescript
import { BlurView } from 'expo-blur';
import Animated, { useAnimatedProps, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';

const AnimatedBlurView = Animated.createAnimatedComponent(BlurView);

function BlurToFocusOverlay({ onComplete }) {
  const intensity = useSharedValue(80);

  useEffect(() => {
    intensity.value = withDelay(
      200, // Brief pause after shutter opens
      withTiming(0, { duration: 600 }, (finished) => {
        if (finished) runOnJS(onComplete)();
      })
    );
  }, []);

  const animatedProps = useAnimatedProps(() => ({
    intensity: intensity.value,
  }));

  return (
    <AnimatedBlurView
      style={StyleSheet.absoluteFill}
      tint="dark"
      animatedProps={animatedProps}
    />
  );
}
```

### Pattern 3: Gradient Animation for Darkroom States

**What:** Animated gradient shift (purple-heavy → pink-heavy) for developing vs revealed
**When to use:** Visual storytelling in darkroom
**Example:**

```typescript
import { LinearGradient } from 'expo-linear-gradient';

// Use interpolateColor from Reanimated for smooth transitions
const AnimatedLinearGradient = Animated.createAnimatedComponent(LinearGradient);

// Developing: mostly purple
const DEVELOPING_COLORS = ['#8B5CF6', '#EC4899']; // 80% purple, 20% pink

// Revealed: mostly pink
const REVEALED_COLORS = ['#A855F7', '#F472B6']; // 40% purple, 60% pink
```

### Anti-Patterns to Avoid

- **Animating in global scope:** Use useEffect inside component, not module-level
- **Blocking SplashScreen.hideAsync():** Call it before animation starts, not after
- **Android blur without experimentalBlurMethod:** Blur won't work on Android
- **Testing in Expo Go:** Splash screen behavior only accurate in release builds
  </architecture_patterns>

<dont_hand_roll>

## Don't Hand-Roll

| Problem                | Don't Build          | Use Instead                                   | Why                                              |
| ---------------------- | -------------------- | --------------------------------------------- | ------------------------------------------------ |
| Icon sizes             | Manual resizing      | expo-assets-generator.vercel.app or EAS Build | Expo generates all required sizes from 1024x1024 |
| Blur effect            | Custom shader/filter | expo-blur BlurView                            | Native performance, cross-platform               |
| Splash timing          | Manual setTimeout    | SplashScreen.preventAutoHideAsync/hideAsync   | Handles edge cases, race conditions              |
| Spring physics         | Manual easing math   | Reanimated withSpring                         | Physics-based, configurable                      |
| Gradient interpolation | Manual color math    | Reanimated interpolateColor                   | Handles color spaces correctly                   |

**Key insight:** The animation infrastructure is already built. Don't refactor AnimatedSplash.js - just update colors and add the blur overlay as a second phase of the animation.
</dont_hand_roll>

<common_pitfalls>

## Common Pitfalls

### Pitfall 1: White Flash Between Splash and Animation

**What goes wrong:** Brief white screen appears when transitioning from native splash to JS
**Why it happens:** SplashScreen.hideAsync() called too early or too late
**How to avoid:** Keep native splash visible until animated splash is mounted and ready
**Warning signs:** Flash visible in release builds (not in Expo Go)

### Pitfall 2: expo-blur Intensity Not Animating

**What goes wrong:** BlurView intensity doesn't respond to Reanimated shared values
**Why it happens:** Was an Expo 52 bug, now fixed in Reanimated 4.x
**How to avoid:** Ensure react-native-reanimated is up to date (4.1.1+ is fine)
**Warning signs:** Blur stays static despite animation code

### Pitfall 3: Android Blur Not Working

**What goes wrong:** Blur effect visible on iOS, nothing on Android
**Why it happens:** Android doesn't natively support blur; expo-blur has experimental support
**How to avoid:** Use `experimentalBlurMethod="blur"` prop on BlurView
**Warning signs:** Android shows plain View with translucent background

### Pitfall 4: App Icon Transparency Issues

**What goes wrong:** iOS app icon has unexpected background color
**Why it happens:** iOS requires opaque icons (no transparency)
**How to avoid:** iOS icon must have solid background; Android adaptive-icon can have transparency
**Warning signs:** White corners or unexpected background on iOS home screen

### Pitfall 5: Splash Screen Testing in Wrong Environment

**What goes wrong:** Splash looks different in production than development
**Why it happens:** Expo Go shows app icon instead of splash; behavior differs from standalone
**How to avoid:** Test splash screen in release builds or TestFlight
**Warning signs:** "Why doesn't my splash animation show?" - it won't in Expo Go
</common_pitfalls>

<code_examples>

## Code Examples

### Updating AnimatedSplash Colors

```typescript
// Source: Current AnimatedSplash.js + new brand colors
// OLD:
const APERTURE_COLOR = '#FF6B6B'; // Coral
const BACKGROUND_COLOR = '#FAFAFA'; // Off-white

// NEW (Rewind brand):
const APERTURE_GRADIENT_START = '#8B5CF6'; // Purple (Tailwind violet-500)
const APERTURE_GRADIENT_END = '#EC4899'; // Pink (Tailwind pink-500)
const BACKGROUND_COLOR = '#0F0F0F'; // Near-black
```

### Expo App Icon Configuration

```json
// Source: Expo docs
// app.json
{
  "expo": {
    "name": "Rewind",
    "icon": "./assets/icon.png",
    "splash": {
      "image": "./assets/splash.png",
      "backgroundColor": "#0F0F0F"
    },
    "ios": {
      "icon": "./assets/icon-ios.png",
      "bundleIdentifier": "com.spoodsjs.rewind"
    },
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#0F0F0F"
      },
      "package": "com.spoodsjs.rewind"
    }
  }
}
```

### SplashScreen Timing Pattern

```typescript
// Source: Expo docs + App.js pattern
import * as SplashScreen from 'expo-splash-screen';

// CRITICAL: Call in global scope before component
SplashScreen.preventAutoHideAsync();

export default function App() {
  const [showAnimatedSplash, setShowAnimatedSplash] = useState(true);

  const onLayoutRootView = useCallback(async () => {
    // Hide native splash when layout is ready
    // Animated splash is already visible
    await SplashScreen.hideAsync();
  }, []);

  return (
    <View style={{ flex: 1 }} onLayout={onLayoutRootView}>
      {showAnimatedSplash && (
        <AnimatedSplash
          onAnimationComplete={() => setShowAnimatedSplash(false)}
        />
      )}
      <MainApp />
    </View>
  );
}
```

</code_examples>

<sota_updates>

## State of the Art (2025-2026)

| Old Approach             | Current Approach               | When Changed | Impact                                              |
| ------------------------ | ------------------------------ | ------------ | --------------------------------------------------- |
| Lottie splash            | Native + Reanimated            | 2024         | Lottie adds dependency; Reanimated is already there |
| expo-splash-screen delay | setOptions({ fade, duration }) | SDK 52       | Built-in fade animation, less custom code           |
| Custom blur shaders      | expo-blur + Reanimated         | SDK 52       | Native blur animatable with shared values           |

**New tools/patterns to consider:**

- **expo-custom-assets:** Config plugin for more splash control (not needed for this scope)
- **Moti:** Declarative animation wrapper (not needed, Reanimated patterns established)

**Deprecated/outdated:**

- **Manual splash duration via setTimeout:** Use SplashScreen API
- **react-native-splash-screen:** Use expo-splash-screen in Expo projects
  </sota_updates>

<open_questions>

## Open Questions

1. **Font for "Rewind" wordmark**
   - What we know: Needs retro/display character, rounded or vintage feel
   - What's unclear: Specific font choice (Google Fonts? Custom?)
   - Recommendation: Explore options during implementation - Fugaz One, Righteous, or Pacifico are candidates

2. **Cassette tape icon design**
   - What we know: Simplified/abstract, black background with accent colors
   - What's unclear: Exact design (will need design iteration or asset creation)
   - Recommendation: Create simple vector design or source from icon libraries; can iterate

3. **Exact gradient values for brand palette**
   - What we know: Purple primary, pink secondary, teal/lime tertiary
   - What's unclear: Exact hex values, gradient stops
   - Recommendation: Reference assets/IMG_6568.png during implementation for color extraction
     </open_questions>

<sources>
## Sources

### Primary (HIGH confidence)

- [Expo SplashScreen docs](https://docs.expo.dev/versions/latest/sdk/splash-screen/) - preventAutoHideAsync, hideAsync, setOptions
- [Expo BlurView docs](https://docs.expo.dev/versions/latest/sdk/blur-view/) - intensity animation
- [Expo App Icons docs](https://docs.expo.dev/develop/user-interface/splash-screen-and-app-icon/) - icon requirements
- Codebase: [src/components/AnimatedSplash.js](src/components/AnimatedSplash.js) - existing shutter pattern
- Codebase: [src/hooks/useSwipeableCard.js](src/hooks/useSwipeableCard.js) - Reanimated patterns

### Secondary (MEDIUM confidence)

- [Expo blog - Animated splash screens](https://expo.dev/blog/how-to-add-an-animated-splash-screen-with-expo-custom-assets) - expo-custom-assets approach
- [GitHub expo/expo#32781](https://github.com/expo/expo/issues/32781) - BlurView animation fix confirmed
- [expo-assets-generator](https://expo-assets-generator.vercel.app/) - icon generation tool

### Tertiary (LOW confidence - needs validation)

- [Reanimated useAnimatedProps docs](https://docs.swmansion.com/react-native-reanimated/docs/2.x/api/hooks/useAnimatedProps/) - SVG animation patterns (2.x docs, verify for 4.x)
  </sources>

<metadata>
## Metadata

**Research scope:**

- Core technology: expo-splash-screen, react-native-reanimated
- Ecosystem: expo-blur, expo-linear-gradient, expo-font
- Patterns: Splash transitions, blur animations, gradient interpolation
- Pitfalls: White flash, Android blur, icon transparency

**Confidence breakdown:**

- Standard stack: HIGH - All libraries already installed or bundled with Expo
- Architecture: HIGH - Existing AnimatedSplash.js validates pattern
- Pitfalls: HIGH - Documented in Expo issues and verified
- Code examples: HIGH - Based on official docs and existing codebase

**Research date:** 2026-01-25
**Valid until:** 2026-02-25 (30 days - Expo ecosystem stable)
</metadata>

---

_Phase: 30-rewind-rebrand_
_Research completed: 2026-01-25_
_Ready for planning: yes_
