# Phase 15.1 Discovery: iOS Live Activities

**Discovery Level:** Level 2 (Standard Research)
**Date:** 2026-01-21

## Research Summary

### iOS Live Activities Overview

Live Activities are a feature introduced in iOS 16.2 that allows apps to display real-time, glanceable information on the Lock Screen and Dynamic Island. For the Lapse clone, this would show the darkroom photo count persistently, updating in real-time as photos develop and become ready.

### Library Assessment: expo-live-activity

**Repository:** [software-mansion-labs/expo-live-activity](https://github.com/software-mansion-labs/expo-live-activity)

**Maturity:**
- 465 GitHub stars, 24 forks
- Early development stage
- Warning: "Breaking changes can be introduced in minor version upgrades"

**Requirements:**
- iOS 16.2 minimum
- Expo DevClient (NOT compatible with Expo Go)
- Images stored in `assets/liveActivity` folder (max 4KB per asset due to iOS constraints)
- Configuration via app.json/app.config.js plugin setup
- Requires `npx expo prebuild --clean` after configuration

**API Functions:**
- `startActivity()` - initiates new Live Activities
- `updateActivity()` - modifies existing activities
- `stopActivity()` - terminates activities
- `addActivityTokenListener()` - monitors push notification token changes
- `addActivityPushToStartTokenListener()` - tracks push-to-start tokens
- `addActivityUpdatesListener()` - subscribes to state changes

### Implementation Complexity

**What's Required:**
1. **Native Swift/SwiftUI code** - ActivityKit widgets require Swift code in an iOS target
2. **Widget Extension** - A separate iOS target for the widget UI
3. **Development Build** - Cannot test in Expo Go, requires `eas build --profile development`
4. **Push Token Management** - Live Activities need their own push tokens for remote updates
5. **App Configuration** - Info.plist entries for Live Activities capability

**Estimated Effort:**
- Initial setup: 2-4 hours (library config, widget extension, basic UI)
- Integration: 2-3 hours (React Native bridge, state sync)
- Testing: 1-2 hours (requires physical device with development build)
- Total: 5-9 hours

### Recommendation

**Defer to Phase 15.1-02** for the following reasons:

1. **Complexity mismatch**: Live Activities is a full native iOS feature requiring Swift/SwiftUI code, widget extensions, and development builds. The notification fix (15.1-01) is a 30-45 minute Cloud Function update.

2. **Library maturity**: expo-live-activity has breaking change warnings. Better to implement core notification fixes first, then add Live Activities as enhancement.

3. **Testing requirements**: Live Activities require physical device + development build. The notification fix can be verified with logs and existing infrastructure.

4. **Value delivery**: Users benefit immediately from notification spam fix. Live Activities is a polish feature.

### For Plan 15.1-02 (Future)

When ready to implement Live Activities, the plan should:

1. Add expo-live-activity to project and configure plugins
2. Create Swift widget extension with darkroom count UI
3. Bridge activity start/update/stop to React Native
4. Update Cloud Function to send push tokens to Live Activities
5. Test full flow on physical device with development build

### Sources

- [expo-live-activity GitHub](https://github.com/software-mansion-labs/expo-live-activity)
- [iOS Live Activities with Expo - Medium](https://medium.com/@kutaui/ios-live-activities-with-expo-react-native-fa84c8e5a9b7)
- [Callstack Live Activities Guide](https://www.callstack.com/events/implementing-ios-live-activities-in-react-native)
- [Building Live Activity Timer - Level Up Coding](https://levelup.gitconnected.com/building-a-live-activity-timer-in-expo-626b162f3e8d)
