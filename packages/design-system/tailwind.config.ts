import type { Config } from 'tailwindcss';
import { colors, spacing, shadows, borderRadius, motion } from './src/theme';

export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        neutral: colors.neutral,
        success: colors.success,
        warning: colors.warning,
        error: colors.error,
        info: colors.info,
        primary: colors.primary,
      },
      spacing: spacing,
      fontSize: {
        xs: '12px',
        sm: '14px',
        base: '16px',
        lg: '18px',
        xl: '20px',
        '2xl': '24px',
        '3xl': '32px',
        '4xl': '48px',
      },
      boxShadow: {
        'elevation-0': 'none',
        'elevation-1': '0 2px 4px rgba(0, 0, 0, 0.05)',
        'elevation-2': '0 4px 8px rgba(0, 0, 0, 0.08)',
        'elevation-3': '0 8px 16px rgba(0, 0, 0, 0.12)',
        'elevation-4': '0 12px 24px rgba(0, 0, 0, 0.15)',
        'elevation-5': '0 16px 32px rgba(0, 0, 0, 0.20)',
      },
      borderRadius: {
        'button': '4px',
        'card': '8px',
        'input': '8px',
        'modal': '12px',
        'drawer': '12px',
        'pill': '16px',
        'badge': '16px',
        'circular': '50%',
      },
      transitionDuration: {
        '150': '150ms',
        '200': '200ms',
        '300': '300ms',
        '500': '500ms',
      },
      transitionTimingFunction: {
        'default': 'cubic-bezier(0.4, 0, 0.2, 1)',
        'in': 'cubic-bezier(0, 0, 0.2, 1)',
        'out': 'cubic-bezier(0.4, 0, 1, 1)',
      },
    },
  },
  corePlugins: {
    // Disable arbitrary value generation (prevent vibe-coding)
    // Only defined values in theme.extend are allowed
    preflight: true,
  },
  plugins: [],
} satisfies Config;
