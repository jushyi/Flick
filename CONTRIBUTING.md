# Development Notes

Personal development reference for Flick.

## Commit Messages

Format: `type(scope): description`

| Type       | Use                                  |
| ---------- | ------------------------------------ |
| `feat`     | New feature                          |
| `fix`      | Bug fix                              |
| `docs`     | Documentation only                   |
| `refactor` | Code change, no behavior change      |
| `test`     | Adding or updating tests             |
| `chore`    | Build process, dependencies, tooling |

Examples:

```
feat(darkroom): add batch reveal with haptic feedback
fix(camera): correct flash toggle state persistence
refactor(feed): extract useFeedPhotos hook
```

## Code Quality Checklist

- [ ] `npm run lint` passes
- [ ] `npm test` passes
- [ ] No `console.log` statements (use logger)
- [ ] App runs: `npx expo start`

---

Full conventions and patterns documented in [CLAUDE.md](CLAUDE.md).
