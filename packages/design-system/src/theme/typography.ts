/**
 * ROF CRM Design System - Typography Tokens
 * 8-step hierarchy: 12px to 48px
 * Font: Inter (with system fallback)
 * Weights: 400 (regular), 500 (medium), 600 (semibold), 700 (bold)
 */

export const typography = {
  fontFamily: {
    base: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif',
    mono: '"Courier New", monospace',
  },

  fontSize: {
    xs: '12px',   // caption, small text
    sm: '14px',   // small, helper text
    base: '16px', // body, default text
    lg: '18px',   // label, input text
    xl: '20px',   // subtitle
    '2xl': '24px', // heading 3
    '3xl': '32px', // heading 2
    '4xl': '48px', // heading 1
  } as const,

  fontWeight: {
    regular: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  } as const,

  lineHeight: {
    tight: 1.3,   // headings
    normal: 1.5,  // body, captions
    relaxed: 1.6, // long-form text
  } as const,

  letterSpacing: {
    tight: '-0.01em',
    normal: '0em',
  } as const,

  // Pre-composed text styles (use in components)
  styles: {
    h1: {
      fontSize: '48px',
      fontWeight: 700,
      lineHeight: 1.3,
      letterSpacing: '-0.01em',
    },
    h2: {
      fontSize: '32px',
      fontWeight: 700,
      lineHeight: 1.3,
      letterSpacing: '-0.01em',
    },
    h3: {
      fontSize: '24px',
      fontWeight: 600,
      lineHeight: 1.3,
      letterSpacing: '-0.01em',
    },
    subtitle: {
      fontSize: '20px',
      fontWeight: 600,
      lineHeight: 1.3,
    },
    label: {
      fontSize: '18px',
      fontWeight: 500,
      lineHeight: 1.5,
    },
    body: {
      fontSize: '16px',
      fontWeight: 400,
      lineHeight: 1.5,
    },
    small: {
      fontSize: '14px',
      fontWeight: 400,
      lineHeight: 1.5,
    },
    caption: {
      fontSize: '12px',
      fontWeight: 400,
      lineHeight: 1.5,
    },
  },
} as const;

// Type helpers
export type FontSize = keyof typeof typography.fontSize;
export type FontWeight = keyof typeof typography.fontWeight;
export type TextStyle = keyof typeof typography.styles;
