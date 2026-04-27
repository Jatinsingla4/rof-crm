/**
 * ROF CRM Design System - Color Tokens
 * Neutral palette (11 shades) + 5 semantic colors
 * All colors must be used via these tokens (no hardcoded hex codes)
 */

export const colors = {
  // Neutral Palette (11 shades, 8% lightness step)
  neutral: {
    50: '#FAFAFA',  // Off-white, backgrounds
    100: '#F5F5F5', // Light backgrounds, hover states
    200: '#F0F0F0', // Input backgrounds, disabled states
    300: '#E8E8E8', // Borders, dividers
    400: '#D9D9D9', // Input borders, disabled text
    500: '#BFBFBF', // Placeholder text
    600: '#8C8C8C', // Secondary text, helper text
    700: '#595959', // Primary text, labels
    800: '#262626', // Near-black, headings
    900: '#000000', // Pure black (sparingly)
  },

  // Semantic Colors
  success: {
    50: '#F6FFED',
    100: '#B7EB8F',
    500: '#52C41A',
    600: '#389E0D',
    700: '#274916',
  },

  warning: {
    50: '#FFFBE6',
    100: '#FFE58F',
    500: '#FAAD14',
    600: '#D48806',
    700: '#7D4E0E',
  },

  error: {
    50: '#FFF1F0',
    100: '#FFCCC7',
    500: '#FF4D4F',
    600: '#F5222D',
    700: '#820014',
  },

  info: {
    50: '#E6F7FF',
    100: '#BAE7FF',
    500: '#1890FF',
    600: '#0050B3',
    700: '#003A8C',
  },

  primary: {
    50: '#F9F0FF',
    100: '#F3D0FF',
    500: '#722ED1',
    600: '#531DAB',
    700: '#391085',
  },
} as const;

// Type helpers for strict typing
export type NeutralColor = keyof typeof colors.neutral;
export type SemanticColor = 'success' | 'warning' | 'error' | 'info' | 'primary';
export type ColorShade = 50 | 100 | 500 | 600 | 700;

// Opacity variants (10%, 25%, 50%, 75% for each color)
export const colorWithOpacity = (hex: string, opacity: number): string => {
  const op = Math.round((opacity / 100) * 255).toString(16);
  return `${hex}${op}`;
};

// Usage in components: colors.neutral[700], colors.success[500], etc.
