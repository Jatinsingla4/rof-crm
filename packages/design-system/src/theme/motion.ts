/**
 * ROF CRM Design System - Motion/Animation Tokens
 * Durations: 150ms (hover), 200ms (expand), 300ms (modal), 500ms (page)
 * No animation > 500ms (perceived sluggishness)
 * Easing functions for natural motion
 */

export const motion = {
  // Animation Durations (ms)
  duration: {
    hover: 150,      // Quick hover feedback
    expand: 200,     // Expand/collapse animations
    modal: 300,      // Modal entrance/exit
    page: 500,       // Page transition
  },

  // Easing Functions (cubic-bezier format)
  easing: {
    // Default: ease-in-out (smooth, balanced)
    default: 'cubic-bezier(0.4, 0, 0.2, 1)',

    // Entrance: ease-out (starts fast, ends slow)
    in: 'cubic-bezier(0, 0, 0.2, 1)',

    // Exit: ease-in (starts slow, ends fast)
    out: 'cubic-bezier(0.4, 0, 1, 1)',

    // Smooth: standard ease-in-out
    smooth: 'cubic-bezier(0.4, 0, 0.2, 1)',
  },
} as const;

// Pre-composed animation specs (for Framer Motion and CSS)
export const animationPresets = {
  // Hover feedback
  hover: {
    transition: {
      duration: motion.duration.hover / 1000,
      ease: motion.easing.smooth,
    },
  },

  // Expand/collapse (accordion, dropdown)
  expand: {
    transition: {
      duration: motion.duration.expand / 1000,
      ease: motion.easing.smooth,
    },
  },

  // Modal entrance (fade in + scale)
  modalEntrance: {
    initial: { opacity: 0, scale: 0.95 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.95 },
    transition: {
      duration: motion.duration.modal / 1000,
      ease: motion.easing.in,
    },
  },

  // Page transition (fade)
  pageTransition: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: {
      duration: motion.duration.page / 1000,
      ease: motion.easing.smooth,
    },
  },

  // Fade in
  fadeIn: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    transition: {
      duration: motion.duration.expand / 1000,
      ease: motion.easing.in,
    },
  },

  // Loading pulse (0.5 → 1.0 → 0.5 cycle, 400ms)
  pulse: {
    animate: { opacity: [0.5, 1, 0.5] },
    transition: {
      duration: 0.4,
      repeat: Infinity,
      ease: 'easeInOut',
    },
  },
} as const;

// Tailwind CSS compatible values (for use in Tailwind config)
export const motionValues = {
  'duration-150': '150ms',
  'duration-200': '200ms',
  'duration-300': '300ms',
  'duration-500': '500ms',
} as const;

export type AnimationDuration = keyof typeof motion.duration;
export type EasingFunction = keyof typeof motion.easing;
