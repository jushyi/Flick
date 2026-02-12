# Phase 50: CI/CD Pipeline - Research

**Researched:** 2026-02-12
**Domain:** GitHub Actions CI/CD for Expo/EAS React Native (iOS-only release)
**Confidence:** HIGH

<research_summary>

## Summary

Researched the CI/CD ecosystem for Expo/EAS React Native apps targeting iOS App Store release via GitHub Actions. The standard approach uses three separate GitHub Actions workflows: PR checks (lint/test/export verification), EAS Build (triggered by git tags), and EAS Submit (manual trigger with environment approval gate).

Key finding: Use `npx expo export` for PR verification instead of full EAS builds. This costs $0, catches most JS-level failures, and preserves the free tier's 15 iOS builds/month for actual releases. The `expo/expo-github-action@v8` handles EAS CLI setup and EXPO_TOKEN authentication. EAS managed credentials handle all Apple signing automatically after an initial interactive local build.

Critical discovery: The project's `aps-environment` entitlement is set to `"development"` — this **must** switch to `"production"` for App Store builds. The `app.config.js` dynamic config already in place is the natural location for this switch.

**Primary recommendation:** Three-workflow pipeline (PR checks free, tag-triggered EAS Build, manual-approval EAS Submit) with managed credentials and ASC API Key for automated submission. Run first build locally/interactively to establish credentials before CI.
</research_summary>

<standard_stack>

## Standard Stack

The established tools for Expo CI/CD:

### Core

| Tool                      | Version                  | Purpose                                | Why Standard                                                             |
| ------------------------- | ------------------------ | -------------------------------------- | ------------------------------------------------------------------------ |
| `expo/expo-github-action` | v8                       | GitHub Action for EAS CLI setup + auth | Official Expo action, handles EXPO_TOKEN injection across all steps      |
| `eas-cli`                 | >= 16.28.0 (project min) | Build, submit, credential management   | The CLI for all EAS operations; `--non-interactive` flag required for CI |
| GitHub Actions            | N/A                      | CI/CD orchestration                    | Free for public repos, generous minutes for private repos                |
| GitHub Environments       | N/A                      | Approval gates for submissions         | Required reviewers prevent accidental App Store submissions              |

### Supporting

| Tool                 | Version                 | Purpose                        | When to Use                                             |
| -------------------- | ----------------------- | ------------------------------ | ------------------------------------------------------- |
| `actions/setup-node` | v4                      | Node.js setup with npm caching | Every workflow job — caches `~/.npm` via `cache: npm`   |
| `actions/checkout`   | v4                      | Repo checkout                  | Every workflow job                                      |
| `@expo/fingerprint`  | latest                  | Native runtime hash            | Future optimization — conditional builds vs OTA updates |
| `expo-doctor`        | (bundled with expo-cli) | Dependency/config validation   | Optional PR check for catching config issues            |

### Alternatives Considered

| Instead of                       | Could Use                         | Tradeoff                                                                                                                                     |
| -------------------------------- | --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| GitHub Actions                   | EAS Workflows                     | EAS Workflows are newer (native Expo integration) but less flexible than GitHub Actions; GitHub Actions is more mature and widely documented |
| `expo export` for PR checks      | Full `eas build` on every PR      | Full builds cost credits ($2/iOS build) and take 10-20 min; export is free and takes ~1-2 min                                                |
| GitHub Environments for approval | Separate manual workflow_dispatch | Environments provide proper audit trail and scoped secrets; manual dispatch alone has no approval gate                                       |

### Not Needed

| Tool                  | Why Skip                                                                           |
| --------------------- | ---------------------------------------------------------------------------------- |
| Fastlane              | EAS handles signing/submission natively — Fastlane adds complexity without benefit |
| CodePush / App Center | Deprecated; EAS Update is the Expo-native equivalent                               |
| CircleCI / Bitrise    | GitHub Actions is simpler for this project's needs and free                        |

**Installation:**
No npm packages to install in the app — all tools are installed in CI via GitHub Actions steps.
</standard_stack>

<architecture_patterns>

## Architecture Patterns

### Recommended Workflow Structure

```
.github/
├── workflows/
│   ├── pr-checks.yml        # Lint, test, bundle verification (on PR)
│   ├── eas-build.yml         # EAS Build (on version tag + manual dispatch)
│   └── eas-submit.yml        # EAS Submit (manual dispatch + approval gate)
```

### Pattern 1: Three-Workflow Pipeline

**What:** Separate concerns into three independent workflows with different triggers
**When to use:** Always — this is the standard Expo CI/CD pattern
**How it works:**

```
Feature branch → PR into main
  └── pr-checks.yml runs automatically
      ├── npm ci
      ├── npm run lint
      ├── npm test
      └── npx expo export --platform ios
          (catches JS errors, FREE)

PR merged → main branch
  (no automatic build — builds only on tags)

Ready to release → git tag v1.0.0
  └── eas-build.yml triggers automatically
      ├── Setup EAS CLI + EXPO_TOKEN
      └── eas build --platform ios --profile production --non-interactive --no-wait
          (queues build on EAS servers, costs $2/build)

Build succeeds on EAS → Manual trigger in GitHub UI
  └── eas-submit.yml (workflow_dispatch)
      ├── Approval gate (GitHub Environment required reviewer)
      └── eas submit --platform ios --latest --non-interactive
          (uploads to App Store Connect)
```

### Pattern 2: PR Checks with expo export (Free Verification)

**What:** Use `npx expo export` instead of full EAS builds for PR verification
**When to use:** Every PR — saves build credits
**What it catches:** JS syntax errors, missing imports, Metro bundler config errors, asset resolution failures
**What it misses:** Native compilation errors, code signing issues, native module config problems

```yaml
# PR check step — costs $0, runs in ~1-2 minutes
- name: Verify JS bundle compiles
  run: npx expo export --platform ios
```

### Pattern 3: Manual Dispatch with Input Parameters

**What:** Allow manual triggering of build/submit workflows from GitHub UI
**When to use:** On-demand builds outside the normal release flow
**Example:**

```yaml
on:
  workflow_dispatch:
    inputs:
      platform:
        description: 'Platform to build'
        required: true
        type: choice
        options:
          - ios
      profile:
        description: 'Build profile'
        required: true
        default: 'production'
        type: choice
        options:
          - development
          - preview
          - production
```

### Pattern 4: Environment Approval Gate for Submissions

**What:** GitHub Environment with required reviewers blocks submission until manually approved
**When to use:** Before any App Store submission
**Setup:**

1. Create environment `app-store-production` in repo Settings > Environments
2. Add yourself as required reviewer
3. Reference in workflow job: `environment: app-store-production`

```yaml
jobs:
  submit:
    runs-on: ubuntu-latest
    environment: app-store-production # Pauses until approved
    steps:
      - run: eas submit --platform ios --latest --non-interactive
```

**Important:** Required reviewers for environments on **private repos** require GitHub Pro, Team, or Enterprise. Public repos get this on all plans including Free.

### Anti-Patterns to Avoid

- **Running EAS builds on every PR:** Wastes build credits ($2/iOS build) and slows down PR feedback
- **Using `--auto-submit` on tag builds:** Removes the human approval gate — always keep submission gated
- **Hardcoding credentials in workflow files:** Use GitHub Secrets for all tokens and keys
- **Using `npm install` in CI:** Always use `npm ci` — it's faster, deterministic, and respects the lockfile exactly
- **Forgetting `--non-interactive` flag:** CI will hang waiting for prompts without this flag
- **Skipping the initial local build:** Managed credentials require one interactive `eas build` run to set up Apple signing. CI builds will fail until this is done.
  </architecture_patterns>

<dont_hand_roll>

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem                     | Don't Build                                    | Use Instead                                                               | Why                                                                                                                                                                           |
| --------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Apple code signing          | Manual certificate/profile management          | EAS managed credentials                                                   | EAS auto-generates and renews distribution certificates, provisioning profiles, and push keys. Manual management is error-prone and requires Apple Developer portal knowledge |
| Build version numbering     | Manual version bump commits                    | `appVersionSource: "remote"` + `autoIncrement: true` (already configured) | Remote version source means EAS servers track build numbers — no version bump commits needed in CI                                                                            |
| CI authentication           | Login commands in workflows                    | `EXPO_TOKEN` env var + `expo/expo-github-action@v8`                       | Token auth is stateless, secure, and doesn't require interactive login                                                                                                        |
| Build orchestration         | Custom scripts to call xcodebuild/gradle       | `eas build`                                                               | EAS handles the entire native build pipeline on their servers — setting up Xcode/Gradle locally would be enormously complex                                                   |
| App Store upload            | Application Loader / altool / manual upload    | `eas submit`                                                              | EAS Submit handles binary upload, ASC API auth, and processing wait                                                                                                           |
| Conditional build detection | Custom scripts to compare package.json changes | `@expo/fingerprint`                                                       | Fingerprint hashes the entire native runtime state — far more reliable than manual file comparison                                                                            |

**Key insight:** The entire native build/sign/submit pipeline is solved by EAS. The CI/CD pipeline's only job is orchestration: when to trigger builds, when to approve submissions, and how to gate quality. Don't try to replicate what EAS does on your own CI runners.
</dont_hand_roll>

<common_pitfalls>

## Common Pitfalls

### Pitfall 1: Skipping the Initial Interactive Build

**What goes wrong:** CI builds fail with credential errors — "no distribution certificate found"
**Why it happens:** EAS managed credentials require one interactive `eas build` run to authenticate with Apple and generate certificates/profiles. This cannot be done in `--non-interactive` mode.
**How to avoid:** Run `eas build --platform ios` locally (interactive) BEFORE setting up CI. This creates and stores credentials on EAS servers.
**Warning signs:** First CI build fails immediately with Apple credential errors.

### Pitfall 2: aps-environment Entitlement Left on "development"

**What goes wrong:** Push notifications don't work in production/TestFlight builds — they hit Apple's sandbox APNs instead of production servers.
**Why it happens:** The project's `app.json` has `"aps-environment": "development"`. Production and TestFlight builds need `"production"`.
**How to avoid:** Use dynamic config in `app.config.js` to switch based on build profile (EAS sets `APP_ENV` or similar env var). The `app.config.js` already exists and handles `GOOGLE_SERVICES_PLIST` dynamically — extend it for `aps-environment`.
**Warning signs:** Push notifications work in dev builds but silently fail in TestFlight/production.

### Pitfall 3: `--latest` Submit Grabs Wrong Build

**What goes wrong:** `eas submit --latest` submits a development or preview build instead of the production build
**Why it happens:** `--latest` picks the most recent successful build for the platform, regardless of profile. If someone triggers a dev build after the production build, `--latest` grabs the dev build.
**How to avoid:** Consider using `--id <build-id>` for precision. Or ensure production builds are always the most recent before submitting. The workflow can extract the build ID from `eas build --json` output and pass it to submit.
**Warning signs:** App Store review rejection due to debug features or development configuration in the binary.

### Pitfall 4: GitHub Environment Approval Requires Paid Plan for Private Repos

**What goes wrong:** The `environment: app-store-production` with required reviewers doesn't actually block — or isn't available to configure.
**Why it happens:** GitHub Free plan only supports environment protection rules (required reviewers) on **public** repositories.
**How to avoid:** If the repo is private, either upgrade to GitHub Pro ($4/mo), make the repo public (if appropriate), or use a separate manual `workflow_dispatch` workflow as the approval gate (less elegant but works on free plan).
**Warning signs:** Submit workflow runs without pausing for approval on a private repo.

### Pitfall 5: Tag-Triggered Workflow Doesn't Fire

**What goes wrong:** Pushing a `v1.0.0` tag doesn't trigger the EAS build workflow.
**Why it happens:** The workflow YAML file must exist on the **default branch** (typically `main`) for tag-push triggers to work. If the workflow was added on a feature branch and a tag is pushed before merging, it won't trigger.
**How to avoid:** Merge all workflow files to `main` before pushing the first version tag.
**Warning signs:** Tag pushed but no workflow run appears in the Actions tab.

### Pitfall 6: Builds Timing Out on Free Tier

**What goes wrong:** EAS build fails with timeout after 45 minutes.
**Why it happens:** Free tier has a 45-minute build timeout. Complex projects with many native modules (like this one with Firebase, camera, etc.) can approach this limit, especially on first build where there's no cache.
**How to avoid:** Monitor first build time. If it's approaching 45 min, consider the Starter plan ($19/mo) for 2-hour timeout, or optimize the build (e.g., ensure only necessary native modules are included).
**Warning signs:** Build progresses normally but gets killed at exactly 45 minutes.
</common_pitfalls>

<code_examples>

## Code Examples

Verified patterns from official Expo docs and GitHub Actions docs:

### PR Checks Workflow

```yaml
# .github/workflows/pr-checks.yml
# Source: https://docs.expo.dev/build/building-on-ci/ + verified patterns
name: PR Checks

on:
  pull_request:
    branches: [main]

jobs:
  quality:
    name: Lint, Test & Verify
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Lint
        run: npm run lint

      - name: Run tests
        run: npm test

      - name: Verify JS bundle compiles
        run: npx expo export --platform ios
```

### EAS Build Workflow (Tag + Manual Dispatch)

```yaml
# .github/workflows/eas-build.yml
# Source: https://docs.expo.dev/build/building-on-ci/ + expo/expo-github-action
name: EAS Build

on:
  push:
    tags:
      - 'v*'
  workflow_dispatch:
    inputs:
      profile:
        description: 'Build profile'
        required: true
        default: 'production'
        type: choice
        options:
          - development
          - preview
          - production

jobs:
  build:
    name: EAS Build (iOS)
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm

      - name: Setup EAS
        uses: expo/expo-github-action@v8
        with:
          eas-version: latest
          token: ${{ secrets.EXPO_TOKEN }}

      - name: Install dependencies
        run: npm ci

      - name: Build (tag trigger)
        if: github.event_name == 'push'
        run: eas build --platform ios --profile production --non-interactive --no-wait

      - name: Build (manual trigger)
        if: github.event_name == 'workflow_dispatch'
        run: eas build --platform ios --profile ${{ inputs.profile }} --non-interactive --no-wait
```

### EAS Submit Workflow (Manual + Approval Gate)

```yaml
# .github/workflows/eas-submit.yml
# Source: https://docs.expo.dev/submit/ios/ + GitHub Environments docs
name: Submit to App Store

on:
  workflow_dispatch:

jobs:
  submit:
    name: Submit to App Store
    runs-on: ubuntu-latest
    environment: app-store-production # Requires reviewer approval
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm

      - name: Setup EAS
        uses: expo/expo-github-action@v8
        with:
          eas-version: latest
          token: ${{ secrets.EXPO_TOKEN }}

      - name: Install dependencies
        run: npm ci

      - name: Submit iOS
        run: eas submit --platform ios --profile production --latest --non-interactive
```

### ASC API Key Decoding in CI (if using eas.json reference)

```yaml
# Decode base64-encoded .p8 key from GitHub Secret
- name: Decode ASC API Key
  run: |
    mkdir -p ./keys
    echo "${{ secrets.ASC_API_KEY_BASE64 }}" | base64 --decode > ./keys/AuthKey.p8
```

### Dynamic aps-environment in app.config.js

```javascript
// app.config.js — extend existing config for production push notifications
const baseConfig = require('./app.json');

module.exports = () => {
  const isProduction = process.env.APP_ENV === 'production';

  return {
    ...baseConfig.expo,
    ios: {
      ...baseConfig.expo.ios,
      googleServicesFile: process.env.GOOGLE_SERVICES_PLIST ?? './GoogleService-Info.plist',
      entitlements: {
        ...baseConfig.expo.ios.entitlements,
        'aps-environment': isProduction ? 'production' : 'development',
      },
    },
  };
};
```

With corresponding `eas.json` env var:

```json
{
  "build": {
    "production": {
      "autoIncrement": true,
      "env": {
        "APP_ENV": "production"
      },
      "ios": {
        "image": "latest"
      }
    }
  }
}
```

</code_examples>

<sota_updates>

## State of the Art (2025-2026)

What's changed recently:

| Old Approach                          | Current Approach                               | When Changed            | Impact                                                          |
| ------------------------------------- | ---------------------------------------------- | ----------------------- | --------------------------------------------------------------- |
| `expo build` (classic)                | `eas build`                                    | Fully deprecated 2023   | `expo build` no longer works; EAS Build is the only path        |
| Manual Xcode signing                  | EAS managed credentials                        | Standard since 2022     | No need to manually manage certs/profiles                       |
| `expo publish` (classic updates)      | EAS Update                                     | 2023                    | OTA updates now use EAS Update with runtime version matching    |
| Separate CI tools (CircleCI, Bitrise) | GitHub Actions + `expo-github-action@v8`       | 2024+                   | GitHub Actions is now the dominant CI choice for Expo apps      |
| Per-minute build pricing              | Flat per-build pricing                         | 2024                    | iOS builds are flat $2/medium, $4/large — no per-minute charges |
| Manual version bumps                  | `appVersionSource: "remote"` + `autoIncrement` | 2023+                   | Build numbers managed by EAS servers, no commit-back needed     |
| Full EAS build for CI checks          | `expo export` + `expo-doctor`                  | Community pattern 2024+ | Free JS verification without consuming build credits            |

**New tools/patterns to consider:**

- **EAS Workflows:** Expo's own CI/CD system (alternative to GitHub Actions). Defined in `.eas/workflows/*.yml`. Still newer and less documented than GitHub Actions, but tightly integrated with Expo ecosystem. Worth monitoring but not adopting yet.
- **`@expo/fingerprint`:** Hashes the native runtime state. Enables conditional builds — only rebuild when native code changes, use EAS Update for JS-only changes. Reported 40-78% CI build time reduction. Good future optimization but not essential for initial pipeline.
- **Fast-fail waiver (May 2024):** Builds that fail within 3 minutes don't count against free tier quota (up to 10/month). Reduces risk of wasting credits on configuration errors.

**Deprecated/outdated:**

- **`expo build:ios`/`expo build:android`:** Fully removed. Use `eas build`.
- **`expo publish`:** Replaced by `eas update`.
- **CodePush / App Center:** Deprecated by Microsoft. Use EAS Update.
- **Application Loader / `altool`:** Replaced by `eas submit` for Expo apps.
  </sota_updates>

<open_questions>

## Open Questions

Things that couldn't be fully resolved:

1. **GitHub plan level for the repo**
   - What we know: Environment approval gates (required reviewers) for private repos require GitHub Pro ($4/mo), Team, or Enterprise. Public repos get this free.
   - What's unclear: Whether this repo is public or private, and whether the user has GitHub Pro.
   - Recommendation: Plan should check repo visibility. If private + free plan, either upgrade to Pro or use a manual `workflow_dispatch` pattern as the approval gate (functional but less elegant). Alternatively, the user could make the repo public.

2. **First EAS build for this project**
   - What we know: Managed credentials require an initial interactive build. The project has `eas.json` configured but may not have run `eas build` yet.
   - What's unclear: Whether the user has previously run `eas build --platform ios` and already has credentials stored on EAS servers.
   - Recommendation: Plan should include a step to verify or establish credentials via local interactive build before setting up CI. This is a prerequisite.

3. **Free tier build timeout adequacy**
   - What we know: Free tier has 45-minute timeout. This project has Firebase, camera, image processing, and multiple native modules.
   - What's unclear: Actual build time for this project on EAS.
   - Recommendation: Monitor the first build time. If approaching 45 min, consider Starter plan ($19/mo) for 2-hour timeout. First builds are always slower (no cache).

4. **EAS Submit credential configuration approach**
   - What we know: Two approaches exist — (A) configure ASC API Key via `eas credentials` CLI (stored on EAS servers), or (B) configure in `eas.json` + write .p8 from CI secret.
   - What's unclear: Which approach is simpler for this user's setup.
   - Recommendation: Approach A (via `eas credentials`) is simpler — credentials stored on EAS servers, no .p8 file management in CI. Plan should use this approach.
     </open_questions>

<sources>
## Sources

### Primary (HIGH confidence)

- [EAS Build Introduction](https://docs.expo.dev/build/introduction/) — build profiles, CLI flags
- [Configure EAS Build with eas.json](https://docs.expo.dev/build/eas-json/) — complete schema reference
- [Trigger Builds from CI](https://docs.expo.dev/build/building-on-ci/) — CI workflow patterns, EXPO_TOKEN
- [EAS Submit Introduction](https://docs.expo.dev/submit/introduction/) — submit config, ASC API Key
- [Submit to Apple App Store](https://docs.expo.dev/submit/ios/) — iOS-specific submission
- [Managed Credentials](https://docs.expo.dev/app-signing/managed-credentials/) — auto-generated signing
- [Programmatic Access](https://docs.expo.dev/accounts/programmatic-access/) — EXPO_TOKEN creation
- [Expo CLI Reference (export command)](https://docs.expo.dev/more/expo-cli/) — export flags/behavior
- [Usage-Based Pricing](https://docs.expo.dev/billing/usage-based-pricing/) — per-build costs
- [Expo Pricing Page](https://expo.dev/pricing) — tier limits and features
- [expo/expo-github-action (GitHub)](https://github.com/expo/expo-github-action) — v8 setup
- [GitHub Environments for Deployment](https://docs.github.com/en/actions/deployment/targeting-different-environments/using-environments-for-deployment) — approval gates
- [GitHub Actions Events Reference](https://docs.github.com/en/actions/learn-github-actions/events-that-trigger-workflows) — workflow_dispatch, push tags

### Secondary (MEDIUM confidence)

- [Build Server Infrastructure](https://docs.expo.dev/build-reference/infrastructure/) — build images, Xcode versions
- [App Version Management](https://docs.expo.dev/build-reference/app-versions/) — remote version source, autoIncrement
- [EAS Fingerprint](https://docs.expo.dev/versions/latest/sdk/fingerprint/) — conditional build optimization
- [Apple Developer Certificates](https://developer.apple.com/support/certificates/) — cert limits, expiry behavior
- [Creating ASC API Key (Expo FYI)](https://github.com/expo/fyi/blob/main/creating-asc-api-key.md) — step-by-step ASC setup

### Tertiary (LOW confidence - needs validation)

- Free tier build timeout behavior for projects with many native modules (Firebase, camera, etc.) — not confirmed with actual build data for this specific project. Monitor on first build.
  </sources>

<metadata>
## Metadata

**Research scope:**

- Core technology: EAS Build, EAS Submit, GitHub Actions
- Ecosystem: expo-github-action@v8, GitHub Environments, ASC API Keys, managed credentials
- Patterns: Three-workflow pipeline, expo export for free PR verification, approval gates
- Pitfalls: Initial interactive build, aps-environment switch, free tier limits, tag trigger timing

**Confidence breakdown:**

- Standard stack: HIGH — all tools from official Expo documentation
- Architecture: HIGH — workflow patterns verified against Expo CI docs and GitHub Actions docs
- Pitfalls: HIGH — documented in official troubleshooting guides and community patterns
- Code examples: HIGH — adapted from official Expo CI docs with project-specific configuration
- Pricing: MEDIUM — verified from pricing page but Expo adjusts pricing periodically

**Research date:** 2026-02-12
**Valid until:** 2026-03-14 (30 days — EAS ecosystem is stable, pricing may shift)
</metadata>

---

_Phase: 50-cicd-pipeline_
_Research completed: 2026-02-12_
_Ready for planning: yes_
