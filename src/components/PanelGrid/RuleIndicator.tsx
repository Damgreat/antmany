import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';

interface RuleIndicatorProps {
  type: 'homozygous' | 'heterozygous';
  position?: 'top' | 'bottom';
}

export const RuleIndicator: React.FC<RuleIndicatorProps> = ({
  type,
  position = 'top',
}) => {
  if (!type) return null;

  return (
    <View style={[styles.container, styles[position]]}>
      <Text style={styles.text}>{type}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  top: {
    top: -10,
    right: -10,
  },
  bottom: {
    bottom: -10,
    right: -10,
  },
  text: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#f44336',
  },
});
