/**
 * ROF CRM Design System - Border Radius Tokens
 * Hardcoded values (no arbitrary border-radius allowed)
 * - 4px: buttons, inputs, small elements
 * - 8px: cards, panels, form fields
 * - 12px: modals, drawers
 * - 16px: pills, badges, large pills
 * - 50%: circular elements (avatars)
 */

export const borderRadius = {
  button: '4px',
  card: '8px',
  input: '8px',
  modal: '12px',
  drawer: '12px',
  pill: '16px',
  badge: '16px',
  circular: '50%',
} as const;

// Tailwind CSS compatible values (for use in Tailwind config)
export const borderRadiusValues = {
  'rounded-button': '4px',
  'rounded-card': '8px',
  'rounded-input': '8px',
  'rounded-modal': '12px',
  'rounded-drawer': '12px',
  'rounded-pill': '16px',
  'rounded-badge': '16px',
  'rounded-circular': '50%',
} as const;

// Usage guide:
// - button: 4px (slightly rounded buttons)
// - card, input, panel: 8px (standard rounded)
// - modal, drawer: 12px (larger rounded for major modals)
// - pill, badge, large pills: 16px (highly rounded)
// - circular: 50% (circles, avatars)

export type BorderRadiusKey = keyof typeof borderRadius;
