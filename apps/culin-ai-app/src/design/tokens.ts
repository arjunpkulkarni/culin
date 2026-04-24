export const fontFamily = {
  primary: 'DMSans-Regular',
  primaryLight: 'DMSans-Light',
  primaryMedium: 'DMSans-Medium',
  secondary: 'SpaceGrotesk-Regular',
  secondaryLight: 'SpaceGrotesk-Light',
  secondaryMedium: 'SpaceGrotesk-Medium',
} as const;


export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radius = {
  chip: 16,
  button: 20,
  card: 24,
  full: 9999,
} as const;

export const fontSize = {
  caption: 13,
  body: 16,
  button: 17,
  titleL: 24,
  titleXL: 32,
} as const;

export const fontWeight = {
  light: '300' as const,
  regular: '400' as const,
  medium: '500' as const,
} as const;

export const colors = {
  // Primary Green Palette
  primary: {
    500: '#7ED957',
    600: '#63C63F',
    700: '#4CAF2E',
    soft: '#E8FBE3',
  },
  
  // Accent Colors
  accent: {
    mint: '#CFF7D6',
    teal: '#5ED6B3',
    skyBlue: '#A6E3FF',
  },
  
  // Neutral Palette
  neutral: {
    white: '#FFFFFF',
    offWhite: '#F7F9F8',
    gray100: '#E5EAE7',
    gray300: '#A8B3AD',
    gray600: '#4A5550',
    blackSoft: '#1E2421',
  },
  
  // Semantic Colors
  semantic: {
    success: '#6EDB8A',
    warning: '#FFC857',
    error: '#FF6B6B',
  },
  
  // Gradients
  gradients: {
    lightGreen: ['#F2FFF2', '#E8FBE3', '#CFF7D6'],
    mint: ['#E8FBE3', '#CFF7D6'],
    clinical: ['#F7F9F8', '#E5EAE7'],
  },
  
  // Dark Mode Palette
  dark: {
    background: '#1E2421',
    surface: '#2A302D',
    surfaceElevated: '#353C39',
    primary: '#7ED957',
    primaryDim: '#63C63F',
    text: '#F7F9F8',
    textSecondary: '#A8B3AD',
    border: '#4A5550',
  },
};

export const shadows = {
  card: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 4,
  },
  button: {
    shadowColor: '#63C63F',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 2,
  },
  floating: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 6,
  },
} as const;

export const animation = {
  duration: {
    fast: 150,
    normal: 200,
    slow: 300,
  },
  easing: 'ease-out',
  spring: {
    damping: 20,
    stiffness: 200,
  },
} as const;

// Typography Scale
export const typography = {
  titleXL: {
    fontFamily: fontFamily.primaryLight,
    fontSize: fontSize.titleXL,
    fontWeight: fontWeight.light,
    lineHeight: 40,
    letterSpacing: -0.5,
  },
  titleL: {
    fontFamily: fontFamily.primary,
    fontSize: fontSize.titleL,
    fontWeight: fontWeight.regular,
    lineHeight: 32,
    letterSpacing: -0.3,
  },
  body: {
    fontFamily: fontFamily.primary,
    fontSize: fontSize.body,
    fontWeight: fontWeight.regular,
    lineHeight: 24,
    letterSpacing: 0,
  },
  caption: {
    fontFamily: fontFamily.primary,
    fontSize: fontSize.caption,
    fontWeight: fontWeight.regular,
    lineHeight: 18,
    letterSpacing: 0.2,
  },
  button: {
    fontFamily: fontFamily.primaryMedium,
    fontSize: fontSize.button,
    fontWeight: fontWeight.medium,
    lineHeight: 24,
    letterSpacing: 0.3,
  },
} as const;
