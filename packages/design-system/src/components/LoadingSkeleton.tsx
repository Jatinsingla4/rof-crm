import React from 'react';
import { motion } from 'framer-motion';
import { colors, borderRadius } from '../theme';

export interface LoadingSkeletonProps {
  variant?: 'text' | 'circle' | 'rectangle';
  height?: string;
  width?: string;
  borderRadius?: string;
  count?: number;
}

/**
 * LoadingSkeleton Component - Placeholder during data fetch
 * Uses pulsing animation instead of spinner
 * Variants: text (thin line), circle (round), rectangle (box)
 */
export const LoadingSkeleton: React.FC<LoadingSkeletonProps> = ({
  variant = 'rectangle',
  height = '20px',
  width = '100%',
  borderRadius: br,
  count = 1,
}) => {
  const variants = {
    text: {
      height: '12px',
      borderRadius: '2px',
    },
    circle: {
      height: height || '40px',
      width: width || '40px',
      borderRadius: '50%',
    },
    rectangle: {
      height,
      borderRadius: br || borderRadius.card,
    },
  };

  const style = variants[variant];

  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <motion.div
          key={i}
          style={{
            ...style,
            width: variant === 'circle' ? width : width,
            background: colors.neutral[200],
            marginBottom: variant === 'text' ? '8px' : '12px',
          }}
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{
            duration: 0.4,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      ))}
    </>
  );
};
