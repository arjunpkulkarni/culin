import { Easing } from 'react-native-reanimated';

// Smooth easing curves for professional animations
export const EASING = {
  // Standard easing
  easeInOut: Easing.bezier(0.4, 0, 0.2, 1),
  // Smooth entrance
  easeOut: Easing.bezier(0, 0, 0.2, 1),
  // Smooth exit
  easeIn: Easing.bezier(0.4, 0, 1, 1),
  // Bouncy (for playful interactions)
  bounce: Easing.bezier(0.68, -0.55, 0.265, 1.55),
  // Sharp (for quick actions)
  sharp: Easing.bezier(0.4, 0, 0.6, 1),
};

// Animation durations
export const DURATION = {
  fast: 200,
  normal: 300,
  slow: 500,
  verySlow: 800,
};

// Common animation configs
export const ANIMATIONS = {
  fadeIn: {
    opacity: {
      from: 0,
      to: 1,
      duration: DURATION.normal,
      easing: EASING.easeOut,
    },
  },
  fadeOut: {
    opacity: {
      from: 1,
      to: 0,
      duration: DURATION.fast,
      easing: EASING.easeIn,
    },
  },
  slideUp: {
    translateY: {
      from: 50,
      to: 0,
      duration: DURATION.normal,
      easing: EASING.easeOut,
    },
    opacity: {
      from: 0,
      to: 1,
      duration: DURATION.normal,
      easing: EASING.easeOut,
    },
  },
  slideDown: {
    translateY: {
      from: -50,
      to: 0,
      duration: DURATION.normal,
      easing: EASING.easeOut,
    },
    opacity: {
      from: 0,
      to: 1,
      duration: DURATION.normal,
      easing: EASING.easeOut,
    },
  },
  scaleIn: {
    scale: {
      from: 0.9,
      to: 1,
      duration: DURATION.normal,
      easing: EASING.easeOut,
    },
    opacity: {
      from: 0,
      to: 1,
      duration: DURATION.normal,
      easing: EASING.easeOut,
    },
  },
};

