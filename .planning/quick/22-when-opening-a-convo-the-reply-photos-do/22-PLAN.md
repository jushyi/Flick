---
phase: quick-22
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/components/MessageBubble.js
autonomous: true
requirements: [QUICK-22]

must_haves:
  truths:
    - 'Reply preview images in conversation load from cache on subsequent opens'
    - 'Main message images and GIFs in conversation load from cache on subsequent opens'
    - 'Images still fade in smoothly with transition on first network load'
  artifacts:
    - path: 'src/components/MessageBubble.js'
      provides: 'Message rendering with cached images'
      contains: 'cachePolicy'
  key_links:
    - from: 'src/components/MessageBubble.js'
      to: 'expo-image'
      via: 'cachePolicy memory-disk'
      pattern: 'cachePolicy.*memory-disk'
---

<objective>
Fix reply photos (and all message images) not loading immediately when opening a conversation.

Purpose: Every Image component in the app uses `cachePolicy="memory-disk"` except the ones in MessageBubble.js. Without disk caching, message images and reply preview images are fetched fresh from Firebase Storage signed URLs on every conversation open, causing a visible delay where images are invisible before fading in via the 200ms transition. Adding the cache policy ensures images load instantly from cache on repeat views.

Output: MessageBubble.js with `cachePolicy="memory-disk"` on all three Image components.
</objective>

<execution_context>
@C:/Users/maser/.claude/get-shit-done/workflows/execute-plan.md
@C:/Users/maser/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/components/MessageBubble.js
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add cachePolicy to all Image components in MessageBubble</name>
  <files>src/components/MessageBubble.js</files>
  <action>
    Add `cachePolicy="memory-disk"` to all three `<Image>` components in MessageBubble.js:

    1. **Reply original image** (line ~238) — the `<Image>` inside `renderOriginalMessage()` that shows the replied-to photo/GIF thumbnail. This is the primary culprit reported by the user. Add `cachePolicy="memory-disk"` prop.

    2. **Reply original GIF** — same Image component handles both image and gif via the conditional `contentFit` prop, so the single fix covers both.

    3. **Main message image/GIF** (line ~306) — the `<Image>` inside the main bubble that renders `message.gifUrl || message.imageUrl`. Add `cachePolicy="memory-disk"` prop.

    This matches the pattern used by every other Image component in the codebase (verified across 40+ instances). The `expo-image` library's `memory-disk` policy caches images in both memory (instant) and disk (fast on restart), so:
    - First load: fetches from network, caches to memory + disk
    - Same session re-open: serves from memory (instant)
    - App restart re-open: serves from disk cache (very fast)

    Do NOT change the `transition={200}` — it provides a smooth fade-in on first network load and is harmless on cache hits (instant render).

  </action>
  <verify>
    <automated>cd "C:/Users/maser/Lapse Clone" && node -e "const fs=require('fs'); const c=fs.readFileSync('src/components/MessageBubble.js','utf8'); const matches=c.match(/cachePolicy/g); console.log('cachePolicy count:', matches?.length || 0); if(matches?.length !== 2) { console.error('Expected 2 cachePolicy props (reply image + main image), got', matches?.length); process.exit(1); } console.log('PASS');"</automated>
    <manual>Open a conversation that contains replies to photo/image messages. The reply preview images and message images should appear immediately (from cache if previously viewed) instead of flashing from empty to loaded.</manual>
  </verify>
  <done>All Image components in MessageBubble.js have `cachePolicy="memory-disk"`, matching the project-wide pattern. Reply photos and message images load from cache on repeat views.</done>
</task>

</tasks>

<verification>
- `cachePolicy="memory-disk"` appears on both Image components in MessageBubble.js
- No other props removed or changed
- App compiles without errors: `npx expo start` launches successfully
</verification>

<success_criteria>

- Reply preview images in conversations load instantly from cache on subsequent opens
- Main message images/GIFs also benefit from disk caching
- Pattern is consistent with all other Image usage across the codebase
  </success_criteria>

<output>
After completion, create `.planning/quick/22-when-opening-a-convo-the-reply-photos-do/22-SUMMARY.md`
</output>
