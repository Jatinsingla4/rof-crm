/**
 * ROF CRM Design System - Spacing Tokens
 * Base unit: 8px
 * Scale: 8, 16, 24, 32, 48, 64, 80, 96px
 * NO OTHER SPACING VALUES ALLOWED (enforced via ESLint)
 */

export const spacing = {
  xs: '8px',    // 1 unit
  sm: '16px',   // 2 units
  md: '24px',   // 3 units
  lg: '32px',   // 4 units
  xl: '48px',   // 6 units
  '2xl': '64px', // 8 units
  '3xl': '80px', // 10 units
  '4xl': '96px', // 12 units
} as const;

// Pixel values for conditional logic
export const spacingPx = {
  xs: 8,
  sm: 16,
  md: 24,
  lg: 32,
  xl: 48,
  '2xl': 64,
  '3xl': 80,
  '4xl': 96,
} as const;

// Common spacing patterns (usage in components)
export const spacingPatterns = {
  // Padding
  padding: {
    button: spacing.sm, // 16px (12px left/right + 2px border)
    input: spacing.sm,
    card: spacing.md,
    modal: spacing.md,
    page: spacing.lg,
  },

  // Margin (gaps between elements)
  margin: {
    fieldGroup: spacing.md, // 24px between form fields
    section: spacing.lg,    // 32px between sections
    page: spacing.lg,       // 32px around page content
  },

  // Gaps (flexbox/grid)
  gap: {
    tight: spacing.xs,      // 8px between buttons
    normal: spacing.sm,     // 16px between components
    spacious: spacing.md,   // 24px between sections
  },
} as const;

export type Spacing = keyof typeof spacing;
