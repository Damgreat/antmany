import React from 'react';
import { TouchableOpacity, StyleSheet, View, Platform } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import type { ResultValue } from '../../types';

interface CellProps {
  value: ResultValue;
  width: number;  // Added width prop
  onPress?: () => void;
  editable?: boolean;
  highlighted?: boolean;
  isShaded?: boolean;
  ruleIndicator?: 'X' | 'slash' | null;
  isLastInGroup?: boolean;
  groupName?: string;
  isResult?: boolean;
  isGrade?: boolean;  // Add flag for Grade column
  isCheck?: boolean;  // Add flag for Check column
  testingMethod?: 'Gel' | 'Tube'; // Add testing method
  zoomLevel?: number; // Add this prop
}

export const Cell: React.FC<CellProps> = ({
  value,
  width,
  onPress,
  editable = true,
  highlighted = false,
  isShaded = false,
  ruleIndicator,
  isLastInGroup = false,
  groupName,
  isResult = false,
  isGrade = false,
  isCheck = false,
  testingMethod = 'tube',
  zoomLevel = 1.0 // Default to 1.0 if not provided
}) => {
  const theme = useTheme();

  const getBackgroundColor = () => {
    if (isShaded) return 'rgba(0, 0, 0, 0.05)';
    if (highlighted) return theme.colors.primaryContainer;

    // Adjust background colors based on cell type and value
    if (isResult) {
      // Result cell background colors
      if (testingMethod === 'gel') {
        switch (value) {
          case '+': return '#DCEDC8';  // Light green for positive
          case '0': return '#FFCDD2';  // Light red for negative
          case 'MF': return '#E8F5E9'; // Medium green for mixed field
          case 'W+': return '#FFF8E1'; // Light amber for weak positive
          case '1+':
          case '2+':
          case '3+':
          case '4+': return '#DCEDC8'; // Light green for numeric positives
          default: return theme.colors.surface;
        }
      } else {
        // Tube method
        switch (value) {
          case '+': return '#DCEDC8';  // Light green for positive
          case '0': return '#FFCDD2';  // Light red for negative
          case 'NT': return '#E1F5FE'; // Light blue for NT
          default: return theme.colors.surface;
        }
      }
    } else if (isGrade) {
      // Grade cell background colors
      switch (value) {
        case 'MF': return '#E8F5E9'; // Light green for mixed field
        case 'W+': return '#FFF8E1'; // Light amber for weak positive
        case '1+': return '#FFEBEE'; // Very light red
        case '2+': return '#FFCDD2'; // Light red
        case '3+': return '#EF9A9A'; // Medium red
        case '4+': return '#E57373'; // Strong red
        default: return theme.colors.surface;
      }
    } else if (isCheck) {
      // Check cell background colors
      return value === '✓' ? '#E8F5E9' : theme.colors.surface; // Light green if checked
    } else {
      // Regular cell background colors
      switch (value) {
        case '+': return '#DCEDC8';  // Light green (original)
        case '0': return '#FFCDD2';  // Light red (original)
        case '+s': return '#C8E6C9'; // Medium green (original)
        case '/': return '#ffffff';  // Light orange (original)
        case '+w': return '#FFE0B2';
        case 'NT': return '#E1F5FE'; // Light blue
        default: return theme.colors.surface;
      }
    }
  };

  const getRuleIndicatorStyle = () => {
    const indicatorSize = Math.floor(width * 0.4); // 25% of cell width
    const baseStyle = {
      ...styles.ruleIndicator,
      ...(ruleIndicator === 'slash' ? styles.slashIndicator : {}),
      width: indicatorSize,
      height: indicatorSize,
      borderRadius: indicatorSize / 2,
      top: -indicatorSize / 3,
      right: -indicatorSize / 3,
    };

    if (Platform.OS === 'android') {
      return {
        ...baseStyle,
        elevation: 4,
      };
    } else {
      return {
        ...baseStyle,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
      };
    }
  };

  // Get text color based on cell type and value
  const getTextColor = () => {
    if (isResult) {
      // Result cell text colors
      if (testingMethod === 'gel') {
        switch (value) {
          case '+': return '#33691E'; // Dark green
          case '0': return '#D32F2F'; // Dark red
          case 'MF': return '#388E3C'; // Medium green
          case 'W+': return '#FFA000'; // Amber
          case '1+':
          case '2+':
          case '3+':
          case '4+': return '#33691E'; // Dark green
          default: return '#333';
        }
      } else {
        // Tube method
        switch (value) {
          case '+': return '#33691E'; // Dark green
          case '0': return '#D32F2F'; // Dark red
          case 'NT': return '#0277BD'; // Blue
          default: return '#333';
        }
      }
    } else if (isGrade) {
      // Grade cell text colors
      switch (value) {
        case 'MF': return '#388E3C'; // Medium green
        case 'W+': return '#FFA000'; // Amber
        case '1+':
        case '2+':
        case '3+':
        case '4+': return '#D32F2F'; // Dark red
        default: return '#333';
      }
    } else if (isCheck) {
      // Check cell text colors
      return value === '✓' ? '#4CAF50' : '#333'; // Green checkmark
    } else {
      // Regular cell text colors
      return '#333';
    }
  };

  // Create a style for the cell value text based on zoom level
  const valueTextStyle = {
    fontSize: 12 * zoomLevel,
    fontWeight: 'bold' as 'bold',
    color: getTextColor()
  };

  // Make check mark larger
  const checkMarkTextStyle = {
    ...valueTextStyle,
    fontSize: isCheck ? 18 * zoomLevel : 13.5 * zoomLevel,
  };

  // Create a style for rule indicators based on zoom level
  const indicatorStyle = {
    fontSize: 5.5 * zoomLevel,
    fontWeight: 'bold' as 'bold'
  };

  return (
    <TouchableOpacity
      style={[
        styles.container,
        {
          width: width,
          height: width, // Keep proportional height
          backgroundColor: getBackgroundColor(),
          borderLeftColor: '#ccc',
          borderTopColor: '#ccc',
          borderBottomColor: '#ccc',
        },
        isLastInGroup ? styles.lastInGroup : { borderRightColor: '#ccc' },
        groupName && styles.groupCell,
        isResult && styles.resultCell,
        isGrade && styles.gradeCell,
        isCheck && styles.checkCell
      ]}
      onPress={onPress}
      disabled={!editable}
      activeOpacity={editable ? 0.6 : 1}
    >
      {value ? (
        <Text style={isCheck ? checkMarkTextStyle : valueTextStyle}>{value}</Text>
      ) : null}

      {ruleIndicator === 'X' && isShaded && (
        <View style={[getRuleIndicatorStyle(), { position: 'absolute' }]}>
          <Text style={[
            styles.ruleXText,
            indicatorStyle
          ]}>
            X
          </Text>
        </View>
      )}

      {ruleIndicator === 'slash' && isShaded && (
        <View style={[getRuleIndicatorStyle(), { position: 'absolute' }]}>
          <Text style={[
            styles.ruleSlashText,
            indicatorStyle
          ]}>
            /
          </Text>
        </View>
      )}

      {isShaded && <View style={styles.shadedOverlay} />}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    position: 'relative',
    overflow: 'hidden',
  },
  text: {
    textAlign: 'center',
    includeFontPadding: false,
    textAlignVertical: 'center',
    ...Platform.select({
      ios: { fontWeight: '600' },
      android: { fontFamily: 'sans-serif-medium' }
    }),
  },
  ruleIndicator: {
    position: 'absolute',
    backgroundColor: '#6750A4', // Purple for rule indicators
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },
  slashIndicator: {
    backgroundColor: '#FF9800', // Orange for slash indicators
  },
  ruleXText: {
    color: 'rgba(255, 0, 0, 0.6)',
  },
  ruleSlashText: {
    color: 'rgba(0, 0, 255, 0.6)',
  },
  lastInGroup: {
    borderRightWidth: 1,
    borderRightColor: '#000000',
  },
  groupCell: {
    borderLeftWidth: 1,
  },
  resultCell: {
    borderLeftWidth: 1,
    borderLeftColor: '#666',
  },
  gradeCell: {
    borderLeftWidth: 1,
    borderLeftColor: '#ccc',
  },
  checkCell: {
    borderLeftWidth: 1,
    borderLeftColor: '#ccc',
  },
  shadedOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    zIndex: 1,
  }
});

export default Cell;