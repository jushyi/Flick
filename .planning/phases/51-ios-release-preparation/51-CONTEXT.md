# Phase 51: iOS Release Preparation - Context

**Gathered:** 2026-02-12
**Status:** Ready for research

<vision>
## How This Should Work

This phase transforms the app from a development project into a real, launchable product called **Flick**. It's not just App Store mechanics — it's the full transition to production identity and infrastructure.

**Rebrand to Flick:** The app sheds its "Rewind" identity and becomes "Flick." Every instance of the old name gets replaced — in-app text, splash screen (same animation, just "Flick" instead of "Rewind"), and a new app icon featuring a film strip with a retro-styled "F." The current dark aesthetic stays intact — this is a name and identity change, not a redesign of styles or animations.

**Production Environment:** A completely separate Firebase project for production, isolated from the dev environment. Production starts fresh with a clean database — no migrated dev data. EAS build profiles handle environment switching: dev builds connect to dev Firebase, production builds connect to prod Firebase. Same codebase, different targets.

**Contributions Page:** A new section in Settings where users can support the app. Opens with a heartfelt, personal pitch about helping keep the app running — warm, not corporate. Below that, IAP tier buttons ($0.99, $2.99, $4.99, $9.99) all unlocking the same perk: a custom name color. After purchase, a color picker appears right on the contributions page. The color is also changeable later from Edit Profile. Contributors' names show in their chosen color everywhere — a subtle, visible mark that sets them apart from the default white usernames.

**Domain & Support:** Register a proper domain for Flick. Set up a support email (e.g., support@[domain]) and update the in-app support/help page with real contact info and links.

**Report Routing:** Reports keep the same UI but get emailed to the support address automatically with a report flag in the subject line, instead of only being stored in Firebase. This way reports actually get seen.

**Giphy Production Key:** The app already uses Giphy with a dev key. This phase switches to a production key and adds whatever attribution/requirements Giphy mandates for production apps.

**Polished App Store Listing:** A proper storefront — not just the bare minimum. Device-framed screenshots with captions that tell the core story (Camera capture → Darkroom developing → Feed reveal → Comments/reactions). Category: Photo & Video (primary), Social Networking (secondary). Tagline: "The disposable camera for your friend group." Privacy policy and ToS already exist — just need linking. Distribution certificate and provisioning profile finalized.

</vision>

<essential>
## What Must Be Nailed

- **Rebrand completeness** — Every trace of "Rewind" replaced with "Flick." New icon, updated splash, all in-app references. No half-measures.
- **Production Firebase isolation** — Separate project, clean data, proper EAS build profile switching. Dev never touches prod.
- **Contributions with color perk** — IAP tiers that work, color picker that unlocks, colored names that display everywhere. The full loop.
- **App Store readiness** — Polished listing that passes App Review. Screenshots, metadata, certificates, provisioning — all done.
- **Domain & support infrastructure** — Real support email, updated help pages, report routing to email.
- **Giphy production compliance** — Production key active with all required attribution.

</essential>

<boundaries>
## What's Out of Scope

- No subscriptions — contributions are one-time IAP only. Monthly subscriptions and tiered perks are future work.
- No Android — iOS only for this release. Play Store and Android builds are deferred.
- No style/animation redesign — the rebrand changes names, icon, and splash text only. Current dark aesthetic and animations stay as-is.
- No advanced contributor perks beyond name color — effects, badges, etc. come later with subscriptions.

</boundaries>

<specifics>
## Specific Ideas

- **App icon:** Film strip with a retro-looking "F" inside it. Dark aesthetic maintained.
- **Splash screen:** Same existing animation, just replace "Rewind" text with "Flick."
- **Contributions page layout:** Heartfelt personal pitch at top → IAP tier buttons below → Color picker appears after purchase.
- **Color picker location:** Shown immediately after purchase on contributions page. Also accessible from Edit Profile for changes.
- **Name color display:** Contributors' names show in their chosen color app-wide, replacing the default white.
- **Screenshots:** Device frames with captions telling the core flow story — Camera → Darkroom → Feed → Comments/reactions.
- **App Store categories:** Primary: Photo & Video. Secondary: Social Networking.
- **Tagline:** "The disposable camera for your friend group."
- **Reports:** Same report UI, but reports auto-email to support address with report flag in subject.
- **Environment management:** EAS build profiles for deterministic dev/prod Firebase switching.

</specifics>

<notes>
## Additional Context

This is a large phase with many plans. The user acknowledged it will have a lot of plans and sees all pieces as equally critical — rebrand, production environment, contributions, App Store listing, domain, Giphy, and report routing all carry equal weight.

Future plans include subscriptions with enhanced perks for higher-tier/monthly contributors, building on the IAP foundation laid here.

The domain choice is still TBD — the user wants help exploring and choosing the right domain for Flick.

</notes>

---

_Phase: 51-ios-release-preparation_
_Context gathered: 2026-02-12_
