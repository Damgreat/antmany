import React from 'react';
import { StyleSheet, View, Platform } from 'react-native';
import { Button, useTheme } from 'react-native-paper';

interface AnalysisButtonProps {
  onPress: () => void;
  disabled?: boolean;
}

export const AnalysisButton: React.FC<AnalysisButtonProps> = ({
  onPress,
  disabled = false
}) => {
  const theme = useTheme();

  return (
    <View style={[
      styles.container,
      Platform.select({
        ios: styles.iosShadow,
        android: styles.androidShadow,
      })
    ]}>
      <Button
        mode="contained"
        onPress={onPress}
        disabled={disabled}
        icon="chart-box"
        style={[
          styles.button,
          { backgroundColor: disabled ? theme.colors.surfaceDisabled : theme.colors.primary }
        ]}
        labelStyle={styles.buttonLabel}
      >
        Analysis
      </Button>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 16,
    alignSelf: 'center',
    width: '60%',
  },
  button: {
    borderRadius: 28,
    height: 40,
    justifyContent: 'center',
  },
  buttonLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 1,
    ...Platform.select({
      ios: {
        fontWeight: '600',
      },
      android: {
        fontFamily: 'sans-serif-medium',
      },
    }),
  },
  iosShadow: {
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  androidShadow: {
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 4, // This should be defined separately
  },
});
