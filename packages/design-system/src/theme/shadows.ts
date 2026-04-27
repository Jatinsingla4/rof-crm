/**
 * ROF CRM Design System - Shadow Tokens (Elevation System)
 * 5 elevation levels for depth perception
 * Elevation 0: border only (no shadow)
 * Elevation 5: modals, dropdowns (deepest)
 */

export const shadows = {
  // Elevation 0: Border only (cards, panels)
  elevation0: {
    boxShadow: 'none',
    border: '1px solid #E8E8E8',
  },

  // Elevation 1: Subtle (subtle UI elements, hover states)
  elevation1: {
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)',
  },

  // Elevation 2: Elevated (cards, panels, hover effects)
  elevation2: {
    boxShadow: '0 4px 8px rgba(0, 0, 0, 0.08)',
  },

  // Elevation 3: Raised (raised UI elements, tooltips)
  elevation3: {
    boxShadow: '0 8px 16px rgba(0, 0, 0, 0.12)',
  },

  // Elevation 4: Floating (floating action buttons, popovers)
  elevation4: {
    boxShadow: '0 12px 24px rgba(0, 0, 0, 0.15)',
  },

  // Elevation 5: Modal (modals, drawers, dropdowns, backdrop)
  elevation5: {
    boxShadow: '0 16px 32px rgba(0, 0, 0, 0.20)',
  },
} as const;

// Tailwind CSS compatible shadow values (for use in Tailwind config)
export const shadowValues = {
  'elevation-0': 'none',
  'elevation-1': '0 2px 4px rgba(0, 0, 0, 0.05)',
  'elevation-2': '0 4px 8px rgba(0, 0, 0, 0.08)',
  'elevation-3': '0 8px 16px rgba(0, 0, 0, 0.12)',
  'elevation-4': '0 12px 24px rgba(0, 0, 0, 0.15)',
  'elevation-5': '0 16px 32px rgba(0, 0, 0, 0.20)',
} as const;

// Usage guide:
// - elevation0: borders (no shadow)
// - elevation1: hover states, subtle depth
// - elevation2: cards, panels, buttons on hover
// - elevation3: tooltips, raised elements
// - elevation4: floating action buttons, popovers
// - elevation5: modals, dropdowns, critical overlays

export type ElevationLevel = 0 | 1 | 2 | 3 | 4 | 5;
