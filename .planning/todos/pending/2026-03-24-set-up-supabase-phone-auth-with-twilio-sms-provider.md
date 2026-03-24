---
created: 2026-03-24T17:23:30.233Z
title: Set up Supabase phone auth with Twilio SMS provider
area: auth
files:
  - src/screens/PhoneInputScreen.js
  - src/screens/VerificationScreen.js
  - src/services/supabase/phoneAuthService.ts
  - src/context/PhoneAuthContext.js
---

## Problem

Phone auth is currently using Firebase as a temporary workaround because the Supabase project doesn't have a phone SMS provider configured. Phase 13 rewrote the auth screens for Supabase OTP flow, but the screens were reverted to Firebase imports during Phase 15 testing since Supabase returned "Unsupported phone provider" error.

The Supabase phoneAuthService.ts already exists and works — it just needs a configured SMS provider on the Supabase side.

## Solution

1. **Supabase Dashboard** > Authentication > Providers > Phone — enable it
2. **Configure Twilio** as SMS provider:
   - Sign up at twilio.com (free trial has credits)
   - Get Account SID, Auth Token, and a Twilio phone number
   - Enter all three in Supabase Phone provider settings
3. **Switch screen imports back to Supabase**:
   - `PhoneInputScreen.js`: change import from `firebase/phoneAuthService` to `supabase/phoneAuthService`
   - `VerificationScreen.js`: change import from `firebase/phoneAuthService` to `supabase/phoneAuthService`
   - Revert `verifyCode(confirmationRef.current, code)` back to `verifyCode(e164, code)`
   - Remove `usePhoneAuth` / `confirmationRef` usage (Supabase OTP is stateless)
4. **Revert PhoneAuthContext** back to Supabase-style (e164 only, no confirmationRef)
5. Test end-to-end: send OTP, receive SMS, verify code, login
