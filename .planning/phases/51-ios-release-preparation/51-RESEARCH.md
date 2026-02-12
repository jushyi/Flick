# Phase 51: iOS Release Preparation - Research

**Researched:** 2026-02-12
**Domain:** Apple Developer portal, EAS Build/Submit, App Store Connect, iOS distribution
**Confidence:** HIGH

<research_summary>

## Summary

Researched the complete iOS release preparation pipeline for an Expo/React Native Firebase app using EAS Build and EAS Submit. The process involves three main areas: (1) Apple Developer credential setup (distribution certificate + provisioning profile + APNs push key), (2) App Store Connect configuration (app listing, metadata, screenshots, privacy declarations), and (3) submission mechanics (EAS Submit, App Review, unlisted distribution request).

Key finding: EAS managed credentials handle the hardest parts automatically — distribution certificates, provisioning profiles, and push notification keys are generated and stored by EAS when you run `eas build`. The manual work is primarily in App Store Connect: creating the app listing, uploading screenshots, filling in metadata, declaring privacy data collection, setting EU trader status, and requesting unlisted distribution after App Review approval.

**Decision (2026-02-12):** Public listing instead of unlisted. Unlisted is permanent and irreversible — public listing preserves the option to market later. Also setting `supportsTablet: false` to avoid iPad rendering risk.

**Primary recommendation:** Use EAS managed credentials (not manual). Focus planning effort on App Store Connect metadata preparation, privacy manifest configuration, and screenshot capture.
</research_summary>

<standard_stack>

## Standard Stack

### Core (Already in Project)

| Tool                  | Version     | Purpose                    | Why Standard                   |
| --------------------- | ----------- | -------------------------- | ------------------------------ |
| EAS CLI               | >= 16.28.0  | Build, submit, credentials | Already configured in eas.json |
| Expo                  | Current SDK | App framework              | Already the project foundation |
| React Native Firebase | Current     | Firebase integration       | Already integrated             |

### Required for Release

| Tool                         | Purpose                           | When to Use                     |
| ---------------------------- | --------------------------------- | ------------------------------- |
| `eas build --platform ios`   | Generate production .ipa          | Production build step           |
| `eas submit --platform ios`  | Upload to App Store Connect       | After successful build          |
| `eas credentials`            | Manage Apple credentials          | Initial setup + troubleshooting |
| App Store Connect (web)      | App listing, metadata, review     | Manual configuration            |
| Apple Developer Portal (web) | Account, certificates (if manual) | EAS handles most of this        |

### Supporting

| Tool                         | Purpose                         | When to Use                     |
| ---------------------------- | ------------------------------- | ------------------------------- |
| Xcode (optional)             | Screenshot capture on simulator | If not using device screenshots |
| Fastlane snapshot (optional) | Automated screenshot generation | If many localizations needed    |
| Apple Transporter (optional) | Alternative upload method       | If EAS Submit has issues        |

### Alternatives Considered

| Instead of              | Could Use                            | Tradeoff                                             |
| ----------------------- | ------------------------------------ | ---------------------------------------------------- |
| EAS managed credentials | Local credentials (credentials.json) | More control but more manual work, no team sharing   |
| EAS Submit              | Transporter app / Xcode upload       | Manual process, no CI/CD integration                 |
| Manual screenshots      | Fastlane snapshot                    | Overkill for single-language single-device-class app |

**No installation needed** — all tools already in the project or are web-based portals.
</standard_stack>

<architecture_patterns>

## Architecture Patterns

### Release Preparation Workflow

```
1. Apple Developer Portal
   ├── Verify account active + paid
   ├── Bundle ID registered (com.spoodsjs.rewind)
   └── EAS manages certificates/profiles automatically

2. App Store Connect
   ├── Create app listing
   │   ├── App name: "Rewind"
   │   ├── Bundle ID: com.spoodsjs.rewind
   │   ├── SKU: rewind-v1
   │   └── Primary language
   ├── App Information
   │   ├── Privacy policy URL
   │   ├── App category
   │   ├── Age rating questionnaire
   │   └── EU trader status declaration
   ├── Version metadata
   │   ├── Screenshots (6.9" iPhone required)
   │   ├── Description, keywords, support URL
   │   ├── What's New text
   │   └── Review notes
   └── App Privacy
       └── Data collection declarations

3. Project Configuration
   ├── aps-environment: "production" in app.json
   ├── Privacy manifest (privacyManifests in app.json)
   ├── Version bump (app.json version)
   └── eas.json submit.production.ios.ascAppId

4. Build & Submit
   ├── eas build --platform ios --profile production
   ├── eas submit --platform ios
   └── Monitor TestFlight processing

5. Public Release (decision: skip unlisted)
   └── App goes live on App Store after App Review approval
```

### Pattern 1: EAS Managed Credentials (Recommended)

**What:** Let EAS CLI generate and manage all Apple credentials
**When to use:** Default for all Expo projects
**How it works:**

- First `eas build` prompts for Apple Developer account login
- EAS generates: Distribution Certificate, Provisioning Profile, APNs Push Key
- Credentials stored on EAS servers, reused for subsequent builds
- Team members only need Expo account access (not Apple Developer access)

### Pattern 2: Privacy Manifest Configuration

**What:** Declare required API reasons in app.json
**When to use:** Required for all App Store submissions
**Configuration:**

```json
{
  "expo": {
    "ios": {
      "privacyManifests": {
        "NSPrivacyAccessedAPITypes": [
          {
            "NSPrivacyAccessedAPIType": "NSPrivacyAccessedAPICategoryFileTimestamp",
            "NSPrivacyAccessedAPITypeReasons": ["C617.1"]
          },
          {
            "NSPrivacyAccessedAPIType": "NSPrivacyAccessedAPICategorySystemBootTime",
            "NSPrivacyAccessedAPITypeReasons": ["35F9.1"]
          },
          {
            "NSPrivacyAccessedAPIType": "NSPrivacyAccessedAPICategoryDiskSpace",
            "NSPrivacyAccessedAPITypeReasons": ["E174.1"]
          },
          {
            "NSPrivacyAccessedAPIType": "NSPrivacyAccessedAPICategoryUserDefaults",
            "NSPrivacyAccessedAPITypeReasons": ["CA92.1"]
          }
        ]
      }
    }
  }
}
```

**Note:** Check `node_modules/@react-native-firebase/*/ios/PrivacyInfo.xcprivacy` for additional entries needed from Firebase packages. Apple doesn't correctly parse privacy manifests from static CocoaPods dependencies — must aggregate manually.

### Pattern 3: APS Environment Switching

**What:** Switch push notification entitlement from development to production
**When to use:** Before production build
**Configuration in app.json:**

```json
{
  "expo": {
    "ios": {
      "entitlements": {
        "aps-environment": "production"
      }
    }
  }
}
```

**Warning:** With `aps-environment: "development"`, push notifications will NOT work in production builds. This is a common cause of "notifications stopped working after App Store release."

### Anti-Patterns to Avoid

- **Manual certificate management:** Unless required by enterprise policy, EAS managed is simpler and less error-prone
- **Skipping privacy manifest:** Apple will email rejection within minutes of TestFlight upload
- **Forgetting EU trader status:** App will be removed from EU App Store
- ~~**Setting unlisted before App Review:**~~ N/A — going with public listing
  </architecture_patterns>

<dont_hand_roll>

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem                 | Don't Build                          | Use Instead                                          | Why                                                 |
| ----------------------- | ------------------------------------ | ---------------------------------------------------- | --------------------------------------------------- |
| Certificate management  | Manual cert creation in Apple portal | `eas credentials` / EAS managed                      | Provisioning profile mismatches, expiry tracking    |
| App upload to App Store | Xcode manual upload                  | `eas submit`                                         | Automated, scriptable, CI/CD compatible             |
| Screenshot generation   | Manual screenshots one by one        | Simulator screenshots or Fastlane snapshot           | Consistent sizing, reproducible                     |
| Privacy manifest        | Hand-written PrivacyInfo.xcprivacy   | `privacyManifests` in app.json                       | EAS Build generates correct xcprivacy from config   |
| Version management      | Manual version bumps                 | `appVersionSource: "remote"` + `autoIncrement: true` | Already configured in eas.json                      |
| Push notification keys  | Manual APNs key download/upload      | EAS managed push key                                 | Auto-generated, stored securely, shared across team |

**Key insight:** Apple's developer toolchain is notoriously complex with certificates, profiles, and entitlements. EAS exists specifically to abstract this away. Every manual step is a potential point of failure — wrong certificate type, expired profile, mismatched bundle ID. Let EAS handle credentials; focus manual effort on the App Store Connect metadata that only a human can provide.
</dont_hand_roll>

<common_pitfalls>

## Common Pitfalls

### Pitfall 1: APS Environment Left as "development"

**What goes wrong:** Push notifications stop working after App Store release
**Why it happens:** `app.json` has `"aps-environment": "development"` (current project state)
**How to avoid:** Change to `"production"` before building for release. EAS production builds should use production APS environment.
**Warning signs:** Notifications work in dev builds but fail in TestFlight/production

### Pitfall 2: Missing Privacy Manifest Entries

**What goes wrong:** Apple rejects build within minutes of TestFlight upload
**Why it happens:** React Native + Firebase use APIs (UserDefaults, file timestamps, etc.) that require declared reasons
**How to avoid:** Add `privacyManifests` to `expo.ios` in app.json; check all Firebase package PrivacyInfo.xcprivacy files
**Warning signs:** Email from Apple about "ITMS-91053: Missing API declaration"

### ~~Pitfall 3: iPad Rendering Issues~~ RESOLVED

**Decision:** Set `supportsTablet: false` — app is phone-only, avoids iPad review risk entirely.

### ~~Pitfall 4: Unlisted Distribution Timing~~ RESOLVED

**Decision:** Going with public listing — unlisted workflow no longer applies.

### Pitfall 5: EU Trader Status Not Set

**What goes wrong:** App removed from EU App Store
**Why it happens:** Since Feb 2025, ALL developers must declare trader/non-trader status regardless of location
**How to avoid:** Set trader status in App Store Connect before submission (even for non-EU developers)
**Warning signs:** Warning in App Store Connect about missing trader status

### Pitfall 6: Firebase Data Collection Not Declared

**What goes wrong:** App privacy details incomplete, potential rejection
**Why it happens:** Firebase Auth collects phone numbers, Firebase Perf collects device/IP data, all need declaring
**How to avoid:** Reference Firebase's official data collection guide for each service used
**Warning signs:** Apple asks for additional information about data collection practices

### Pitfall 7: Bundle ID Mismatch

**What goes wrong:** Build fails or can't be submitted
**Why it happens:** Bundle ID in app.json doesn't match App Store Connect or Apple Developer portal
**How to avoid:** Verify `com.spoodsjs.rewind` is registered in Apple Developer portal and used in App Store Connect app listing
**Warning signs:** EAS build errors about provisioning profile not matching bundle ID

### ~~Pitfall 8: Unlisted Distribution is Permanent~~ RESOLVED

**Decision:** Going with public listing — this was the reason for the decision. Unlisted is irreversible; public preserves all options.
</common_pitfalls>

<code_examples>

## Code Examples

### app.json Production Configuration

```json
// Source: Expo docs + current project app.json
{
  "expo": {
    "ios": {
      "bundleIdentifier": "com.spoodsjs.rewind",
      "entitlements": {
        "aps-environment": "production"
      },
      "infoPlist": {
        "ITSAppUsesNonExemptEncryption": false,
        "UIBackgroundModes": ["remote-notification"]
      },
      "privacyManifests": {
        "NSPrivacyAccessedAPITypes": [
          {
            "NSPrivacyAccessedAPIType": "NSPrivacyAccessedAPICategoryFileTimestamp",
            "NSPrivacyAccessedAPITypeReasons": ["C617.1"]
          },
          {
            "NSPrivacyAccessedAPIType": "NSPrivacyAccessedAPICategorySystemBootTime",
            "NSPrivacyAccessedAPITypeReasons": ["35F9.1"]
          },
          {
            "NSPrivacyAccessedAPIType": "NSPrivacyAccessedAPICategoryDiskSpace",
            "NSPrivacyAccessedAPITypeReasons": ["E174.1"]
          },
          {
            "NSPrivacyAccessedAPIType": "NSPrivacyAccessedAPICategoryUserDefaults",
            "NSPrivacyAccessedAPITypeReasons": ["CA92.1"]
          }
        ]
      }
    }
  }
}
```

### eas.json Submit Configuration

```json
// Source: Expo EAS Submit docs
{
  "submit": {
    "production": {
      "ios": {
        "ascAppId": "YOUR_APP_STORE_CONNECT_APP_ID"
      }
    }
  }
}
```

**Note:** `ascAppId` is the Apple ID found in App Store Connect > App Information > General Information > Apple ID. This is NOT your Apple Developer account ID.

### EAS Commands Sequence

```bash
# Source: Expo docs

# 1. Set up credentials (interactive, one-time)
eas credentials --platform ios

# 2. Build production binary
eas build --platform ios --profile production

# 3. Submit to App Store Connect
eas submit --platform ios

# Or combine build + submit:
eas build --platform ios --profile production --auto-submit
```

### Firebase Data Collection Declaration Checklist

```
// Source: Firebase Apple platforms data collection docs
// Services used in this app and what to declare:

Firebase Auth (Phone):
  - Phone number (collected, linked to identity)
  - User ID (collected, linked to identity)

Firestore:
  - Device identifiers (collected, not linked to identity)

Firebase Storage:
  - Device identifiers (collected, not linked to identity)

Firebase Performance Monitoring:
  - Performance data (collected, not linked to identity)
  - Device identifiers (collected, not linked to identity)
  - IP address (collected, not linked to identity)

expo-notifications:
  - Device token (collected, linked to identity via FCM)
```

</code_examples>

<sota_updates>

## State of the Art (2025-2026)

| Old Approach                        | Current Approach              | When Changed | Impact                                            |
| ----------------------------------- | ----------------------------- | ------------ | ------------------------------------------------- |
| Manual cert + profile management    | EAS managed credentials       | 2022+        | No need to touch Apple Developer portal for certs |
| Separate screenshot sets per device | Single 6.9" set auto-scales   | Late 2024    | Only need one iPhone screenshot set               |
| No privacy manifest required        | Privacy manifest mandatory    | May 2024     | Must declare API usage reasons in app.json        |
| No trader status needed             | EU DSA trader status required | Feb 2025     | All developers must declare, even non-EU          |
| Xcode upload                        | EAS Submit + `--auto-submit`  | 2023+        | Fully automated upload pipeline                   |
| Manual version management           | `appVersionSource: "remote"`  | 2023+        | Already configured in project                     |

**New tools/patterns to consider:**

- **`eas build --auto-submit`:** Combines build + submit in one command, ideal for CI/CD
- **App Store Connect API:** Can automate metadata updates, but overkill for single app
- **Expo dashboard credentials UI:** Alternative to `eas credentials` CLI for visual management

**Deprecated/outdated:**

- **`.p12` certificate files:** EAS uses `.p8` APNs keys instead of per-app certificates
- **Manual provisioning profiles:** EAS generates and manages these automatically
- **Separate screenshot sets per iPhone size:** Apple auto-scales from 6.9" set since late 2024
  </sota_updates>

<open_questions>

## Open Questions

1. **Privacy manifest completeness**
   - What we know: Base RN + Firebase needs FileTimestamp, SystemBootTime, DiskSpace, UserDefaults reasons
   - What's unclear: Whether Giphy SDK, expo-camera, expo-audio, or other project dependencies add additional required reasons
   - Recommendation: During implementation, run `find node_modules -name "PrivacyInfo.xcprivacy"` to discover all dependency privacy manifests and aggregate their entries

2. ~~**iPad compatibility**~~ RESOLVED — setting `supportsTablet: false`

3. ~~**Unlisted distribution**~~ RESOLVED — going with public listing

4. **App Store Connect app name availability**
   - What we know: App name "Rewind" must be unique on App Store
   - What's unclear: Whether "Rewind" is available (common word, likely taken)
   - Recommendation: Check availability early; have alternatives ready (e.g., "Rewind - Photo Journal", "REWIND")

5. ~~**`supportsTablet` vs App Review**~~ RESOLVED — setting `supportsTablet: false`
   </open_questions>

<sources>
## Sources

### Primary (HIGH confidence)

- [EAS Managed Credentials](https://docs.expo.dev/app-signing/managed-credentials/) — credential automation, push key management
- [EAS Submit iOS](https://docs.expo.dev/submit/ios/) — submission configuration, ascAppId
- [EAS Submit eas.json](https://docs.expo.dev/submit/eas-json/) — submit profile configuration
- [App Store Best Practices](https://docs.expo.dev/distribution/app-stores/) — Expo-specific submission guidance
- [Privacy Manifests](https://docs.expo.dev/guides/apple-privacy/) — privacyManifests configuration in app.json
- [Unlisted App Distribution](https://developer.apple.com/support/unlisted-app-distribution/) — Apple's official unlisted process
- [Screenshot Specifications](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/) — required dimensions
- [Firebase Data Collection](https://firebase.google.com/docs/ios/app-store-data-collection) — what to declare per Firebase service
- [EU DSA Trader Requirements](https://developer.apple.com/help/app-store-connect/manage-compliance-information/manage-european-union-digital-services-act-trader-requirements/) — trader status declaration

### Secondary (MEDIUM confidence)

- [Push Notification Setup](https://docs.expo.dev/push-notifications/push-notifications-setup/) — APNs key configuration
- [App Credentials](https://docs.expo.dev/app-signing/app-credentials/) — credential types and management
- [Privacy Manifest Gist](https://gist.github.com/catalinmiron/d2cabb835088d0342bc48030464ee615) — community-verified app.json config
- [React Native Firebase Privacy Manifest Discussion](https://github.com/invertase/react-native-firebase/discussions/7664) — Firebase-specific privacy entries
- [expo-notifications aps-environment issues](https://github.com/expo/expo/issues/37101) — production entitlement troubleshooting

### Tertiary (LOW confidence - needs validation)

- App name "Rewind" availability — needs checking in App Store Connect during implementation
- Giphy SDK privacy manifest entries — needs checking in node_modules during implementation
  </sources>

<metadata>
## Metadata

**Research scope:**

- Core technology: EAS Build/Submit, Apple Developer Portal, App Store Connect
- Ecosystem: Certificates, provisioning profiles, APNs keys, privacy manifests
- Patterns: EAS managed credentials, privacy declaration, unlisted distribution workflow
- Pitfalls: APS environment, privacy manifest, iPad rendering, EU trader, unlisted permanence

**Confidence breakdown:**

- Standard stack: HIGH — EAS is the standard for Expo, well-documented
- Architecture: HIGH — workflow verified across Expo docs + Apple docs
- Pitfalls: HIGH — sourced from Expo GitHub issues, Apple docs, community reports
- Code examples: HIGH — from official Expo docs, verified against current project config

**Research date:** 2026-02-12
**Valid until:** 2026-03-12 (30 days — Apple/EAS processes stable, check for Expo SDK updates)
</metadata>

---

_Phase: 51-ios-release-preparation_
_Research completed: 2026-02-12_
_Ready for planning: yes_
