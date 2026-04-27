import React from 'react';
import { motion } from 'framer-motion';
import { Card } from './Card';
import { colors, spacing } from '../theme';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

export interface DashboardKPICardProps {
  title: string;
  value: string | number;
  trend?: {
    direction: 'up' | 'down' | 'neutral';
    percentage: number;
    label?: string;
  };
  icon?: React.ReactNode;
  color?: 'success' | 'warning' | 'error' | 'info' | 'primary';
}

/**
 * DashboardKPICard Component - Metric card with trend indicator
 * Used in dashboards to display key metrics (receivables, collections, etc.)
 */
export function DashboardKPICard({
  title,
  value,
  trend,
  icon,
  color = 'primary',
}: DashboardKPICardProps) {
  const colorMap = {
    success: colors.success[500],
    warning: colors.warning[500],
    error: colors.error[500],
    info: colors.info[500],
    primary: colors.primary[500],
  };

  const TrendIcon =
    trend?.direction === 'up'
      ? TrendingUp
      : trend?.direction === 'down'
        ? TrendingDown
        : Minus;

  const trendColor =
    trend?.direction === 'up'
      ? colors.success[500]
      : trend?.direction === 'down'
        ? colors.error[500]
        : colors.neutral[600];

  return (
    <Card variant="elevated">
      <motion.div
        style={{ padding: spacing.md }}
        whileHover={{ y: -2 }}
        transition={{ duration: 0.2 }}
      >
        {/* Title + Icon */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: spacing.sm,
          }}
        >
          <span style={{ fontSize: '14px', color: colors.neutral[600], fontWeight: 500 }}>
            {title}
          </span>
          {icon && (
            <div style={{ fontSize: '24px', color: colorMap[color] }}>
              {icon}
            </div>
          )}
        </div>

        {/* Value */}
        <div style={{ fontSize: '32px', fontWeight: 700, marginBottom: '4px' }}>
          {value}
        </div>

        {/* Trend */}
        {trend && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: spacing.xs,
              fontSize: '14px',
              color: trendColor,
            }}
          >
            <TrendIcon size={16} />
            <span>
              {trend.direction === 'up' ? '↑' : trend.direction === 'down' ? '↓' : '–'}{' '}
              {trend.percentage}%
            </span>
            {trend.label && <span style={{ color: colors.neutral[600] }}>{trend.label}</span>}
          </div>
        )}
      </motion.div>
    </Card>
  );
}
