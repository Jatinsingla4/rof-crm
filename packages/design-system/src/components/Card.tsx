import React from 'react';
import { colors, spacing, shadows, borderRadius } from '../theme';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'elevated' | 'outlined' | 'ghost';
  padding?: 'standard' | 'spacious';
  children: React.ReactNode;
}

/**
 * Card Component - Container for content
 * Variants: elevated (shadow), outlined (border), ghost (no styling)
 * Padding: standard (16px), spacious (24px)
 */
export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ variant = 'elevated', padding = 'standard', children, className = '', ...props }, ref) => {
    const paddingSize = padding === 'spacious' ? spacing.md : spacing.sm;

    const variantStyles =
      variant === 'elevated'
        ? {
            background: '#FFFFFF',
            boxShadow: shadows.elevation2.boxShadow,
            border: 'none',
          }
        : variant === 'outlined'
          ? {
              background: '#FFFFFF',
              border: `1px solid ${colors.neutral[300]}`,
              boxShadow: 'none',
            }
          : {
              background: 'transparent',
              border: 'none',
              boxShadow: 'none',
            };

    return (
      <div
        ref={ref}
        style={{
          borderRadius: borderRadius.card,
          padding: paddingSize,
          ...variantStyles,
        }}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';
