# Phase 6: Phone Auth Implementation - Research

**Researched:** 2026-01-12
**Domain:** Firebase Phone Authentication for Expo/React Native
**Confidence:** HIGH

<research_summary>
## Summary

Researched Firebase Phone Authentication implementation for Expo SDK 54 React Native app. The current project uses Firebase JS SDK (v12.7.0) for auth. Phone authentication in mobile apps has two primary approaches: Firebase JS SDK with web-based reCAPTCHA, or React Native Firebase with native silent APNs notifications.

**Key finding:** The project must transition from Expo Go to a development build to implement phone auth properly. While Firebase JS SDK can technically work in Expo Go, the reCAPTCHA flow is web-based and provides poor UX. React Native Firebase with `@react-native-firebase/auth` provides native phone auth with silent APNs verification (no visible reCAPTCHA for most users).

**Primary recommendation:** Use React Native Firebase (`@react-native-firebase/auth`) with Expo development builds. This requires migrating from Firebase JS SDK but provides native phone verification, better UX, and aligns with the already-initialized EAS project. The project already has push notifications set up (Week 11), so APNs infrastructure is partially in place.
</research_summary>

<standard_stack>
## Standard Stack

The established libraries/tools for phone authentication in Expo/React Native:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @react-native-firebase/app | ^23.0.1 | Firebase core for React Native | Required base for all Firebase services |
| @react-native-firebase/auth | ^23.0.1 | Phone authentication | Native SMS verification, silent APNs support |
| expo-dev-client | ~5.1.8 | Development builds | Required for React Native Firebase |
| expo-build-properties | ~0.14.1 | iOS build configuration | Configure useFrameworks for Firebase |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| libphonenumber-js | ^1.12.6 | Phone number validation/formatting | Validate before sending to Firebase |
| react-native-international-phone-number | ^0.9.0 | Phone input with country picker | Native UI for phone entry |
| react-native-country-picker-modal | ^2.0.0 | Country code selection | If building custom phone input |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| React Native Firebase | Firebase JS SDK + expo-firebase-recaptcha | DEPRECATED - expo-firebase-recaptcha removed in SDK 48 |
| React Native Firebase | Firebase JS SDK + web RecaptchaVerifier | Poor UX - web-based reCAPTCHA in app, doesn't feel native |
| libphonenumber-js | google-libphonenumber | google-libphonenumber is 550KB vs 145KB |
| react-native-international-phone-number | Custom implementation | Don't hand-roll phone input masking |

**Installation:**
```bash
# Core Firebase for phone auth
npm install @react-native-firebase/app @react-native-firebase/auth

# Development client for native code
npx expo install expo-dev-client expo-build-properties

# Phone number validation (use 'min' bundle for smaller size)
npm install libphonenumber-js

# Phone input component (choose one)
npm install react-native-international-phone-number
# OR
npm install react-native-phone-input react-native-country-picker-modal
```

**app.json configuration:**
```json
{
  "expo": {
    "plugins": [
      "@react-native-firebase/app",
      "@react-native-firebase/auth",
      [
        "expo-build-properties",
        {
          "ios": {
            "useFrameworks": "static"
          }
        }
      ]
    ]
  }
}
```
</standard_stack>

<architecture_patterns>
## Architecture Patterns

### Recommended Project Structure
```
src/
├── services/firebase/
│   ├── firebaseConfig.js       # Keep existing config
│   ├── authService.js          # UPDATE: Replace email auth with phone auth
│   └── phoneAuthService.js     # NEW: Phone-specific auth functions
├── context/
│   └── AuthContext.js          # UPDATE: Phone auth state management
├── screens/
│   ├── PhoneInputScreen.js     # NEW: Phone number entry
│   ├── VerificationScreen.js   # NEW: SMS code verification
│   └── ProfileSetupScreen.js   # KEEP: Already exists
├── components/
│   └── PhoneNumberInput.js     # NEW: Reusable phone input component
└── utils/
    └── phoneUtils.js           # NEW: Phone validation helpers
```

### Pattern 1: Two-Step Phone Auth Flow
**What:** Separate phone number entry and verification into distinct screens
**When to use:** Always - this is the standard UX pattern
**Example:**
```javascript
// Step 1: PhoneInputScreen - Send verification code
import auth from '@react-native-firebase/auth';

async function sendVerificationCode(phoneNumber) {
  // phoneNumber must be E.164 format: +14155551234
  const confirmation = await auth().signInWithPhoneNumber(phoneNumber);
  // Store confirmation object for Step 2
  return confirmation;
}

// Step 2: VerificationScreen - Verify the code
async function verifyCode(confirmation, code) {
  try {
    await confirmation.confirm(code);
    // User is now signed in, Firebase auth state listener fires
  } catch (error) {
    if (error.code === 'auth/invalid-verification-code') {
      // Handle invalid code
    }
  }
}
```

### Pattern 2: Phone Number Validation Before Firebase
**What:** Validate phone numbers locally before sending to Firebase
**When to use:** Always - prevents wasted API calls and SMS costs
**Example:**
```javascript
import { parsePhoneNumberFromString, isValidPhoneNumber } from 'libphonenumber-js';

function validateAndFormatPhone(phoneNumber, countryCode) {
  // Parse with country code context
  const parsed = parsePhoneNumberFromString(phoneNumber, countryCode);

  if (!parsed || !parsed.isValid()) {
    return { valid: false, error: 'Invalid phone number' };
  }

  // Return E.164 format required by Firebase
  return {
    valid: true,
    e164: parsed.format('E.164')  // e.g., "+14155551234"
  };
}
```

### Pattern 3: Auth State Management with Phone
**What:** Update AuthContext to handle phone-based auth flow
**When to use:** Core architecture change
**Example:**
```javascript
// AuthContext.js - Key changes
import auth from '@react-native-firebase/auth';

const [confirmationResult, setConfirmationResult] = useState(null);

const sendVerificationCode = async (phoneNumber) => {
  setLoading(true);
  try {
    const confirmation = await auth().signInWithPhoneNumber(phoneNumber);
    setConfirmationResult(confirmation);
    return { success: true };
  } catch (error) {
    return { success: false, error: getPhoneAuthErrorMessage(error.code) };
  } finally {
    setLoading(false);
  }
};

const verifyCode = async (code) => {
  if (!confirmationResult) {
    return { success: false, error: 'No verification in progress' };
  }
  setLoading(true);
  try {
    await confirmationResult.confirm(code);
    // onAuthStateChanged listener handles the rest
    return { success: true };
  } catch (error) {
    return { success: false, error: getPhoneAuthErrorMessage(error.code) };
  } finally {
    setLoading(false);
  }
};
```

### Anti-Patterns to Avoid
- **Storing phone number in local state after sign-in:** Use Firebase user.phoneNumber instead
- **Skipping E.164 format validation:** Firebase requires exact format (+[country][number])
- **Not handling auto-verification on Android:** Android can auto-read SMS, handle `auth/auto-verification-completed`
- **Hardcoding country code:** Always let users select their country
- **Not setting test phone numbers in Firebase Console:** Required for automated testing
</architecture_patterns>

<dont_hand_roll>
## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Phone number validation | Regex patterns | libphonenumber-js | International formats are complex (UK: 10-11 digits, US: 10, varied worldwide) |
| Phone input masking | Custom TextInput with formatting | react-native-international-phone-number | Auto-mask per country, flag display, country picker |
| Country code selection | Hardcoded list | react-native-country-picker-modal | 250+ countries, updated regularly, search support |
| E.164 formatting | String concatenation | parsePhoneNumberFromString().format('E.164') | Handles edge cases, validates while formatting |
| SMS verification UI | Custom timer logic | Built-in resend timer pattern | Race conditions with SMS delivery timing |
| reCAPTCHA handling | Manual WebView | React Native Firebase auto-handles | Silent APNs with automatic fallback |
| Error message parsing | Switch on error.message | Map error.code to user messages | Firebase error codes are stable, messages change |

**Key insight:** Phone number handling has decades of edge cases across 250+ countries with different formats, lengths, and validation rules. Google's libphonenumber library (which libphonenumber-js wraps) is the definitive solution. Hand-rolling phone validation guarantees missed edge cases that frustrate international users.
</dont_hand_roll>

<common_pitfalls>
## Common Pitfalls

### Pitfall 1: Silent APNs Notifications Not Working (Always Shows reCAPTCHA)
**What goes wrong:** Every phone auth attempt shows visible reCAPTCHA challenge instead of seamless verification
**Why it happens:** APNs not properly configured, background refresh disabled, or simulator testing
**How to avoid:**
1. Upload APNs authentication key to Firebase Console → Project Settings → Cloud Messaging
2. Re-download GoogleService-Info.plist after enabling phone auth
3. Add custom URL scheme to app for reCAPTCHA callback
4. Configure `UIBackgroundModes: ["remote-notification"]` in app.json
5. Test on physical device with background refresh enabled
**Warning signs:** Works in Firebase Console test but shows reCAPTCHA on real device

### Pitfall 2: Expo SDK 54 + React Native Firebase Build Failures
**What goes wrong:** iOS build fails with framework linking errors
**Why it happens:** firebase-ios-sdk requires `use_frameworks: static` but conflicts with Expo's prebuilt XCFrameworks in SDK 54
**How to avoid:**
```json
// app.json - Required config
{
  "plugins": [
    ["expo-build-properties", {
      "ios": {
        "useFrameworks": "static"
      }
    }]
  ]
}
```
Check GitHub issue #8657 for latest workarounds if build fails.
**Warning signs:** Build error mentioning "use_frameworks" or "firebase-ios-sdk"

### Pitfall 3: Phone Number Format Rejection
**What goes wrong:** Firebase rejects phone number with "Invalid phone number" error
**Why it happens:** Number not in E.164 format (must be +[country code][number] with no spaces/dashes)
**How to avoid:**
```javascript
// Always format before sending to Firebase
import { parsePhoneNumberFromString } from 'libphonenumber-js';

const phone = parsePhoneNumberFromString(userInput, selectedCountry);
const e164 = phone.format('E.164'); // "+14155551234"
await auth().signInWithPhoneNumber(e164);
```
**Warning signs:** Works for some countries but not others

### Pitfall 4: API Key Restrictions Breaking reCAPTCHA Fallback
**What goes wrong:** reCAPTCHA fails with "Cannot contact reCAPTCHA" when silent APNs unavailable
**Why it happens:** Firebase API key restricted to bundle IDs, but reCAPTCHA runs in browser context
**How to avoid:**
- Add `*.firebaseapp.com` to API key allowed referrers in Google Cloud Console
- Or ensure silent APNs always works (upload APNs key properly)
**Warning signs:** Works perfectly with silent notifications but fails completely without them

### Pitfall 5: Missing Firebase Phone Auth Provider in Console
**What goes wrong:** Auth fails with "Phone authentication is disabled"
**Why it happens:** Phone sign-in provider not enabled in Firebase Console
**How to avoid:**
1. Firebase Console → Authentication → Sign-in method
2. Enable "Phone" provider
3. Add test phone numbers (optional but recommended)
**Warning signs:** Error code `auth/operation-not-allowed`

### Pitfall 6: Not Handling Android Auto-Verification
**What goes wrong:** User enters code manually even though SMS was already processed
**Why it happens:** Android can auto-read SMS and complete verification without user input
**How to avoid:**
```javascript
// Handle auto-verification completing before user types
auth().onAuthStateChanged(user => {
  if (user && isOnVerificationScreen) {
    // Navigate away - verification completed automatically
    navigation.navigate('ProfileSetup');
  }
});
```
**Warning signs:** "Invalid code" errors on Android when user enters correct code
</common_pitfalls>

<code_examples>
## Code Examples

Verified patterns from official sources:

### Complete Phone Auth Service
```javascript
// Source: React Native Firebase docs + libphonenumber-js
import auth from '@react-native-firebase/auth';
import { parsePhoneNumberFromString, isValidPhoneNumber } from 'libphonenumber-js';

const getPhoneAuthErrorMessage = (errorCode) => {
  switch (errorCode) {
    case 'auth/invalid-phone-number':
      return 'Invalid phone number format. Please check and try again.';
    case 'auth/missing-phone-number':
      return 'Please enter your phone number.';
    case 'auth/quota-exceeded':
      return 'Too many attempts. Please try again later.';
    case 'auth/user-disabled':
      return 'This account has been disabled.';
    case 'auth/invalid-verification-code':
      return 'Invalid verification code. Please try again.';
    case 'auth/session-expired':
      return 'Verification expired. Please request a new code.';
    case 'auth/too-many-requests':
      return 'Too many requests. Please wait before trying again.';
    case 'auth/operation-not-allowed':
      return 'Phone authentication is not enabled.';
    default:
      return 'An error occurred. Please try again.';
  }
};

export const validatePhoneNumber = (phoneNumber, countryCode) => {
  if (!phoneNumber || phoneNumber.trim() === '') {
    return { valid: false, error: 'Phone number is required' };
  }

  const parsed = parsePhoneNumberFromString(phoneNumber, countryCode);

  if (!parsed) {
    return { valid: false, error: 'Could not parse phone number' };
  }

  if (!parsed.isValid()) {
    return { valid: false, error: 'Invalid phone number for selected country' };
  }

  return {
    valid: true,
    e164: parsed.format('E.164'),
    formatted: parsed.formatNational()
  };
};

export const sendVerificationCode = async (phoneNumber, countryCode) => {
  // Validate and format first
  const validation = validatePhoneNumber(phoneNumber, countryCode);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  try {
    const confirmation = await auth().signInWithPhoneNumber(validation.e164);
    return {
      success: true,
      confirmation,
      formattedNumber: validation.formatted
    };
  } catch (error) {
    return {
      success: false,
      error: getPhoneAuthErrorMessage(error.code)
    };
  }
};

export const verifyCode = async (confirmation, code) => {
  if (!confirmation) {
    return { success: false, error: 'No verification in progress' };
  }

  if (!code || code.length !== 6) {
    return { success: false, error: 'Please enter the 6-digit code' };
  }

  try {
    const credential = await confirmation.confirm(code);
    return { success: true, user: credential.user };
  } catch (error) {
    return {
      success: false,
      error: getPhoneAuthErrorMessage(error.code)
    };
  }
};

export const getCurrentUser = () => auth().currentUser;
export const signOut = () => auth().signOut();
```

### Phone Input Screen Pattern
```javascript
// Source: Community pattern verified with react-native-international-phone-number docs
import React, { useState, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import PhoneInput from 'react-native-international-phone-number';

function PhoneInputScreen({ navigation }) {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [selectedCountry, setSelectedCountry] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSendCode = async () => {
    setError('');
    setLoading(true);

    const result = await sendVerificationCode(
      phoneNumber,
      selectedCountry?.cca2 || 'US'
    );

    setLoading(false);

    if (result.success) {
      navigation.navigate('Verification', {
        confirmation: result.confirmation,
        phoneNumber: result.formattedNumber
      });
    } else {
      setError(result.error);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Enter your phone number</Text>

      <PhoneInput
        value={phoneNumber}
        onChangePhoneNumber={setPhoneNumber}
        selectedCountry={selectedCountry}
        onChangeSelectedCountry={setSelectedCountry}
        defaultCountry="US"
        placeholder="Phone number"
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <TouchableOpacity
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={handleSendCode}
        disabled={loading || !phoneNumber}
      >
        <Text style={styles.buttonText}>
          {loading ? 'Sending...' : 'Send Code'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}
```

### Verification Screen Pattern
```javascript
// Source: React Native Firebase docs
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity } from 'react-native';

function VerificationScreen({ route, navigation }) {
  const { confirmation, phoneNumber } = route.params;
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resendTimer, setResendTimer] = useState(60);

  const inputRef = useRef(null);

  // Auto-focus code input
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Resend timer countdown
  useEffect(() => {
    if (resendTimer > 0) {
      const timer = setTimeout(() => setResendTimer(prev => prev - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendTimer]);

  const handleVerify = async () => {
    setError('');
    setLoading(true);

    const result = await verifyCode(confirmation, code);

    setLoading(false);

    if (!result.success) {
      setError(result.error);
      setCode(''); // Clear on error
    }
    // Success handled by auth state listener in AuthContext
  };

  const handleCodeChange = (text) => {
    // Only allow digits, max 6
    const cleaned = text.replace(/\D/g, '').slice(0, 6);
    setCode(cleaned);

    // Auto-submit when 6 digits entered
    if (cleaned.length === 6) {
      handleVerify();
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Verify your number</Text>
      <Text style={styles.subtitle}>
        We sent a code to {phoneNumber}
      </Text>

      <TextInput
        ref={inputRef}
        style={styles.codeInput}
        value={code}
        onChangeText={handleCodeChange}
        keyboardType="number-pad"
        maxLength={6}
        placeholder="000000"
        autoComplete="sms-otp" // Android auto-fill
        textContentType="oneTimeCode" // iOS auto-fill
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <TouchableOpacity
        style={styles.resendButton}
        disabled={resendTimer > 0}
        onPress={() => {/* Resend logic */}}
      >
        <Text style={styles.resendText}>
          {resendTimer > 0
            ? `Resend code in ${resendTimer}s`
            : 'Resend code'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}
```

### Firebase Console Test Phone Numbers
```javascript
// For testing without real SMS - configure in Firebase Console
// Authentication → Sign-in method → Phone → Phone numbers for testing

// Test numbers to add:
// +1 650-555-1234  Code: 123456
// +44 7700 900123  Code: 123456

// In code, these work like real numbers:
await auth().signInWithPhoneNumber('+16505551234');
// Then verify with code '123456'
```
</code_examples>

<sota_updates>
## State of the Art (2025-2026)

What's changed recently:

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| expo-firebase-recaptcha | React Native Firebase | SDK 48 (2023) | expo-firebase-recaptcha deprecated, must use RN Firebase |
| Firebase JS SDK for phone auth | React Native Firebase | 2024 | JS SDK reCAPTCHA poor mobile UX, native is standard |
| firebase@^11.x | firebase@^12.0.0+ | Expo SDK 53+ | ES module resolution changes require v12+ |
| Manual APNs setup | Config plugins auto-setup | 2024 | @react-native-firebase/auth plugin handles iOS config |
| Expo Go development | Development builds | 2024+ | Native Firebase requires expo-dev-client |

**New tools/patterns to consider:**
- **Expo Config Plugins**: @react-native-firebase/auth plugin auto-configures iOS reCAPTCHA and URL schemes
- **Auto-fill support**: `textContentType="oneTimeCode"` (iOS) and `autoComplete="sms-otp"` (Android) for auto-reading verification codes
- **libphonenumber-js 'min' bundle**: 65KB reduced bundle for basic validation vs 145KB full

**Deprecated/outdated:**
- **expo-firebase-recaptcha**: Removed in SDK 48, do not use
- **Firebase JS SDK RecaptchaVerifier**: Works but provides poor mobile UX (web-based popup)
- **google-libphonenumber**: Use libphonenumber-js instead (smaller, maintained)
</sota_updates>

<critical_decision>
## Critical Decision Required

**The project must decide between two approaches:**

### Option A: Continue with Firebase JS SDK (Current Setup)
**Pros:**
- No migration needed for existing auth code
- Could technically work in Expo Go (with web reCAPTCHA)

**Cons:**
- Web-based reCAPTCHA popup - poor UX
- No silent APNs verification
- Every user sees reCAPTCHA challenge
- expo-firebase-recaptcha is deprecated

**Verdict:** NOT RECOMMENDED for phone auth

### Option B: Migrate to React Native Firebase (RECOMMENDED)
**Pros:**
- Native phone verification with silent APNs
- Most users never see reCAPTCHA
- Standard industry approach
- Config plugin handles iOS setup
- Future-proof for other Firebase services

**Cons:**
- Requires development build (no more Expo Go)
- Migration effort from Firebase JS SDK
- Learning curve for React Native Firebase APIs

**Verdict:** RECOMMENDED - This is the standard approach

### Recommendation

Given that:
1. The project already has EAS initialized (projectId in place)
2. Push notifications already require development builds
3. Phone auth UX is critical for user experience
4. expo-firebase-recaptcha is deprecated

**The recommendation is Option B: Migrate to React Native Firebase.**

This aligns with Week 12's planned "standalone development app" build and provides the best user experience for phone authentication.
</critical_decision>

<open_questions>
## Open Questions

Things that couldn't be fully resolved:

1. **Existing User Migration Strategy**
   - What we know: Current users have email-based accounts in Firestore
   - What's unclear: How to handle existing users when switching to phone-only auth
   - Recommendation: Phase 7 should address migration - likely allow existing users to add phone number to account

2. **Firebase Quota Limits**
   - What we know: Firebase has SMS sending limits (throttled after many requests)
   - What's unclear: Exact limits for the current project's Firebase plan
   - Recommendation: Check Firebase Console for current limits, consider Firebase Blaze plan for production

3. **International Phone Number Support Scope**
   - What we know: Firebase Phone Auth not available in all countries
   - What's unclear: Which countries are target markets for this app
   - Recommendation: Define target countries in Phase 8 (Polish & Testing)
</open_questions>

<sources>
## Sources

### Primary (HIGH confidence)
- [Expo Using Firebase Guide](https://docs.expo.dev/guides/using-firebase/) - SDK options, config plugins, deprecation info
- [React Native Firebase Phone Auth](https://rnfirebase.io/auth/phone-auth) - Setup, code examples, iOS config
- [Firebase Phone Auth iOS Docs](https://firebase.google.com/docs/auth/ios/phone-auth) - APNs setup, silent notifications, reCAPTCHA

### Secondary (MEDIUM confidence)
- [GitHub #8657](https://github.com/invertase/react-native-firebase/issues/8657) - Expo SDK 54 build workaround (verified with community reports)
- [GitHub Discussion #7085](https://github.com/invertase/react-native-firebase/discussions/7085) - Silent APNs configuration issues

### Tertiary (LOW confidence - needs validation)
- react-native-international-phone-number - Listed as option but npm page unavailable for version verification
- libphonenumber-js exact version - npm unavailable, version ^1.12.6 based on search results
</sources>

<metadata>
## Metadata

**Research scope:**
- Core technology: Firebase Phone Authentication (React Native Firebase)
- Ecosystem: libphonenumber-js, phone input components, Expo config plugins
- Patterns: Two-step verification flow, auth state management
- Pitfalls: APNs setup, reCAPTCHA fallback, E.164 formatting, SDK 54 build issues

**Confidence breakdown:**
- Standard stack: HIGH - verified with official Expo and Firebase docs
- Architecture: HIGH - from official React Native Firebase documentation
- Pitfalls: HIGH - documented in GitHub issues and official troubleshooting
- Code examples: HIGH - from official docs with minor adaptations

**Research date:** 2026-01-12
**Valid until:** 2026-02-12 (30 days - Firebase/Expo ecosystem relatively stable)
</metadata>

---

*Phase: 06-phone-auth-implementation*
*Research completed: 2026-01-12*
*Ready for planning: yes*
