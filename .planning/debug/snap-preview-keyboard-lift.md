---
status: diagnosed
trigger: "SnapPreviewScreen caption KeyboardAvoidingView doesn't lift high enough"
created: 2026-02-24T00:00:00Z
updated: 2026-02-24T00:00:00Z
---

## Current Focus

hypothesis: KeyboardAvoidingView is missing keyboardVerticalOffset to account for the footer (send button) which sits OUTSIDE the KAV, so KAV only lifts enough to clear the keyboard but not the footer that obscures the Polaroid bottom
test: Inspect layout structure — is the footer inside or outside the KAV?
expecting: Footer is outside KAV, meaning KAV doesn't know about the space consumed by the footer
next_action: Return diagnosis

## Symptoms

expected: When keyboard opens, the Polaroid frame (including the caption input at the bottom) should be fully visible above the keyboard
actual: Caption input at the bottom of the Polaroid frame is partially hidden by the keyboard on both iOS and Android
errors: None (visual layout issue)
reproduction: Open SnapPreviewScreen, tap the caption input to open keyboard
started: Since SnapPreviewScreen was implemented

## Eliminated

(none needed — root cause identified on first hypothesis)

## Evidence

- timestamp: 2026-02-24
  checked: SnapPreviewScreen.js layout structure (lines 172-251)
  found: |
  Layout is structured as:
  <View container flex:1>
  <View header> (OUTSIDE KAV)
  <KeyboardAvoidingView flex:1>
  <GestureDetector>
  <Animated.View polaroidOuter flex:1>
  <View polaroidFrame>
  <Image photo />
  <View captionStrip height:56>
  <TextInput />
  ...
  <View footer> (OUTSIDE KAV)
  implication: The footer (send button with dynamic paddingBottom) sits BELOW and OUTSIDE the KeyboardAvoidingView. KAV does not account for the footer height.

- timestamp: 2026-02-24
  checked: KeyboardAvoidingView configuration (line 193-196)
  found: |
  behavior={Platform.select({ ios: 'padding', android: 'height' })}
  NO keyboardVerticalOffset prop is set (defaults to 0)
  implication: With offset=0, KAV calculates lift based only on its own frame. Since the footer sits outside KAV below it, the KAV bottom edge is NOT the screen bottom — there's a gap equal to footer height. KAV thinks content is higher than it actually is relative to the keyboard.

- timestamp: 2026-02-24
  checked: Footer dimensions (lines 232-248, 332-336)
  found: |
  Footer has: paddingTop: 16, sendButton height: 48, paddingBottom: Math.max(insets.bottom, 16) + 8
  Total footer height = 16 + 48 + Math.max(insets.bottom, 16) + 8
  On iPhone with notch: ~16 + 48 + 34 + 8 = ~106px
  On iPhone without notch / Android: ~16 + 48 + 16 + 8 = ~88px
  implication: The footer consumes 88-106px of screen space that KAV doesn't know about, causing the content to be lifted ~88-106px less than needed.

- timestamp: 2026-02-24
  checked: ConversationScreen KAV for comparison (lines 558-561)
  found: |
  ConversationScreen uses behavior="padding" with keyboardVerticalOffset={Platform.select({ ios: 0, android: 0 })}
  BUT ConversationScreen has its input INSIDE the KAV (DMInput is a child of KAV), and there is no fixed footer below KAV.
  implication: ConversationScreen works because the KAV extends to the bottom of the screen. SnapPreviewScreen is different because the footer is outside KAV.

## Resolution

root_cause: |
The KeyboardAvoidingView on SnapPreviewScreen is missing a keyboardVerticalOffset to account for the footer (send button area) that sits OUTSIDE and BELOW the KAV.

The layout is: [header] [KAV with Polaroid] [footer]. The KAV only occupies the middle section. When the keyboard opens, KAV calculates how much to shrink/pad based on the distance from its own bottom edge to the top of the keyboard. But since the footer (~88-106px tall) sits between the KAV bottom and the screen bottom, KAV's bottom edge is actually ~88-106px ABOVE the screen bottom. The keyboard covers the footer entirely and then eats into KAV space, but KAV doesn't know the footer exists, so it under-compensates by exactly the footer height.

Additionally, the `behavior` on Android is set to `'height'` which is often unreliable. The more robust approach for this layout would be `'padding'` on both platforms, or restructuring so the footer is inside the KAV.

fix: (not applied — diagnosis only)
verification: (not applied — diagnosis only)
files_changed: []
