import React from 'react';
import { colors, spacing } from '../theme';

export interface TimelineEntry {
  id: string;
  timestamp: Date;
  title: string;
  description?: string;
  icon?: React.ReactNode;
  color?: 'success' | 'warning' | 'error' | 'info' | 'default';
  tags?: string[];
}

export interface TimelineProps {
  entries: TimelineEntry[];
  loading?: boolean;
}

/**
 * Timeline Component - Chronological activity feed
 * Used for remarks log, payment history, status updates
 */
export function Timeline({ entries, loading }: TimelineProps) {
  const colorMap = {
    success: colors.success[500],
    warning: colors.warning[500],
    error: colors.error[500],
    info: colors.info[500],
    default: colors.neutral[400],
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  if (loading) {
    return <div style={{ padding: spacing.md, color: colors.neutral[600] }}>Loading...</div>;
  }

  if (entries.length === 0) {
    return (
      <div style={{ padding: spacing.md, color: colors.neutral[600], textAlign: 'center' }}>
        No timeline entries
      </div>
    );
  }

  return (
    <div>
      {entries.map((entry, index) => (
        <div
          key={entry.id}
          style={{
            display: 'flex',
            gap: spacing.md,
            position: 'relative',
            paddingBottom: index < entries.length - 1 ? spacing.lg : 0,
          }}
        >
          {/* Dot */}
          <div
            style={{
              width: '16px',
              height: '16px',
              borderRadius: '50%',
              background: colorMap[entry.color || 'default'],
              flexShrink: 0,
              marginTop: '2px',
            }}
          />

          {/* Connecting line */}
          {index < entries.length - 1 && (
            <div
              style={{
                position: 'absolute',
                left: '7px',
                top: '24px',
                width: '2px',
                height: `calc(100% - 24px)`,
                background: colors.neutral[200],
              }}
            />
          )}

          {/* Content */}
          <div style={{ flex: 1, paddingTop: '2px' }}>
            <div style={{ fontSize: '12px', color: colors.neutral[600], marginBottom: '4px' }}>
              {formatDate(entry.timestamp)}
            </div>

            <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '4px' }}>
              {entry.title}
            </div>

            {entry.description && (
              <div style={{ fontSize: '14px', color: colors.neutral[700], marginBottom: spacing.xs }}>
                {entry.description}
              </div>
            )}

            {entry.tags && entry.tags.length > 0 && (
              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                {entry.tags.map((tag) => (
                  <span
                    key={tag}
                    style={{
                      fontSize: '12px',
                      background: colors.neutral[100],
                      color: colors.neutral[700],
                      padding: '2px 8px',
                      borderRadius: '12px',
                    }}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
