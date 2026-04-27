/**
 * ROF CRM Design System - Theme Tokens Export
 * Single source of truth for all design decisions
 */

export * from './colors';
export * from './typography';
export * from './spacing';
export * from './shadows';
export * from './borderRadius';
export * from './motion';

import { colors } from './colors';
import { typography } from './typography';
import { spacing } from './spacing';
import { shadows } from './shadows';
import { borderRadius } from './borderRadius';
import { motion } from './motion';

// Grouped token object for convenience
export const designTokens = {
  colors,
  typography,
  spacing,
  shadows,
  borderRadius,
  motion,
} as const;
