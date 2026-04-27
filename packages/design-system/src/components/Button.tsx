import React from 'react';
import { colors, borderRadius, spacing } from '../theme';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'text';
  size?: 'small' | 'medium' | 'large';
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  loading?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}

/**
 * Button Component - Base interactive element
 * Variants: primary (purple), secondary (gray), danger (red), text (no background)
 * Sizes: small (32px), medium (40px), large (48px)
 * States: default, hover, active, disabled, loading
 */
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'medium',
      icon,
      iconPosition = 'left',
      loading = false,
      disabled = false,
      children,
      className = '',
      ...props
    },
    ref
  ) => {
    const sizeStyles = {
      small: { height: '32px', padding: `0 ${spacing.xs}` },
      medium: { height: '40px', padding: `0 ${spacing.sm}` },
      large: { height: '48px', padding: `0 ${spacing.md}` },
    };

    const variantStyles = {
      primary: {
        background: colors.primary[500],
        color: '#FFFFFF',
        border: 'none',
      },
      secondary: {
        background: colors.neutral[100],
        color: colors.neutral[800],
        border: `1px solid ${colors.neutral[300]}`,
      },
      danger: {
        background: colors.error[500],
        color: '#FFFFFF',
        border: 'none',
      },
      text: {
        background: 'transparent',
        color: colors.primary[500],
        border: 'none',
      },
    };

    const isDisabled = disabled || loading;

    return (
      <button
        ref={ref}
        disabled={isDisabled}
        style={{
          ...sizeStyles[size],
          ...variantStyles[variant],
          borderRadius: borderRadius.button,
          cursor: isDisabled ? 'not-allowed' : 'pointer',
          opacity: isDisabled ? 0.6 : 1,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: spacing.xs,
          fontSize: size === 'small' ? '12px' : size === 'large' ? '16px' : '14px',
          fontWeight: 500,
          transition: 'all 150ms cubic-bezier(0.4, 0, 0.2, 1)',
          transform: 'translateY(0)',
        }}
        {...props}
      >
        {loading && <span style={{ display: 'inline-flex' }}>⟳</span>}
        {!loading && icon && iconPosition === 'left' && icon}
        {children}
        {!loading && icon && iconPosition === 'right' && icon}
      </button>
    );
  }
);

Button.displayName = 'Button';
