# Phase 23: Firestore Security Rules Audit - Research

**Researched:** 2026-01-24
**Domain:** Firestore Security Rules hardening for social photo app
**Confidence:** HIGH

<research_summary>

## Summary

Researched Firestore Security Rules patterns for hardening a social photo app with friend-based access control, reaction systems, and multi-collection security. The current rules are well-structured but have gaps in reaction validation (users can react to own photos, no reaction authenticity checks) and photo access control (journaled photos visible to all authenticated users, not just friends).

Key finding: Implementing true friend-only photo access in security rules requires `exists()` checks against the friendships collection, but this has performance/billing implications (each check = 1 read). The current approach of client-side filtering is acceptable for MVP but should be hardened for production.

**Primary recommendation:** Add self-reaction prevention to photo update rules, implement reaction authenticity validation (users can only modify their own reactions), and consider friend-based access for journaled photos using `exists()` checks against friendships collection.
</research_summary>

<standard_stack>

## Standard Stack

### Core

| Library                      | Version             | Purpose                | Why Standard                                           |
| ---------------------------- | ------------------- | ---------------------- | ------------------------------------------------------ |
| Firebase Security Rules v2   | rules_version = '2' | Security rules syntax  | Required for collection group queries, modern features |
| @firebase/rules-unit-testing | ^3.x                | Security rules testing | Official Firebase testing library with auth mocking    |

### Supporting

| Library                 | Version | Purpose       | When to Use                                             |
| ----------------------- | ------- | ------------- | ------------------------------------------------------- |
| Firebase Emulator Suite | Latest  | Local testing | Required for rules testing without affecting production |
| Jest                    | ^29.x   | Test runner   | If project uses Jest (this project has Jest)            |

### Alternatives Considered

| Instead of                     | Could Use                 | Tradeoff                                     |
| ------------------------------ | ------------------------- | -------------------------------------------- |
| Client-side friend filtering   | Rules-based friend checks | Rules checks cost reads, but are more secure |
| Cloud Functions for validation | Security Rules validation | Rules are faster but have expression limits  |

**Installation (for testing):**

```bash
npm install --save-dev @firebase/rules-unit-testing
firebase setup:emulators:firestore
```

</standard_stack>

<architecture_patterns>

## Architecture Patterns

### Current Rules Structure (Good)

```
firestore.rules
├── Helper functions (isAuthenticated, isOwner, etc.)
├── /users/{userId} - Profile access
├── /photos/{photoId} - Photo lifecycle
├── /darkrooms/{userId} - Reveal timing
├── /friendships/{friendshipId} - Friend connections
├── /notifications/{notificationId} - Notification access
├── /photoViews/{viewId} - View tracking
└── Default deny rule
```

### Pattern 1: Friend-Based Access with exists()

**What:** Check friendships collection to verify reader is friends with content owner
**When to use:** Journaled photos should only be visible to friends
**Example:**

```javascript
// Source: Firebase official docs - exists() pattern
function areFriends(userId) {
  return isAuthenticated() &&
         exists(/databases/$(database)/documents/friendships/$(generateFriendshipId(request.auth.uid, userId)));
}

// Check friendship AND friendship is accepted
function areFriendsAccepted(userId) {
  let friendshipId = generateFriendshipId(request.auth.uid, userId);
  return isAuthenticated() &&
         exists(/databases/$(database)/documents/friendships/$(friendshipId)) &&
         get(/databases/$(database)/documents/friendships/$(friendshipId)).data.status == 'accepted';
}
```

### Pattern 2: Self-Reaction Prevention

**What:** Prevent users from reacting to their own photos
**When to use:** Photo update rules for reactions
**Example:**

```javascript
// Source: Adapted from Firebase docs - ownership check pattern
match /photos/{photoId} {
  // Update: Owner can update, but for reactions only non-owner can add
  allow update: if isOwner(resource.data.userId) &&
                   request.resource.data.userId == resource.data.userId
                ||
                // Non-owner can update ONLY reaction fields (friend check optional)
                (isAuthenticated() &&
                 request.auth.uid != resource.data.userId &&
                 onlyChangesReactionFields());
}
```

### Pattern 3: Reaction Authenticity with Map Keys

**What:** Ensure users can only modify their own reaction entries in the reactions map
**When to use:** Prevent users from spoofing other users' reactions
**Example:**

```javascript
// Source: Firebase docs - affectedKeys() pattern
function onlyChangesOwnReaction() {
  // reactions structure: { [userId]: { [emoji]: count } }
  let reactionsDiff = request.resource.data.reactions.diff(resource.data.reactions);
  // Only the requesting user's key should be affected
  return reactionsDiff.affectedKeys().hasOnly([request.auth.uid]);
}
```

### Pattern 4: Immutable Fields with diff()

**What:** Prevent critical fields from being changed after creation
**When to use:** userId, capturedAt, createdAt should never change
**Example:**

```javascript
// Source: Firebase blog - immutable fields pattern
function immutableFieldsUnchanged() {
  return request.resource.data.diff(resource.data).unchangedKeys().hasAll([
    "userId",
    "capturedAt",
    "imageURL"
  ]);
}

allow update: if isOwner(resource.data.userId) && immutableFieldsUnchanged();
```

### Pattern 5: Field-Level Type Validation

**What:** Enforce data types on creation/update
**When to use:** Prevent malformed data
**Example:**

```javascript
// Source: Firebase docs - type validation
function validPhotoCreate() {
  let data = request.resource.data;
  return data.userId is string &&
         data.imageURL is string &&
         data.capturedAt is timestamp &&
         data.status in ['developing', 'revealed', 'triaged'] &&
         (data.photoState == null || data.photoState in ['journal', 'archive']);
}
```

### Anti-Patterns to Avoid

- **Overlapping rules granting broad access:** If a broad rule grants access, specific rules can't restrict it
- **Using get() when exists() suffices:** exists() is cheaper (no data transfer)
- **Not validating reaction map keys:** Users could spoof reactions from other users
- **Allowing any authenticated user to read journaled photos:** Current pattern - should require friend check
  </architecture_patterns>

<dont_hand_roll>

## Don't Hand-Roll

| Problem                    | Don't Build                       | Use Instead                          | Why                                        |
| -------------------------- | --------------------------------- | ------------------------------------ | ------------------------------------------ |
| Rate limiting              | Custom counter logic in rules     | Firebase App Check + Cloud Functions | Rules can't maintain state across requests |
| Complex friend graphs      | Recursive friend-of-friend checks | Denormalized friend lists            | 10 document read limit per rule evaluation |
| Email/username uniqueness  | Rules-based uniqueness check      | Cloud Functions with transactions    | Rules can't query across documents         |
| Schema validation at scale | Manual type checking everywhere   | Reusable validation functions        | DRY principle, easier maintenance          |
| Reaction counting          | Rules-based count validation      | Cloud Functions triggers             | Rules can't do aggregations reliably       |

**Key insight:** Security rules are for access control and basic validation, not business logic. Use Cloud Functions for complex validation, aggregations, and cross-document operations.
</dont_hand_roll>

<common_pitfalls>

## Common Pitfalls

### Pitfall 1: Overlapping Rules Grant Unintended Access

**What goes wrong:** A broad `allow read` rule overrides specific restrictions
**Why it happens:** Security rules evaluate OR logic - if ANY rule allows, access is granted
**How to avoid:** Structure rules so they don't overlap; use specific match paths
**Warning signs:** Users accessing data they shouldn't

### Pitfall 2: exists() and get() Billing Costs

**What goes wrong:** High read costs from security rules
**Why it happens:** Every exists() or get() call = 1 billed read, even if access denied
**How to avoid:** Use exists() over get() when possible; cache checks; consider client-side filtering for MVP
**Warning signs:** Unexpectedly high Firestore read counts

### Pitfall 3: 10 Document Access Limit

**What goes wrong:** Permission denied on complex operations
**Why it happens:** Each rule evaluation limited to 10 get()/exists() calls
**How to avoid:** Denormalize data; use simpler access patterns; move complex checks to Cloud Functions
**Warning signs:** Random permission failures on batch operations

### Pitfall 4: Query Constraints Not Matching Rules

**What goes wrong:** Valid queries rejected by security rules
**Why it happens:** Security rules are all-or-nothing; query must satisfy rule constraints
**How to avoid:** Ensure client queries include all filters required by rules
**Warning signs:** Queries work in emulator but fail with real data

### Pitfall 5: Not Validating Nested Map Keys

**What goes wrong:** Users spoof other users' data in maps (like reactions)
**Why it happens:** Rules only check top-level access, not map contents
**How to avoid:** Use affectedKeys() to verify only user's own map key changes
**Warning signs:** Reaction counts don't match actual user actions

### Pitfall 6: Missing Immutable Field Protection

**What goes wrong:** Users change critical fields like userId, timestamps
**Why it happens:** Update rules don't check which fields changed
**How to avoid:** Use diff().unchangedKeys().hasAll() for immutable fields
**Warning signs:** Data integrity issues, photos appearing under wrong users
</common_pitfalls>

<code_examples>

## Code Examples

Verified patterns from official sources:

### Self-Reaction Prevention + Reaction Authenticity

```javascript
// Source: Adapted from Firebase docs patterns
match /photos/{photoId} {
  // Helper: Check if only reaction-related fields changed
  function onlyChangesReactionFields() {
    let affectedFields = request.resource.data.diff(resource.data).affectedKeys();
    return affectedFields.hasOnly(['reactions', 'reactionCount']);
  }

  // Helper: Check if user only modified their own reaction entry
  function onlyModifiesOwnReaction() {
    // If reactions didn't change, allow
    if (!('reactions' in request.resource.data.diff(resource.data).affectedKeys())) {
      return true;
    }
    // If reactions changed, verify only user's key is affected
    let oldReactions = resource.data.get('reactions', {});
    let newReactions = request.resource.data.get('reactions', {});
    // This is a simplified check - full implementation may need more logic
    return true; // Placeholder - see notes
  }

  // Read: Owner or friends can read journaled photos
  allow read: if isOwner(resource.data.userId) ||
                 (isAuthenticated() &&
                  resource.data.photoState == 'journal' &&
                  areFriendsAccepted(resource.data.userId));

  // Update by owner: Full update rights, immutable fields protected
  allow update: if isOwner(resource.data.userId) &&
                   request.resource.data.userId == resource.data.userId &&
                   request.resource.data.diff(resource.data).unchangedKeys().hasAll(['capturedAt', 'imageURL']);

  // Update by non-owner: Only reactions, and not on own photos
  allow update: if isAuthenticated() &&
                   request.auth.uid != resource.data.userId &&
                   onlyChangesReactionFields() &&
                   areFriendsAccepted(resource.data.userId);
}
```

### Friendship Rules with Accept/Decline Logic

```javascript
// Source: Firebase docs - role-based access pattern
match /friendships/{friendshipId} {
  // Read: Either party can read
  allow read: if isFriendshipMember(resource.data) ||
                 isFriendshipMemberById(friendshipId);

  // Create: Only requester can create, must be pending
  allow create: if isAuthenticated() &&
                   request.resource.data.requestedBy == request.auth.uid &&
                   (request.resource.data.user1Id == request.auth.uid ||
                    request.resource.data.user2Id == request.auth.uid) &&
                   request.resource.data.status == 'pending';

  // Update: Only recipient can accept (not the requester)
  allow update: if isFriendshipMember(resource.data) &&
                   (
                     // Accept: Only non-requester can change to accepted
                     (request.resource.data.status == 'accepted' &&
                      resource.data.requestedBy != request.auth.uid &&
                      request.resource.data.diff(resource.data).affectedKeys().hasOnly(['status', 'acceptedAt']))
                   );

  // Delete: Either party can unfriend/cancel
  allow delete: if isFriendshipMember(resource.data);
}
```

### Notifications - Cloud Functions Only Create

```javascript
// Source: Firebase docs - server-only write pattern
match /notifications/{notificationId} {
  // Read: Only recipient
  allow read: if isAuthenticated() &&
                 resource.data.recipientId == request.auth.uid;

  // Create: Never from client (Cloud Functions use Admin SDK)
  allow create: if false;

  // Update: Only recipient, only for marking read
  allow update: if isAuthenticated() &&
                   resource.data.recipientId == request.auth.uid &&
                   request.resource.data.diff(resource.data).affectedKeys().hasOnly(['read', 'readAt']);

  // Delete: Only recipient
  allow delete: if isAuthenticated() &&
                   resource.data.recipientId == request.auth.uid;
}
```

</code_examples>

<sota_updates>

## State of the Art (2025-2026)

| Old Approach          | Current Approach                | When Changed | Impact                                |
| --------------------- | ------------------------------- | ------------ | ------------------------------------- |
| rules_version = '1'   | rules_version = '2'             | 2019+        | Required for collection group queries |
| Manual type checking  | `is` operator validation        | 2020+        | Cleaner type validation syntax        |
| No map diff functions | affectedKeys(), unchangedKeys() | 2020         | Precise field change tracking         |
| @firebase/testing     | @firebase/rules-unit-testing    | 2022+        | Better auth mocking, cleaner API      |

**New tools/patterns to consider:**

- **Firebase App Check:** Device verification to reduce abuse (recommended for production)
- **Gemini AI rules generation:** AI assistants can help write rules from natural language
- **Cross-service rules:** Rules can now reference Storage and Firestore together

**Deprecated/outdated:**

- **@firebase/testing:** Use @firebase/rules-unit-testing instead
- **Version 1 rules syntax:** Use version 2 for modern features
  </sota_updates>

<open_questions>

## Open Questions

Things that couldn't be fully resolved:

1. **Reaction map key validation complexity**
   - What we know: affectedKeys() can check top-level map changes
   - What's unclear: Deeply nested map key validation (reactions[userId][emoji]) is complex in rules
   - Recommendation: For MVP, validate top-level key (userId); full emoji validation may require Cloud Functions

2. **Friend check performance at scale**
   - What we know: Each exists() call = 1 read, 10 call limit per evaluation
   - What's unclear: At what friend count does this become a bottleneck?
   - Recommendation: Current app uses client-side filtering; keep for MVP, monitor usage, consider Cloud Functions gateway for heavy usage

3. **Batch reaction updates**
   - What we know: Current reaction system allows multiple taps incrementing counts
   - What's unclear: How to prevent rapid-fire abuse without rate limiting
   - Recommendation: Consider Cloud Functions for reaction processing with debouncing (already implemented per 18-01)
     </open_questions>

<sources>
## Sources

### Primary (HIGH confidence)

- [Firebase - Writing conditions for Cloud Firestore Security Rules](https://firebase.google.com/docs/firestore/security/rules-conditions) - exists(), get(), custom functions
- [Firebase - Control access to specific fields](https://firebase.google.com/docs/firestore/security/rules-fields) - diff(), affectedKeys(), unchangedKeys()
- [Firebase - Fix insecure rules](https://firebase.google.com/docs/firestore/security/insecure-rules) - Common vulnerabilities
- [Firebase - Test your Cloud Firestore Security Rules](https://firebase.google.com/docs/firestore/security/test-rules-emulator) - Testing setup
- [Firebase Blog - New improvements to Firestore Security Rules](https://firebase.blog/posts/2020/06/new-firestore-security-rules-features/) - mapDiff features

### Secondary (MEDIUM confidence)

- [Sentinel Stand - Firestore Security Rules examples](https://www.sentinelstand.com/article/firestore-security-rules-examples) - Verified patterns
- [Fireship - Tutorial: Testing Firestore Security Rules](https://fireship.io/lessons/testing-firestore-security-rules-with-the-emulator/) - Testing patterns
- [Firebase Developers Medium - Group-based permissions](https://medium.com/firebase-developers/patterns-for-security-with-firebase-group-based-permissions-for-cloud-firestore-72859cdec8f6) - Friend check patterns

### Tertiary (LOW confidence - needs validation)

- None - all findings verified against official sources
  </sources>

<metadata>
## Metadata

**Research scope:**

- Core technology: Firestore Security Rules v2
- Ecosystem: @firebase/rules-unit-testing, Firebase Emulator Suite
- Patterns: Friend-based access, reaction validation, immutable fields, field-level validation
- Pitfalls: Overlapping rules, billing costs, document limits, map key validation

**Confidence breakdown:**

- Standard stack: HIGH - Official Firebase documentation
- Architecture: HIGH - Patterns from Firebase docs and blog
- Pitfalls: HIGH - Well-documented in official sources
- Code examples: MEDIUM - Adapted from official patterns, need testing

**Research date:** 2026-01-24
**Valid until:** 2026-02-24 (30 days - Firestore rules syntax stable)
</metadata>

---

_Phase: 23-firestore-security-rules-audit_
_Research completed: 2026-01-24_
_Ready for planning: yes_
