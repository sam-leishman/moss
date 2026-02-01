# XView Style Guide

This document outlines the design system and styling conventions for the XView application. Follow these guidelines to maintain consistency across all components.

## Core Principles

1. **Always support dark mode** - Every UI element must have light and dark variants
2. **Use Lucide icons** - All icons should come from `lucide-svelte`
3. **Maintain color consistency** - Use the defined color palette throughout
4. **Follow Tailwind conventions** - Use utility classes with `dark:` variants

## Color Palette

### Primary Colors
- **Blue (Primary)**: `bg-blue-600` / `dark:bg-blue-600`
  - Hover: `hover:bg-blue-700` / `dark:hover:bg-blue-700`
  - Text: `text-blue-600` / `dark:text-blue-400`

### Background Colors
- **Page Background**: `bg-gray-50` / `dark:bg-gray-950`
- **Card/Panel Background**: `bg-white` / `dark:bg-gray-800`
- **Secondary Background**: `bg-gray-50` / `dark:bg-gray-700`
- **Hover Background**: `hover:bg-gray-50` / `dark:hover:bg-gray-800`

### Text Colors
- **Primary Text**: `text-gray-900` / `dark:text-white`
- **Secondary Text**: `text-gray-600` / `dark:text-gray-400`
- **Muted Text**: `text-gray-500` / `dark:text-gray-400`
- **Label Text**: `text-gray-700` / `dark:text-gray-300`

### Border Colors
- **Default Border**: `border-gray-200` / `dark:border-gray-700`
- **Subtle Border**: `border-gray-300` / `dark:border-gray-600`

### Border Radius
- **Standard Rounding**: `rounded-lg` - Used for buttons, cards, inputs, and panels
- **Full Rounding**: `rounded-full` - Used for badges, pills, and circular elements
- **Large Rounding**: `rounded-2xl` - Used for modals and prominent containers

### State Colors

#### Success
- Background: `bg-green-50` / `dark:bg-green-900/20`
- Border: `border-green-200` / `dark:border-green-800`
- Text: `text-green-800` / `dark:text-green-200`

#### Warning
- Background: `bg-amber-50` / `dark:bg-amber-900/20`
- Border: `border-amber-200` / `dark:border-amber-800`
- Text: `text-amber-800` / `dark:text-amber-200`
- Accent: `text-amber-600` / `dark:text-amber-400`

#### Error
- Background: `bg-red-50` / `dark:bg-red-900/20`
- Border: `border-red-200` / `dark:border-red-800`
- Text: `text-red-800` / `dark:text-red-200`

#### Info
- Background: `bg-blue-50` / `dark:bg-blue-900/20`
- Border: `border-blue-200` / `dark:border-blue-800`
- Text: `text-blue-800` / `dark:text-blue-200`

## Component Patterns

### Buttons

**Primary Button**
```svelte
<button class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
  Button Text
</button>
```

**Secondary Button**
```svelte
<button class="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
  Button Text
</button>
```

**Icon Button**
```svelte
<button class="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300">
  <IconName class="w-5 h-5" />
</button>
```

### Form Inputs

**Text Input**
```svelte
<input
  type="text"
  class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder:text-gray-500 dark:placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
/>
```

**Select Dropdown**
```svelte
<select class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent">
  <option>Option</option>
</select>
```

### Cards

**Standard Card**
```svelte
<div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
  <!-- Card content -->
</div>
```

**Hover Card**
```svelte
<div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-md transition-shadow">
  <!-- Card content -->
</div>
```

### Modals

**Modal Overlay**
```svelte
<div class="fixed inset-0 z-50 bg-black/50">
  <div class="bg-white dark:bg-gray-800 rounded-lg shadow-2xl">
    <!-- Modal content -->
  </div>
</div>
```

**Modal Header**
```svelte
<div class="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
  <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Title</h3>
  <button class="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300">
    <X class="w-5 h-5" />
  </button>
</div>
```

### Tags/Chips

**Tag Chip**
```svelte
<div class="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded-full text-sm">
  <TagIcon class="w-3 h-3" />
  <span>Tag Name</span>
</div>
```

### Lists

**List with Separators**
```svelte
<div class="divide-y divide-gray-200 dark:divide-gray-700">
  <!-- List items -->
</div>
```

**List Item**
```svelte
<div class="p-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
  <!-- Item content -->
</div>
```

## Icons

Always use Lucide icons from `lucide-svelte`:

```svelte
import { IconName } from 'lucide-svelte';

<IconName class="w-5 h-5 text-gray-600 dark:text-gray-400" />
```

Common icon sizes:
- Small: `w-3 h-3` or `w-4 h-4`
- Medium: `w-5 h-5`
- Large: `w-6 h-6` or `w-8 h-8`

## Typography

### Headings
- **Page Title**: `text-2xl font-bold text-gray-900 dark:text-white`
- **Section Title**: `text-lg font-semibold text-gray-900 dark:text-white`
- **Subsection**: `text-sm font-medium text-gray-700 dark:text-gray-300`
- **Label**: `text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide`

### Body Text
- **Primary**: `text-sm text-gray-900 dark:text-white`
- **Secondary**: `text-sm text-gray-600 dark:text-gray-400`
- **Muted**: `text-xs text-gray-500 dark:text-gray-400`

## Spacing

Use consistent spacing with Tailwind's spacing scale:
- **Component padding**: `p-4` or `p-6`
- **Section gaps**: `space-y-4` or `space-y-6`
- **Element gaps**: `gap-2` or `gap-4`

## Transitions

Always include smooth transitions for interactive elements:
```svelte
class="transition-colors"  <!-- For color changes -->
class="transition-all"     <!-- For multiple properties -->
class="transition-shadow"  <!-- For shadow changes -->
```

## Accessibility

1. Always include `aria-label` for icon-only buttons
2. Use semantic HTML elements (`<button>`, `<nav>`, etc.)
3. Ensure proper color contrast in both light and dark modes
4. Include focus states: `focus:ring-2 focus:ring-blue-500`

## Best Practices

1. **Test in both themes** - Always verify components in light and dark mode
2. **Use consistent spacing** - Follow the spacing scale throughout
3. **Maintain hover states** - All interactive elements should have hover feedback
4. **Keep it simple** - Use utility classes over custom CSS when possible
5. **Follow the pattern** - Look at existing components for reference
