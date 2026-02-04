# Phase 24: Social Media Feature Audit - Research

**Researched:** 2026-02-04
**Domain:** Social media app feature completeness
**Confidence:** HIGH

<research_summary>

## Summary

Researched standard social media app features across major platforms (Instagram, BeReal, Lapse, Snapchat) and industry best practices for 2025-2026. This app is a photo-sharing social platform with unique features like disposable camera mechanics, photo "selects" banners, profile songs, and monthly album organization.

The research synthesizes feature expectations from competitive analysis and web sources into a comprehensive audit checklist organized by user importance tiers. Modern social apps in 2026 emphasize authenticity, close friends, and simpler feeds over algorithms - patterns this app already follows.

**Primary recommendation:** Use the Feature Audit Checklist below during planning to systematically verify each feature's presence, then group missing features into 3-5 new roadmap phases by logical domain.
</research_summary>

<feature_audit_framework>

## Feature Audit Framework

### Tier 1: Critical (Users Notice Immediately If Missing)

Features every social app must have - users will feel the app is "incomplete" without these.

### Tier 2: Expected (Standard Features)

Features users expect from a mature social app - absence creates friction but isn't a dealbreaker.

### Tier 3: Nice-to-Have (Polish Features)

Features that enhance experience but aren't essential for a functional social app.

### Tier 4: Advanced (Differentiation Features)

Complex features that established apps have but aren't expected in newer/niche apps.
</feature_audit_framework>

<audit_checklist>

## Feature Audit Checklist

### AUTHENTICATION & ACCOUNT

| Feature                       | Tier | Description                         | Check |
| ----------------------------- | ---- | ----------------------------------- | ----- |
| Phone/Email signup            | T1   | Account creation via phone or email | [ ]   |
| Phone verification            | T1   | OTP/SMS verification                | [ ]   |
| Password reset                | T2   | Ability to recover account          | [ ]   |
| Social login                  | T3   | Sign in with Google/Apple/Facebook  | [ ]   |
| Account deletion              | T1   | GDPR-compliant account removal      | [ ]   |
| Account recovery grace period | T2   | Time window to undo deletion        | [ ]   |
| Two-factor authentication     | T3   | Extra security layer                | [ ]   |
| Session management            | T3   | View/revoke active sessions         | [ ]   |

### USER PROFILE

| Feature                          | Tier | Description                          | Check |
| -------------------------------- | ---- | ------------------------------------ | ----- |
| Profile photo                    | T1   | Display and change profile picture   | [ ]   |
| Username                         | T1   | Unique identifier handle             | [ ]   |
| Display name                     | T1   | Customizable name                    | [ ]   |
| Bio/about                        | T2   | Short description text               | [ ]   |
| Edit profile                     | T1   | Update profile information           | [ ]   |
| View other profiles              | T1   | See other users' profiles            | [ ]   |
| Profile privacy (public/private) | T2   | Control who sees your profile        | [ ]   |
| Username change restriction      | T3   | Cooldown period for username changes | [ ]   |
| Profile link sharing             | T3   | Share profile via URL/deep link      | [ ]   |

### FRIENDS & SOCIAL CONNECTIONS

| Feature                 | Tier | Description                      | Check |
| ----------------------- | ---- | -------------------------------- | ----- |
| Send friend request     | T1   | Request to connect with users    | [ ]   |
| Accept/decline requests | T1   | Manage incoming requests         | [ ]   |
| Friends list            | T1   | View all friends                 | [ ]   |
| Remove friend           | T1   | End friendship                   | [ ]   |
| Search users            | T1   | Find users by username/name      | [ ]   |
| Friend suggestions      | T2   | Recommend potential friends      | [ ]   |
| Contact sync            | T2   | Find friends from phone contacts | [ ]   |
| Mutual friends display  | T3   | Show shared connections          | [ ]   |
| Friend count display    | T2   | Show number of friends           | [ ]   |
| Follow/following model  | T3   | Alternative to mutual friendship | [ ]   |

### BLOCKING & SAFETY

| Feature            | Tier | Description                             | Check |
| ------------------ | ---- | --------------------------------------- | ----- |
| Block user         | T1   | Prevent user from seeing/contacting you | [ ]   |
| Unblock user       | T1   | Reverse a block                         | [ ]   |
| Report user        | T1   | Report inappropriate behavior           | [ ]   |
| Report reasons     | T2   | Categorized report options              | [ ]   |
| Blocked users list | T2   | View/manage blocks                      | [ ]   |
| Mute user          | T3   | Hide content without blocking           | [ ]   |
| Restrict account   | T3   | Limit interactions without blocking     | [ ]   |

### CONTENT CREATION & POSTING

| Feature                | Tier | Description               | Check |
| ---------------------- | ---- | ------------------------- | ----- |
| Take photo             | T1   | Capture photos in-app     | [ ]   |
| Photo from gallery     | T2   | Upload existing photos    | [ ]   |
| Photo filters/editing  | T2   | Basic photo editing tools | [ ]   |
| Caption/text with post | T2   | Add text to posts         | [ ]   |
| Location tagging       | T3   | Add location to posts     | [ ]   |
| Tag users in posts     | T3   | Mention users in content  | [ ]   |
| Video capture          | T3   | Record videos             | [ ]   |
| Video editing          | T4   | Trim/edit videos          | [ ]   |
| Multi-photo posts      | T3   | Multiple images per post  | [ ]   |
| Drafts                 | T3   | Save posts for later      | [ ]   |

### CONTENT VIEWING & FEED

| Feature                      | Tier | Description                      | Check |
| ---------------------------- | ---- | -------------------------------- | ----- |
| Main feed                    | T1   | Stream of friends' content       | [ ]   |
| View individual photos       | T1   | Full-screen photo viewing        | [ ]   |
| Swipe navigation             | T2   | Navigate between photos          | [ ]   |
| Pull to refresh              | T1   | Update feed content              | [ ]   |
| Feed loading states          | T2   | Skeleton/loading indicators      | [ ]   |
| Empty state messaging        | T2   | Guidance when feed is empty      | [ ]   |
| Content visibility duration  | T2   | Expiring content (stories-style) | [ ]   |
| Chronological vs algorithmic | T3   | Feed ordering options            | [ ]   |

### STORIES FEATURE

| Feature                  | Tier | Description                     | Check |
| ------------------------ | ---- | ------------------------------- | ----- |
| Stories bar              | T2   | Horizontal row of stories       | [ ]   |
| View friends' stories    | T2   | See others' ephemeral content   | [ ]   |
| Own stories display      | T2   | See your own stories            | [ ]   |
| Story viewed indicator   | T2   | Know when story was viewed      | [ ]   |
| Story expiration         | T2   | Auto-removal after time period  | [ ]   |
| Story progress indicator | T3   | Visual progress through stories | [ ]   |
| Tap to advance           | T2   | Navigate through stories        | [ ]   |

### REACTIONS & ENGAGEMENT

| Feature             | Tier | Description                   | Check |
| ------------------- | ---- | ----------------------------- | ----- |
| React to posts      | T1   | Express reaction to content   | [ ]   |
| Emoji reactions     | T2   | Use emojis as reactions       | [ ]   |
| View reactions      | T2   | See who reacted               | [ ]   |
| Remove own reaction | T2   | Undo a reaction               | [ ]   |
| Reaction animations | T3   | Visual feedback for reactions | [ ]   |
| Custom emoji picker | T3   | Choose from full emoji set    | [ ]   |

### COMMENTS

| Feature               | Tier | Description                   | Check |
| --------------------- | ---- | ----------------------------- | ----- |
| Add comments          | T1   | Comment on posts              | [ ]   |
| View comments         | T1   | See comments on posts         | [ ]   |
| Delete own comments   | T1   | Remove your comments          | [ ]   |
| Reply to comments     | T2   | Threaded conversations        | [ ]   |
| @mentions in comments | T2   | Tag users in comments         | [ ]   |
| Comment notifications | T2   | Alert when someone comments   | [ ]   |
| GIF in comments       | T3   | Send GIFs in comments         | [ ]   |
| Comment likes         | T3   | Like individual comments      | [ ]   |
| Comment moderation    | T3   | Delete comments on your posts | [ ]   |

### ALBUMS & ORGANIZATION

| Feature                   | Tier | Description                   | Check |
| ------------------------- | ---- | ----------------------------- | ----- |
| Create albums             | T2   | Group photos into collections | [ ]   |
| View albums               | T2   | Browse photo collections      | [ ]   |
| Edit albums               | T2   | Rename, reorder, delete       | [ ]   |
| Album covers              | T2   | Thumbnail for album           | [ ]   |
| Add photos to albums      | T2   | Organize existing photos      | [ ]   |
| Remove photos from albums | T2   | Take photos out of album      | [ ]   |
| Auto-generated albums     | T3   | Monthly/yearly organization   | [ ]   |
| Share albums              | T4   | Let others view albums        | [ ]   |

### NOTIFICATIONS

| Feature                      | Tier | Description                     | Check |
| ---------------------------- | ---- | ------------------------------- | ----- |
| Push notifications           | T1   | Alert for important events      | [ ]   |
| In-app notification feed     | T2   | Activity stream in app          | [ ]   |
| Friend request notifications | T1   | Alert for new requests          | [ ]   |
| Comment notifications        | T2   | Alert when someone comments     | [ ]   |
| Reaction notifications       | T2   | Alert when someone reacts       | [ ]   |
| Notification settings        | T2   | Control which alerts to receive | [ ]   |
| Notification badges          | T2   | Unread count on app icon        | [ ]   |
| Clear notifications          | T3   | Mark as read / dismiss          | [ ]   |

### PHOTO MANAGEMENT

| Feature                    | Tier | Description                          | Check |
| -------------------------- | ---- | ------------------------------------ | ----- |
| Delete photos              | T1   | Remove your photos                   | [ ]   |
| Archive photos             | T2   | Hide without deleting                | [ ]   |
| Download photos            | T2   | Save to device gallery               | [ ]   |
| Set photo as cover         | T2   | Feature photo on album/profile       | [ ]   |
| Cascade deletion           | T2   | Remove associated comments/reactions | [ ]   |
| Photo details (date, time) | T3   | View metadata                        | [ ]   |

### SETTINGS

| Feature                  | Tier | Description              | Check |
| ------------------------ | ---- | ------------------------ | ----- |
| Settings screen          | T1   | Access to app settings   | [ ]   |
| Account settings         | T2   | Manage account details   | [ ]   |
| Privacy settings         | T2   | Control privacy options  | [ ]   |
| Notification preferences | T2   | Configure alerts         | [ ]   |
| Help/Support link        | T2   | Access help resources    | [ ]   |
| Terms of Service         | T1   | Legal terms display      | [ ]   |
| Privacy Policy           | T1   | Privacy policy display   | [ ]   |
| App version info         | T3   | Display current version  | [ ]   |
| Log out                  | T1   | Sign out of account      | [ ]   |
| Clear cache              | T3   | Free up storage          | [ ]   |
| Theme/appearance         | T3   | Dark mode, color options | [ ]   |

### MESSAGING (if applicable)

| Feature               | Tier | Description                | Check |
| --------------------- | ---- | -------------------------- | ----- |
| Direct messages       | T3   | Private 1:1 messaging      | [ ]   |
| Message notifications | T3   | Alerts for new messages    | [ ]   |
| Read receipts         | T4   | Know when message was read | [ ]   |
| Group messaging       | T4   | Multi-person chats         | [ ]   |
| Photo sharing in chat | T4   | Send images in messages    | [ ]   |

### SEARCH & DISCOVERY

| Feature               | Tier | Description                  | Check |
| --------------------- | ---- | ---------------------------- | ----- |
| Search users          | T1   | Find people by name/username | [ ]   |
| Search within friends | T2   | Filter friends list          | [ ]   |
| Explore/discover      | T3   | Find new content/people      | [ ]   |
| Trending content      | T4   | Popular posts/topics         | [ ]   |
| Hashtag support       | T4   | Tag and search by hashtag    | [ ]   |

</audit_checklist>

<known_app_features>

## Known App Features (From Codebase)

Based on codebase exploration, this app currently has:

### Confirmed Present

- Phone-based authentication with OTP verification
- Profile with photo, username, display name, bio
- Profile setup onboarding flow
- Profile song with iTunes integration
- "Selects" banner (curated photo showcase)
- Friends system (requests, accept/decline, remove)
- Contact sync for friend suggestions
- Block user functionality
- Report user functionality
- Camera with photo capture
- Photo editing (darkroom)
- Main feed with friend filtering
- Photo detail view
- Emoji reactions on photos
- Comments with @mentions
- Comment replies (flat threading)
- GIF picker for comments
- Stories bar with viewed tracking
- User albums (create, view, edit)
- Monthly auto-generated albums
- Push notifications
- Activity/notification feed
- Settings screen
- Account deletion with 30-day grace period
- Privacy policy & Terms of Service
- Theme system (color constants)
- Content visibility duration (stories: 7 days, feed: 1 day)
- Download all photos feature

### Likely Missing (Verify During Audit)

- Edit profile screen (separate from setup)
- Photo deletion/archive (Phase 23 planned)
- Mute user functionality
- Blocked users list management
- Profile privacy toggle (public/private)
- Profile link sharing
- Mutual friends display
- Photo tagging
- Location tagging
- Notification settings granularity
- Direct messaging
- Clear cache option
- Session management
  </known_app_features>

<audit_approach>

## Audit Approach for Planning

### Step 1: Systematic Verification

Go through each feature in the checklist:

- **Present**: Mark with checkmark, note implementation location
- **Missing**: Mark as missing, note priority tier
- **Partial**: Mark with notes on what's incomplete

### Step 2: Priority Grouping

Group missing features by tier:

- **T1 Missing** = Critical gaps (must fix immediately)
- **T2 Missing** = Expected features to add
- **T3/T4 Missing** = Backlog / nice-to-have

### Step 3: Phase Generation

Create new roadmap phases by grouping related missing features:

- **Logical domains**: Group by feature area (profile, social, content, etc.)
- **Dependency order**: Features that depend on each other
- **Effort estimation**: Small features can combine, large features standalone

### Expected Output

Based on context, expect to generate 3-5 new phases:

- Most T1/T2 features appear to be present
- New phases likely around: edit profile (Phase 22 planned), photo deletion (Phase 23 planned), and a few missing T2/T3 features
  </audit_approach>

<common_pitfalls>

## Common Pitfalls in Feature Audits

### Pitfall 1: Scope Creep

**What goes wrong:** Audit turns into detailed UX review instead of feature existence check
**Why it happens:** Getting deep into "how well" instead of "does it exist"
**How to avoid:** Stay surface level - YES/NO only, save quality assessment for later
**Warning signs:** Spending more than 30 seconds per feature

### Pitfall 2: Missing Context

**What goes wrong:** Marking features as missing when they exist in different form
**Why it happens:** Not understanding app's unique approach
**How to avoid:** Check codebase for alternative implementations
**Warning signs:** Many T1 features showing as "missing"

### Pitfall 3: Over-Planning

**What goes wrong:** Creating too many phases for minor features
**Why it happens:** Treating every missing feature as its own phase
**How to avoid:** Group related features, combine small items
**Warning signs:** More than 5 new phases generated

### Pitfall 4: Ignoring App Identity

**What goes wrong:** Expecting features that don't fit app's purpose
**Why it happens:** Comparing to different type of social app
**How to avoid:** Remember this is a photo-focused "close friends" app, not Instagram
**Warning signs:** Adding features like Explore page, hashtags, public discovery
</common_pitfalls>

<sources>
## Sources

### Primary (HIGH confidence)

- Codebase exploration (screens, services, components inventory)
- CONTEXT.md from discuss-phase session
- ROADMAP.md completed phases review

### Secondary (MEDIUM confidence)

- [Fullestop - Must-Have Features Of Social Networking Apps](https://www.fullestop.com/blog/features-every-social-networking-apps-must-have) - Core feature list
- [Techstack - How to Make a Social Media App 2026](https://tech-stack.com/blog/how-to-make-a-social-media-app-complete-guide-for-2025/) - Feature checklist
- [Core Devs - Top 15 Features of Social Media](https://coredevsltd.com/articles/features-of-social-media/) - Feature categories
- [Koombea - 10 Top Features of Social Media Apps](https://www.koombea.com/blog/10-top-features-of-social-media-apps/) - Essential features

### Tertiary (Contextual)

- [Time - How Lapse Is Trying to Become the Anti-Instagram](https://time.com/6334440/lapse-photo-app-instagram/) - Lapse app philosophy
- [StackInfluence - Why BeReal's Photo App Matters](https://stackinfluence.com/what-is-bereal-why-gen-zs-photo-app-matters/) - Authenticity trend
- [SocialRails - Social Media Privacy Settings Guide](https://socialrails.com/blog/social-media-privacy-settings) - Privacy features
  </sources>

<metadata>
## Metadata

**Research scope:**

- Core technology: React Native + Firebase social app
- Ecosystem: Photo sharing, friend connections, stories-style content
- Patterns: Modern "close friends" social apps (Lapse, BeReal style)
- Pitfalls: Scope creep, over-planning, ignoring app identity

**Confidence breakdown:**

- Feature checklist: HIGH - synthesized from multiple industry sources
- Known app features: HIGH - verified via codebase exploration
- Audit approach: HIGH - matches CONTEXT.md requirements
- Pitfalls: MEDIUM - general best practices

**Research date:** 2026-02-04
**Valid until:** 2026-03-04 (30 days - social media features stable)
</metadata>

---

_Phase: 24-social-media-audit_
_Research completed: 2026-02-04_
_Ready for planning: yes_
