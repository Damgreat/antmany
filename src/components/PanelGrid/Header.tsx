import React from 'react';
import { View, StyleSheet, Platform, TouchableOpacity } from 'react-native';
import { Text, useTheme, Badge, IconButton, Tooltip } from 'react-native-paper';
import type { AntigenGroups, RuleResult } from '../../types';
import { black } from 'react-native-paper/lib/typescript/styles/themes/v2/colors';

interface HeaderProps {
  antigens: string[];
  antigenGroups: AntigenGroups;
  rules: RuleResult[];
  onAntigenOverride?: (antigen: string) => void;
  ruledOutAntigens?: string[];
  onColumnLock?: (antigen: string) => void;
  lockedColumns?: string[];
  dimensions: {
    cellNumberWidth: number;
    donorIdWidth: number;
    antigenWidth: number;
    resultWidth: number;
    gradeWidth?: number; // Add Grade width
    checkWidth?: number; // Add Check width
  };
  zoomLevel?: number;
}

interface AntigenHeaderProps {
  antigen: string;
  group: string;
  rules: RuleResult[];
  isSpecialAntigen: boolean;
  isRuledOut: boolean;
  heterozygousCount: number;
  onOverride?: () => void;
  onColumnLock?: (antigen: string) => void;
  isLastInGroup?: boolean;
  width: number;
  zoomLevel: number;
  lockedColumns?: string[];
}

const AntigenHeader: React.FC<AntigenHeaderProps> = ({
  antigen,
  isSpecialAntigen,
  isRuledOut,
  heterozygousCount,
  onOverride,
  isLastInGroup,
  width,
  onColumnLock,
  lockedColumns = [],
  zoomLevel = 1.0,
}) => {
  const theme = useTheme();
  const badgeSize = Math.floor(width * 0.4); // 40% of column width

  // Special formatting for Grade and Check columns
  const isGradeColumn = antigen === 'Grade';
  const isCheckColumn = antigen === 'Check';
  const isResultColumn = antigen === 'RXN';

  // Custom headers for special columns
  let headerText = antigen;
  let headerColor = isRuledOut ? theme.colors.outline : theme.colors.onSurface;
  let headerBackground = isGradeColumn ? '#E8F5E9' : // Light green for Grade
    isCheckColumn ? '#E3F2FD' : // Light blue for Check
      isResultColumn ? '#FFF3E0' : // Light orange for Result
        undefined;

  // For Result column, adjust text based on testing method

  const renderCounterBadge = () => {
    if (!isSpecialAntigen || heterozygousCount === 0) return null;

    return (
      <Badge
        style={[
          styles.counterBadge,
          {
            backgroundColor: theme.colors.primary,
            top: 2,
            right: 2
          }
        ]}
        size={badgeSize}
      >
        {heterozygousCount}
      </Badge>
    );
  };

  const renderOverrideButton = () => {
    if (!isSpecialAntigen) return null;

    return (
      <Tooltip title={`${isRuledOut ? 'Locked' : 'Unlocked'}`}>
        <IconButton
          icon={isRuledOut ? "lock" : "lock-open"}
          iconColor={isRuledOut ? theme.colors.error : theme.colors.primary}
          size={badgeSize}
          style={styles.overrideIcon}
          onPress={onOverride}
        />
      </Tooltip>
    );
  };

  const handleToggleColumnLock = (antigen: string) => {
    if (onColumnLock) {
      onColumnLock(antigen);
    }
  };

  const isColumnLocked = (antigen: string): boolean => {
    return lockedColumns.includes(antigen);
  };

  const renderColumnLockbutton = () => {
    if (antigen === 'No') return null;

    return (
      onColumnLock && (
        <TouchableOpacity style={[
          { width: width / 2 }
        ]} onPress={() => handleToggleColumnLock(antigen)}>
          <IconButton
            style={[styles.overrideIcon, { width: width / 2, height: width / 2, left: -width / 3, top: - width * 3 / 4 }]}
            icon={isColumnLocked(antigen) ? "lock" : "lock-open"}
            size={badgeSize}
            iconColor={isColumnLocked(antigen) ? theme.colors.primary : theme.colors.onSurfaceVariant}
          />
        </TouchableOpacity>
      )
    );
  };

return (
  <View style={[
    styles.antigenHeader,
    {
      width: width,
      height: width, // At least 1.5x width or 45px
      borderLeftColor: theme.colors.outline,
      borderTopColor: theme.colors.outline,
      borderBottomColor: theme.colors.outline,
      backgroundColor: headerBackground
    },
    isLastInGroup ? { borderRightColor: '#000' } : { borderRightColor: theme.colors.outline }
  ]}>
    {renderCounterBadge()}

    <Text
      style={[
        styles.antigenText,
        isRuledOut && styles.ruledOutText,
        {
          color: headerColor,
          fontSize: Math.floor(width * 0.3) * zoomLevel // 30% of width
        }
      ]}
      numberOfLines={2}
      adjustsFontSizeToFit
    >
      {headerText}
    </Text>

    {/* {renderOverrideButton()} */}
    {renderColumnLockbutton()}
  </View>
);
};

export const Header: React.FC<HeaderProps> = ({
  antigens,
  antigenGroups,
  rules,
  onAntigenOverride,
  onColumnLock,
  ruledOutAntigens = [],
  dimensions,
  zoomLevel = 1.0,
  lockedColumns = [],
}) => {
  const theme = useTheme();

  const isSpecialAntigen = (antigen: string) => {
    return ['C', 'E', 'K'].includes(antigen);
  };

  const getAntigenGroup = (antigen: string): string => {
    for (const [group, groupAntigens] of Object.entries(antigenGroups)) {
      if (groupAntigens.includes(antigen)) {
        return group;
      }
    }
    return '';
  };

  const isLastInGroup = (antigen: string): boolean => {
    const group = getAntigenGroup(antigen);
    const groupAntigens = antigenGroups[group] || [];
    return groupAntigens[groupAntigens.length - 1] === antigen;
  };

  const getHeterozygousCount = (antigen: string) => {
    if (!isSpecialAntigen(antigen)) return 0;
    return rules.filter(rule =>
      rule.antigen === antigen &&
      rule.type === 'heterozygous'
    ).length;
  };

  const getGroupWidth = (groupAntigens: string[]) => {
    let width = 0;

    groupAntigens.forEach(antigen => {
      if (antigen === 'Result') {
        width += dimensions.resultWidth;
      } else if (antigen === 'Grade') {
        width += dimensions.resultWidth;
      } else if (antigen === 'Check') {
        width += dimensions.resultWidth;
      } else {
        width += dimensions.antigenWidth;
      }
    });

    return width;
  };

const ANTIGENGROUP_BGDCOLOR: { [key: string]: string } = {
    'Rh-hr': '#77cce6ff',
    'KELL': '#f1b4a5ff',
    'DUFFY': '#a4f3d5ff',
    'KIDD': '#ec93bcff',
    'SEX': '#d59ff5ff',
    'LEWIS': '#6d76faff',
    'MNS': '#f0d8daff',
    'P': '#c5eec9ff',
    'LUTHERAN': '#ebf1b1ff',
    'COLTON': 'rgb(116, 99, 209)',
    'DIEGO': 'rgb(204, 131, 48)',  
     'Patient Result': 'rgb(208, 219, 224)'
};

  const getGroupBckColor = (groupAntigens: string) => {

    return ANTIGENGROUP_BGDCOLOR[groupAntigens];
  };

  const renderGroupHeaders = () => {
    const groupedAntigens: { [key: string]: string[] } = {};
    antigens.forEach(antigen => {
      const group = getAntigenGroup(antigen);
      if (!groupedAntigens[group]) groupedAntigens[group] = [];
      groupedAntigens[group].push(antigen);
    });

    return (
      <View style={[
        styles.groupHeaderRow,
        { borderBottomColor: theme.colors.outline }
      ]}>
        <View style={[
          styles.cellHeader,
          { width: dimensions.cellNumberWidth },
          { height: dimensions.cellNumberWidth }
        ]}>
        </View>

        {/* <View style={[
          styles.cellHeader,
          { width: dimensions.donorIdWidth }
        ]}>
          <Text style={styles.headerText}>Cell</Text>
        </View> */}


        {Object.entries(groupedAntigens).map(([group, groupAntigens]) => (
          <View
            key={group}
            style={[
              styles.groupHeader,
              {
                width: getGroupWidth(groupAntigens),
                backgroundColor: getGroupBckColor(group) //theme.colors.surfaceVariant
              },
              { height: dimensions.cellNumberWidth },
            ]}
          >
            <Text
              style={[
                styles.groupText,
                {
                  color: '#101111b0',//theme.colors.onSurfaceVariant,
                  fontSize: Math.floor(dimensions.antigenWidth * 0.5) * zoomLevel // 30% of width
                }
              ]}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {group}
            </Text>
          </View>
        ))}
      </View>
    );
  };

  return (
    <View style={[
      styles.container,
      {
        backgroundColor: theme.colors.surface,
        borderBottomColor: theme.colors.outline
      }
    ]}>
      {renderGroupHeaders()}
      <View style={styles.antigenRow}>
        <View style={[
          styles.antigenHeader,
          {
            width: dimensions.antigenWidth,
            height: dimensions.antigenWidth, // At least 1.5x width or 45px
            borderColor: theme.colors.outline
          },
        ]}>

          <Text
            style={[
              styles.antigenText,
              {
                width: dimensions.antigenWidth,
                color: theme.colors.onSurface,
                fontSize: Math.floor(dimensions.antigenWidth * 0.3) * zoomLevel // 30% of width
              }
            ]}
            numberOfLines={2}
            adjustsFontSizeToFit
          >
            No
          </Text>

        </View>
        {antigens.map((antigen, index) => {
          // Determine width based on column type
          let columnWidth = dimensions.antigenWidth;

          if (antigen === 'Result') {
            columnWidth = dimensions.resultWidth;
          } else if (antigen === 'Grade' && dimensions.gradeWidth) {
            columnWidth = dimensions.gradeWidth;
          } else if (antigen === 'Check' && dimensions.checkWidth) {
            columnWidth = dimensions.checkWidth;
          }

          return (
            <AntigenHeader
              key={index}
              antigen={antigen}
              group={getAntigenGroup(antigen)}
              rules={rules}
              isSpecialAntigen={isSpecialAntigen(antigen)}
              isRuledOut={ruledOutAntigens.includes(antigen)}
              heterozygousCount={getHeterozygousCount(antigen)}
              onOverride={() => onAntigenOverride?.(antigen)}
              isLastInGroup={isLastInGroup(antigen)}
              width={columnWidth}
              onColumnLock={onColumnLock}
              lockedColumns={lockedColumns}
              zoomLevel={zoomLevel}
            />
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
  },
  groupHeaderRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
  },
  antigenRow: {
    flexDirection: 'row',
  },
  cellHeader: {
    padding: 4,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRightWidth: 1,
    borderRightColor: '#ccc',
  },
  headerText: {
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#333',
    ...Platform.select({
      ios: { fontWeight: '600' },
      android: { fontFamily: 'sans-serif-medium' }
    }),
  },
  groupHeader: {
    padding: 4,
    justifyContent: 'center',
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: '#ccc',
    backgroundColor: '#2fda38ff',
  }, //f0f0f0
  groupText: {
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#333',
    ...Platform.select({
      ios: { fontWeight: '600' },
      android: { fontFamily: 'sans-serif-medium' }
    }),
  },
  antigenHeader: {
    padding: 2,
    justifyContent: 'center',
    alignItems: 'center',
    borderRightWidth: 1,
    position: 'relative',
    backgroundColor: '#f8f8f8',
  },
  antigenText: {
    textAlign: 'center',
    fontWeight: 'bold',
    color: '#333',
    ...Platform.select({
      ios: { fontWeight: '600' },
      android: { fontFamily: 'sans-serif-medium' }
    }),
  },
  ruledOutText: {
    textDecorationLine: 'line-through',
    color: '#999',
    opacity: 0.5,
  },
  counterBadge: {
    position: 'absolute',
    zIndex: 2,
  },
  overrideIcon: {
    position: 'absolute',
    bottom: 0,
    right: -5,
    margin: 0,
    backgroundColor: 'transparent',
  },
  lastInGroupBorder: {
    borderRightWidth: 2,
    borderRightColor: '#000',
  }
});

export default Header;