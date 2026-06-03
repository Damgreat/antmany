import React from 'react';
import { Text as RNText, TextProps, StyleSheet } from 'react-native';
import { FONTS, COLORS } from '../constants/fonts';

interface CustomTextProps extends TextProps {
  variant?: 'regular' | 'bold' | 'semiBold' | 'light' | 'medium';
  color?: string;
}

const CustomText: React.FC<CustomTextProps> = ({
  children,
  style,
  variant = 'regular',
  color = COLORS.TEXT,
  ...props
}) => {
  const getFontFamily = () => {
    switch (variant) {
      case 'bold':
        return FONTS.POPPINS_BOLD;
      case 'semiBold':
        return FONTS.POPPINS_SEMI_BOLD;
      case 'light':
        return FONTS.POPPINS_LIGHT;
      case 'medium':
        return FONTS.POPPINS_MEDIUM;
      default:
        return FONTS.POPPINS_REGULAR;
    }
  };

  return (
    <RNText
      style={[
        styles.text,
        { fontFamily: getFontFamily(), color },
        style,
      ]}
      {...props}
    >
      {children}
    </RNText>
  );
};

const styles = StyleSheet.create({
  text: {
    fontSize: 14,
  },
});

export default CustomText; 