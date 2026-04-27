import React from 'react';
import { CheckCircle2, AlertCircle, XCircle, Info, Minus } from 'lucide-react';
import { colors, borderRadius, spacing } from '../theme';

export interface StatusBadgeProps {
  status: 'success' | 'warning' | 'error' | 'info' | 'default';
  size?: 'small' | 'medium';
  text: string;
  ariaLabel?: string;
}

/**
 * StatusBadge Component - NEVER COLOR ALONE
 * Always icon + text + color
 * Status: success (green ✓), warning (amber ⚠), error (red ✗), info (blue ℹ), default (gray -)
 * Enforces accessibility: aria-label required
 */
export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  size = 'medium',
  text,
  ariaLabel,
}) => {
  const statusConfig = {
    success: {
      bg: colors.success[50],
      text: colors.success[500],
      icon: CheckCircle2,
    },
    warning: {
      bg: colors.warning[50],
      text: colors.warning[500],
      icon: AlertCircle,
    },
    error: {
      bg: colors.error[50],
      text: colors.error[500],
      icon: XCircle,
    },
    info: {
      bg: colors.info[50],
      text: colors.info[500],
      icon: Info,
    },
    default: {
      bg: '#FAFAFA',
      text: colors.neutral[600],
      icon: Minus,
    },
  };

  const config = statusConfig[status];
  const Icon = config.icon;
  const sizeStyles = {
    small: { height: '20px', padding: `0 ${spacing.xs}`, fontSize: '12px', gap: '4px' },
    medium: { height: '24px', padding: `0 ${spacing.sm}`, fontSize: '14px', gap: '6px' },
  };

  return (
    <div
      role="status"
      aria-label={ariaLabel || `Status: ${text}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        background: config.bg,
        color: config.text,
        borderRadius: borderRadius.badge,
        ...sizeStyles[size],
        fontWeight: 500,
      }}
    >
      <Icon size={size === 'small' ? 14 : 16} />
      <span>{text}</span>
    </div>
  );
};
