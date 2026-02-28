# Taaltuig Design Language

> **Purpose:** Defines the visual and interaction design for Taaltuig, with clear mobile vs desktop priorities.

---

## Design Philosophy

### Platform Strategy

| Experience | Priority | Rationale |
|------------|----------|-----------|
| **Review Session** | Mobile-first | Primary use case: quick reviews on the go |
| **Sign In** | Mobile-first | Must work seamlessly on any device |
| **Card Management** | Desktop-focused | Bulk operations, complex UI |
| **Settings** | Desktop-focused | Infrequent, detailed configuration |
| **AI Lab** | Desktop-focused | Experimental, power-user feature |

### Core Principles
- Glass morphism for depth and layering
- Purple gradient as primary brand color
- Large border radii for soft, friendly feel
- 3D transforms and animations for engagement (with reduced motion support)
- Color-coded feedback (especially in grading)
- **Respect `prefers-reduced-motion`** for accessibility

---

## Color Palette

### Brand Colors
| Name | Light Mode | Dark Mode | Usage |
|------|-----------|-----------|-------|
| Primary | `#7602D7` → `#B405DF` gradient | Same | CTAs, primary buttons |
| Accent | `#F208E7` (hot pink) | Same | Highlights, hover states |
| Destructive | `#EF4444` | Same | Delete actions, "Again" grade |

### Grade Button Colors
| Grade | Color | Hex |
|-------|-------|-----|
| Again | Red | `rgb(239, 68, 68)` |
| Hard | Amber | `rgb(245, 158, 11)` |
| Good | Green | `rgb(34, 197, 94)` |
| Easy | Indigo | `rgb(99, 102, 241)` |

### Surface Colors
| Surface | Light | Dark |
|---------|-------|------|
| Background | `#FFFFFF` | `#09090B` |
| Card | `rgba(255, 255, 255, 0.7)` | `rgba(39, 39, 42, 0.7)` |
| Muted | `#F4F4F5` | `#27272A` |

---

## Typography

### Font Stack
- **Primary:** Outfit (Google Fonts)
- **Monospace:** JetBrains Mono
- **Fallback:** system-ui, -apple-system, sans-serif

### Scale
| Element | Size | Weight | Notes |
|---------|------|--------|-------|
| Flash card front | `text-4xl` | 800 (extrabold) | `tracking-tight` |
| Flash card back | `text-3xl` | 800 (extrabold) | |
| Section headers | `text-sm` | 600 (semibold) | `uppercase tracking-wide` |
| Body | `text-sm` | 400 | |
| Buttons | `text-sm` | 500 (medium) | |

---

## Spacing & Sizing

### Border Radius
- **Default:** `30px` (very rounded)
- Cards, dialogs, major containers use this large radius
- Creates soft, approachable feel

### Common Spacing
| Context | Value |
|---------|-------|
| Card padding | `p-6` (24px) |
| Section gaps | `gap-4` (16px) |
| Page padding | `px-6 py-4` |
| Button height | `h-10` (40px) default |

---

## Components

### Buttons

**Primary (Gradient):**
```
background: linear-gradient(to right, #8B10E0, #B840E8)
text: white
hover: brightness(1.1)
active: scale(0.95)
```

**Grade Buttons (Frosted Glass):**
```
background: rgba(255, 255, 255, 0.4)
border: 1px solid rgba(255, 255, 255, 0.4)
backdrop-filter: blur
hover: scale(1.05), translate-y(-4px)
```

### Cards

**Glass Card:**
```
background: rgba(255, 255, 255, 0.7)
backdrop-filter: blur(20px)
border: 1px solid rgba(255, 255, 255, 0.5)
border-radius: 2rem
```

### Flash Card
- **Mobile:** Full width with `px-4` padding
- **Desktop:** Max 600px width, centered
- 3D perspective flip animation (500ms) - reduced motion: crossfade
- Entrance: rotateY(-35deg) scale(0.85) → identity - reduced motion: fade
- Shimmer border effect on active state - reduced motion: static
- Tap/click or Space key to reveal

---

## Animations & Effects

### Key Animations
| Name | Duration | Usage |
|------|----------|-------|
| Card flip | 500ms | Flash card reveal |
| Card entrance | 500ms | New card appears |
| Grade button stagger | Spring | Buttons appear sequentially |
| Shimmer border | 3s loop | Active flash card |
| Mesh float | 10-15s | Background gradient blobs |
| Loading glow | 1.2s | Progress indicator |

### Interaction Patterns
- **Hover:** Scale up (1.05), translate up, brightness increase
- **Active/Click:** Scale down (0.95)
- **Focus:** Ring outline with offset

---

## Layout Patterns

### Page Structure
```
┌─────────────────────────────────────┐
│  Header (sticky, glass background)  │
├─────────────────────────────────────┤
│                                     │
│         Main Content                │
│         (flex-1, overflow-auto)     │
│                                     │
├─────────────────────────────────────┤
│  Footer/Actions (sticky bottom)     │
└─────────────────────────────────────┘
```

### Container
- Max width: `max-w-4xl` (896px) for content
- Centered: `container mx-auto`

---

## Mobile Design (Review & Sign In)

### Navigation
- **Pattern:** Hamburger menu (top-right)
- Opens as slide-out Sheet from right
- Contains: Home, Review, Cards, Settings, Sign Out

### Grade Buttons (Mobile)
```
┌─────────────┬─────────────┐
│   Again     │    Hard     │
│   (red)     │   (amber)   │
├─────────────┼─────────────┤
│    Good     │    Easy     │
│   (green)   │  (indigo)   │
└─────────────┴─────────────┘
```
- **Layout:** 2x2 grid
- **No swipe gestures** - explicit tap only
- Large touch targets (min 48px height)
- Keyboard shortcuts still work (1-4)

### Flash Card (Mobile)
- Full width with horizontal padding (`px-4`)
- Maintain 3D flip animation (respects reduced motion)
- Tap anywhere to reveal (Space key on desktop)
- Vertically centered in viewport

### Sign In (Mobile)
- Full-screen centered layout
- Large Google sign-in button
- Logo and minimal branding above

---

## Reduced Motion Support

When `prefers-reduced-motion: reduce` is set:

| Animation | Default | Reduced |
|-----------|---------|---------|
| Card flip | 3D rotateY 500ms | Instant opacity crossfade |
| Card entrance | rotateY + scale 500ms | Simple fade 150ms |
| Grade button stagger | Spring animation | No stagger, instant |
| Shimmer border | 3s loop | Static border |
| Mesh background | Floating blobs | Static gradient |
| Hover effects | Scale + translate | Opacity/color only |

Implementation: Use Tailwind's `motion-safe:` and `motion-reduce:` variants.

---

## Desktop Design (Management)

Card management, settings, and AI Lab remain desktop-optimized:
- Full-width tables and forms
- Hover states and tooltips
- Complex multi-column layouts
- Keyboard shortcuts throughout

---

## shadcn/ui Components in Use

- Alert Dialog, Badge, Button, Card, Checkbox
- Collapsible, Dialog, Input, Label, Progress
- Select, **Sheet** (for mobile nav), Skeleton, Slider, Switch
- Tabs, Textarea, Toast, Tooltip, Table, Separator

All use Radix UI primitives with Tailwind styling.

---

## Implementation Checklist

### Mobile-First (Review & Sign In)

- [x] **Hamburger Navigation**
  - [x] Create `MobileNav` component using Sheet
  - [x] Add hamburger icon button to header
  - [x] Navigation links: Home, Review, Cards, Settings, Sign Out
  - [x] Only show on mobile breakpoint (`md:hidden`)

- [x] **Grade Buttons - 2x2 Grid**
  - [x] Responsive layout: 2x2 on mobile, horizontal row on desktop
  - [x] Minimum 48px touch targets
  - [x] Maintain color coding and visual feedback

- [x] **Flash Card - Responsive**
  - [x] Full width on mobile (`w-full px-4`)
  - [x] Max 600px on desktop (`md:w-[600px]`)
  - [x] Ensure text scales appropriately

- [x] **Sign In Page**
  - [x] Full-screen centered with logo
  - [x] Large touch-friendly Google button

### Reduced Motion

- [x] **CSS/Tailwind Setup**
  - [x] Add `motion-reduce:` variants where needed
  - [x] Create utility classes for reduced motion alternatives
  - [x] Add `@media (prefers-reduced-motion)` rules in index.css

- [x] **Component Updates**
  - [x] FlashCard: simple fade instead of 3D flip (via framer-motion)
  - [x] GradeButtons: no stagger animation (useReducedMotion hook)
  - [x] Background: static gradient via CSS media query
  - [x] Shimmer border: static via CSS media query
  - [x] TaaltuigLogo: disable hover/entrance animations

### Testing

- [ ] Test on iOS Safari (primary mobile target)
- [ ] Test on Android Chrome
- [ ] Test with `prefers-reduced-motion` enabled
- [ ] Verify touch targets meet 48px minimum

---

## File References

- **CSS Variables:** `packages/frontend/src/index.css`
- **Tailwind Config:** `packages/frontend/tailwind.config.js`
- **Button Variants:** `packages/frontend/src/components/ui/button-variants.ts`
- **shadcn Components:** `packages/frontend/src/components/ui/`
- **Flash Card:** `packages/frontend/src/components/FlashCard.tsx`
- **Grade Buttons:** `packages/frontend/src/components/GradeButtons.tsx`
