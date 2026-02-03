# Rewind App Color Reference

Quick reference for the standardized color system. **Always use constants, never hardcode hex values.**

---

## Color System Overview

All colors are centralized in `colors.js`. This ensures:

- Consistent dark theme across the entire app
- Easy theme modifications in one place
- No white flash during navigation (pure black backgrounds)
- Clear visual hierarchy

---

## Background Colors

| Constant                      | Value     | Usage                                         |
| ----------------------------- | --------- | --------------------------------------------- |
| `colors.background.primary`   | `#000000` | All screen backgrounds (pure black)           |
| `colors.background.secondary` | `#111111` | Cards, sheets, content blocks                 |
| `colors.background.card`      | `#111111` | Alias for secondary (explicit card usage)     |
| `colors.background.tertiary`  | `#2A2A2A` | Nested elements needing more contrast         |
| `colors.background.white`     | `#FFFFFF` | Light backgrounds (rare, mostly auth screens) |

**Rule:** Every screen must use `colors.background.primary` as its base background.

---

## Text Colors

| Constant                | Value     | Usage                                  |
| ----------------------- | --------- | -------------------------------------- |
| `colors.text.primary`   | `#FFFFFF` | Main text, headings, important content |
| `colors.text.secondary` | `#888888` | Labels, descriptions, muted text       |
| `colors.text.tertiary`  | `#666666` | Very muted helper text                 |
| `colors.text.inverse`   | `#000000` | Text on light backgrounds              |

---

## Icon Colors

| Constant                | Value     | Usage                   |
| ----------------------- | --------- | ----------------------- |
| `colors.icon.primary`   | `#FFFFFF` | Default icons (white)   |
| `colors.icon.secondary` | `#888888` | Muted/secondary icons   |
| `colors.icon.tertiary`  | `#666666` | Very muted icons        |
| `colors.icon.inactive`  | `#555555` | Disabled/inactive icons |

**Important:** Icons should **NOT** use brand purple. Purple is reserved for interactive elements and highlights only.

---

## Interactive/Accent Colors

| Constant                            | Value     | Usage                                        |
| ----------------------------------- | --------- | -------------------------------------------- |
| `colors.interactive.primary`        | `#8B5CF6` | Primary buttons, active tabs, focused inputs |
| `colors.interactive.primaryPressed` | `#7C3AED` | Pressed state (darker purple)                |
| `colors.interactive.secondary`      | `#333333` | Secondary buttons                            |
| `colors.brand.purple`               | `#8B5CF6` | Same as interactive.primary                  |

**Rule:** Purple is for shapes and interactive highlights, not icons.

---

## Status Colors

| Constant                   | Value     | Usage                            |
| -------------------------- | --------- | -------------------------------- |
| `colors.status.ready`      | `#22C55E` | Success states, green indicators |
| `colors.status.danger`     | `#FF3B30` | Errors, delete actions (iOS red) |
| `colors.status.developing` | `#EF4444` | Developing status dot            |

---

## Border Colors

| Constant                | Value     | Usage                               |
| ----------------------- | --------- | ----------------------------------- |
| `colors.border.subtle`  | `#222222` | Subtle dividers on dark backgrounds |
| `colors.border.default` | `#E0E0E0` | Light theme borders (rare)          |

---

## Overlay Colors

| Constant                | Value                      | Usage                    |
| ----------------------- | -------------------------- | ------------------------ |
| `colors.overlay.dark`   | `rgba(0, 0, 0, 0.5)`       | Standard overlay         |
| `colors.overlay.darker` | `rgba(0, 0, 0, 0.9)`       | Heavy overlay for modals |
| `colors.overlay.light`  | `rgba(255, 255, 255, 0.1)` | Subtle light overlay     |

---

## Usage Examples

```javascript
import { colors } from '../constants/colors';

// Screen background - REQUIRED for all screens
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
});

// Card with subtle lift
cardContainer: {
  backgroundColor: colors.background.secondary,
  borderRadius: 12,
}

// Primary text
title: {
  color: colors.text.primary,
  fontSize: 18,
}

// Muted label
label: {
  color: colors.text.secondary,
  fontSize: 14,
}

// Icon - use icon colors, NOT purple
<Ionicons
  name="settings-outline"
  size={24}
  color={colors.icon.primary}
/>

// Interactive button
button: {
  backgroundColor: colors.interactive.primary,
  paddingVertical: 12,
  paddingHorizontal: 24,
  borderRadius: 8,
}

// Danger/delete action
deleteButton: {
  backgroundColor: colors.status.danger,
}
```

---

## Rules Summary

1. **Always use constants** - Never hardcode hex values (`#000000`, `#FFFFFF`, etc.)

2. **Screen backgrounds** - Every screen must have `backgroundColor: colors.background.primary`

3. **Cards and sheets** - Use `colors.background.secondary` for visual lift

4. **Icons stay neutral** - Use `colors.icon.*` (white/gray), never purple

5. **Purple is for interactivity** - Buttons, active states, highlights only

6. **No white backgrounds** - Prevents flash during navigation

---

## Adding New Screens/Components

When creating a new screen:

```javascript
import { colors } from '../constants/colors';

const NewScreen = () => {
  return <View style={styles.container}>{/* content */}</View>;
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary, // Required!
  },
});
```

When creating a new modal/sheet:

```javascript
const styles = StyleSheet.create({
  modalContent: {
    backgroundColor: colors.background.secondary, // Cards use secondary
    borderRadius: 16,
  },
});
```

---

## Color Hierarchy Visual

```
Pure Black (#000000) - Screen backgrounds
    └── Dark Gray (#111111) - Cards, sheets (barely visible lift)
        └── Darker Gray (#2A2A2A) - Nested elements
            └── Interactive Purple (#8B5CF6) - Buttons, highlights
```

---

_Last updated: Phase 16 - Color Constants Standardization_
