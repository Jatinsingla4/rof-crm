import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { colors, spacing, shadows, borderRadius } from '../theme';
import { X } from 'lucide-react';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  size?: 'small' | 'medium' | 'large';
  children: React.ReactNode;
  footer?: React.ReactNode;
  closeButton?: boolean;
}

/**
 * Modal Component - Centered overlay with elevation-5 shadow
 * Backdrop + modal box + focus trap + Escape to close
 */
export function Modal({
  isOpen,
  onClose,
  title,
  size = 'medium',
  children,
  footer,
  closeButton = true,
}: ModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const sizeStyles = {
    small: { width: '480px' },
    medium: { width: '640px' },
    large: { width: '800px' },
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0, 0, 0, 0.45)',
              zIndex: 999,
            }}
          />

          {/* Modal Box */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.3 }}
            style={{
              position: 'fixed',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              background: '#FFFFFF',
              borderRadius: borderRadius.modal,
              boxShadow: shadows.elevation5.boxShadow,
              zIndex: 1000,
              maxHeight: '90vh',
              overflow: 'auto',
              ...sizeStyles[size],
            }}
          >
            {/* Header */}
            {(title || closeButton) && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: spacing.md,
                  borderBottom: `1px solid ${colors.neutral[300]}`,
                }}
              >
                {title && (
                  <h2
                    style={{
                      fontSize: '18px',
                      fontWeight: 600,
                      margin: 0,
                    }}
                  >
                    {title}
                  </h2>
                )}
                {closeButton && (
                  <button
                    onClick={onClose}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: '0',
                      color: colors.neutral[600],
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <X size={24} />
                  </button>
                )}
              </div>
            )}

            {/* Body */}
            <div style={{ padding: spacing.md }}>{children}</div>

            {/* Footer */}
            {footer && (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: spacing.sm,
                  padding: spacing.md,
                  borderTop: `1px solid ${colors.neutral[300]}`,
                }}
              >
                {footer}
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
