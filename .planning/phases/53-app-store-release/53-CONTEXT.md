# Phase 53: App Store Release - Context

**Gathered:** 2026-02-12
**Updated:** 2026-02-13
**Status:** Ready for research

<vision>
## How This Should Work

**Start with a pre-flight audit** — Before building or submitting anything, walk through a checklist to verify everything is ready. We've made changes to the app, installed new packages, updated configurations. The audit catches any breaking changes or missing pieces that could block submission or cause rejection. Check three areas: production environment setup (Firebase, OAuth, API keys), App Store requirements (certificates, profiles, privacy manifests), and dependencies (new packages configured correctly, everything builds). This isn't code review or functional testing (UAT already covered that) — just configuration verification to avoid "oh we forgot X" surprises.

**Then proceed with the release** — Public App Store release, not unlisted, not promoted. Flick goes live on the App Store as a real, findable app, but there's no marketing push. The initial users come from direct sharing — texting the App Store link to a small group of friends and family.

The App Store listing should look polished and legit. Clean, minimal presence that matches the app's dark aesthetic. Even if only a handful of people see it at first, it should feel like a real product, not a side project. Simple description, dark screenshots, let the app speak for itself.

The first experience for someone who downloads it should be simple and welcoming — easy sign-up, friendly onboarding, get them taking photos fast. Don't overwhelm.

After the initial release passes review, verify the full CI/CD pipeline works by pushing a follow-up update through the entire build-submit cycle. This proves the release process is repeatable. Then document a walkthrough for how future release updates work — a playbook so future releases are just "follow the steps."

</vision>

<essential>
## What Must Be Nailed

- **Pre-flight audit catches breaking changes** — Before starting the release, verify all configuration and dependencies are correct. Catch any issues from recent app changes or new packages that could block submission or cause rejection. Three areas: production environment (Firebase, keys), App Store requirements (certs, profiles), dependencies (packages, builds). No surprises when we hit submit.
- **Clean App Store presence** — The listing looks professional and polished. Good screenshots, minimal description, icon matches the app's vibe. First impression matters even for a quiet launch.
- **Pass App Review on first try** — Pre-check against Apple's common rejection reasons before submitting. Cover all the bases (privacy policy, content guidelines, etc.). First-time submission, want to minimize risk.
- **Pipeline verification** — After the initial release, push a follow-up update through the full CI/CD pipeline to prove it works end-to-end. This isn't optional — the pipeline must be proven before the phase is "done."
- **Future release playbook** — Document the release process so future updates are just following a walkthrough. No tribal knowledge.

</essential>

<boundaries>
## What's Out of Scope

- **Audit excludes code review and functional testing** — Not reviewing code quality or re-testing features (Phase 52 UAT covered that). Just verifying configuration and environment setup.
- No marketing materials — no landing page, social media, or promotional content. Just the App Store listing itself.
- No Android release — iOS only for this phase.
- No TestFlight distribution — sharing is direct App Store link via text/DM.
- No analytics or monitoring setup — that's a separate concern.

</boundaries>

<specifics>
## Specific Ideas

- **Pre-flight audit checklist** covering:
  - Production environment: Firebase production project config, environment variables, OAuth credentials, API keys
  - App Store requirements: Certificates, provisioning profiles, bundle ID, privacy manifests, app capabilities
  - Dependencies & packages: New packages configured, native modules linked, clean builds
- Clean and minimal App Store listing — dark screenshots that match the app's aesthetic, simple description
- Direct App Store link sharing via text/DM to a small group of friends and family
- Pre-submission checklist against Apple's review guidelines to catch issues before they cause rejection
- Post-release pipeline test: push a real update through EAS Build + Submit to verify CI/CD works
- Written walkthrough/playbook for future release updates

</specifics>

<notes>
## Additional Context

User is a first-time App Store submitter — a bit nervous about the review process. Wants a belt-and-suspenders approach: pre-check to minimize rejection risk, but ready to iterate quickly if something comes back. The mindset is "fix and resubmit fast" if needed.

This is the final phase of v1.0.0. The app has been through 52 phases of development, 138+ plans, and extensive UAT. The goal is to get it into real users' hands with confidence that the release process is repeatable.

**Audit added 2026-02-13:** Between Phase 52 and 53, there have been app changes, new packages installed, and configuration updates. The audit is a risk mitigation step to catch any breaking changes or misconfigurations before submission. It's purely about verifying setup — not code quality or feature testing (UAT covered that).

Note: Originally planned as an unlisted release, but the user decided on a public release instead — just without actively marketing it.

</notes>

---

_Phase: 53-app-store-release_
_Context gathered: 2026-02-12_
