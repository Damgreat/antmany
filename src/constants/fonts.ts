// Font family definitions for the application
export const FONTS = {
  POPPINS_REGULAR: 'Poppins-Regular',
  POPPINS_BOLD: 'Poppins-Bold',
  POPPINS_SEMI_BOLD: 'Poppins-SemiBold',
  POPPINS_LIGHT: 'Poppins-Light',
  POPPINS_MEDIUM: 'Poppins-Medium',
};

// Font weight to font name mapping
export const FONT_WEIGHTS: Record<string, string> = {
  normal: FONTS.POPPINS_REGULAR,
  '100': FONTS.POPPINS_LIGHT,
  '200': FONTS.POPPINS_LIGHT,
  '300': FONTS.POPPINS_LIGHT,
  '400': FONTS.POPPINS_REGULAR,
  '500': FONTS.POPPINS_MEDIUM,
  '600': FONTS.POPPINS_SEMI_BOLD,
  '700': FONTS.POPPINS_BOLD,
  '800': FONTS.POPPINS_BOLD,
  '900': FONTS.POPPINS_BOLD,
  bold: FONTS.POPPINS_BOLD,
};

// Theme colors
export const COLORS = {
  BACKGROUND: '#F2F1ED',
  PRIMARY: '#336699',
  SECONDARY: '#5c8599',
  TEXT: '#333333',
  LIGHT_TEXT: '#777777',
}; 