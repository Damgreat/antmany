import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, ScrollView, TextInput, Dimensions, Platform, Animated } from 'react-native';
import { Text, useTheme, IconButton, Dialog, Button, Portal } from 'react-native-paper';
import { Cell } from './Cell';
import { Header } from './Header';
import {
  AntigenGroups,
  CellData,
  PanelData,
  RuleResult,
  AntigenRuleState,
} from '../../types';
import { useTableDimensions } from '../../utils/useTableDimentions';
import { FONTS, COLORS } from '../../constants/fonts';
import CustomText from '../../components/CustomText';

export interface PanelGridProps {
  panel: PanelData;
  rules: RuleResult[];
  ruleState: AntigenRuleState;
  combinedRuleState: AntigenRuleState;
  editable?: boolean;
  isRenderResultCell?: boolean;
  additionalCellCount?: number;
  onCellPress?: (index: number, antigenId: string) => void;
  onResultPress?: (index: number) => void;
  onGradePress?: (index: number) => void; // Add handler for Grade column
  onCheckPress?: (index: number) => void; // Add handler for Check column
  onAntigenOverride?: (antigen: string) => void;
  isAntigenRuledOut?: (antigen: string) => boolean;
  showHeaders?: boolean;
  stickyHeaders?: boolean;
  onRowDelete?: (index: number) => void;
  onColumnDelete?: (antigen: string) => void;
  onColumnLock?: (antigen: string) => void;
  lockedColumns?: string[];
  zoomLevel?: number;
  testingMethod?: 'Gel' | 'Tube'; // Add testing method prop
}

export const PanelGrid: React.FC<PanelGridProps> = ({
  panel,
  rules,
  ruleState,
  combinedRuleState,
  editable = false,
  isRenderResultCell = true,
  additionalCellCount = 3,
  onCellPress,
  onResultPress,
  onGradePress,
  onCheckPress,
  onAntigenOverride,
  isAntigenRuledOut,
  showHeaders = true,
  stickyHeaders = false,
  onRowDelete,
  onColumnDelete,
  onColumnLock,
  lockedColumns = [],
  zoomLevel: parentZoomLevel,
  testingMethod = 'tube' // Default to tube method
}) => {
  const theme = useTheme();
  const [internalZoomLevel, setInternalZoomLevel] = useState(1.0);
  const requestedZoomLevel = parentZoomLevel ?? internalZoomLevel;
  const zoomLevel = Number.isFinite(requestedZoomLevel) && requestedZoomLevel > 0
    ? requestedZoomLevel
    : 1.0;

  const [deleteDialogVisible, setDeleteDialogVisible] = useState(false);
  const [rowToDelete, setRowToDelete] = useState<number | null>(null);
  const [isEditingRowNumber, setIsEditingRowNumber] = useState(false);
  const [firstRowNumber, setFirstRowNumber] = useState(panel.cells[0]?.rowNumber || '1');
  const [deleteColumnDialogVisible, setDeleteColumnDialogVisible] = useState(false);
  const [columnToDelete, setColumnToDelete] = useState<string | null>(null);

  const scrollX = useRef(new Animated.Value(0)).current;
  const headerScrollRef = useRef<ScrollView>(null);
  const mainScrollRef = useRef<ScrollView>(null);
  const verticalScrollRef = useRef<ScrollView>(null);

  const MIN_ZOOM = 0.5;
  const MAX_ZOOM = 2.0;
  const ZOOM_STEP = 0.1;

  const [orientation, setOrientation] = useState(
    Dimensions.get('window').width > Dimensions.get('window').height ? 'landscape' : 'portrait'
  );

  useEffect(() => {
    const updateOrientation = () => {
      const { width, height } = Dimensions.get('window');
      setOrientation(width > height ? 'landscape' : 'portrait');
    };

    const dimensionsListener = Dimensions.addEventListener('change', updateOrientation);

    return () => {
      if (dimensionsListener && typeof dimensionsListener.remove === 'function') {
        dimensionsListener.remove();
      }
    };
  }, []);

  const handleScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { x: scrollX } } }],
    { useNativeDriver: false }
  );

  const syncScrollPosition = (position: number) => {
    if (headerScrollRef.current) {
      headerScrollRef.current.scrollTo({ x: position, y: 0, animated: false });
    }
    if (mainScrollRef.current) {
      mainScrollRef.current.scrollTo({ x: position, y: 0, animated: false });
    }
  };

  const showDeleteConfirmation = (index: number) => {
    setRowToDelete(index);
    setDeleteDialogVisible(true);
  };

  const handleDeleteConfirm = () => {
    if (rowToDelete !== null && onRowDelete) {
      onRowDelete(rowToDelete);
    }
    setDeleteDialogVisible(false);
    setRowToDelete(null);
  };

  const handleDeleteCancel = () => {
    setDeleteDialogVisible(false);
    setRowToDelete(null);
  };

  const startEditingRowNumber = () => {
    if (!isRenderResultCell && editable) {
      setIsEditingRowNumber(true);
    }
  };

  const finishEditingRowNumber = () => {
    setIsEditingRowNumber(false);
    if (isNaN(parseInt(firstRowNumber))) {
      setFirstRowNumber('1');
    }
  };

  const getRowNumber = (index: number) => {
    const baseNumber = parseInt(firstRowNumber) || 1;
    return (baseNumber + index).toString();
  };

  const fallbackGroups: AntigenGroups = {
    'ABScreen': ['ABO', 'RhD'],
    'Rh-hr': ['D', 'C', 'E', 'c', 'e', 'f', 'Cw', 'V'],
    'KELL': ['K', 'k', 'Kpa', 'Kpb', 'Jsa', 'Jsb'],
    'DUFFY': ['Fya', 'Fyb'],
    'KIDD': ['Jka', 'Jkb'],
    'SEX': ['Xga'],
    'LEWIS': ['Lea', 'Leb'],
    'MNS': ['S', 's', 'M', 'N'],
    'P': ['P1'],
    'LUTHERAN': ['Lua', 'Lub'],
    'COLTON': ['Coa', 'Cob'],
    'DIEGO': ['Dia', 'Dib'],
    'Patient Result': ['RXN', 'Check'] // Add Grade and Check
  };

  const ANTIGEN_GROUPS: AntigenGroups =
    panel.antigenGroups && Object.keys(panel.antigenGroups).length > 0
      ? panel.antigenGroups
      : fallbackGroups;

  const baseDimensions = useTableDimensions(ANTIGEN_GROUPS, additionalCellCount);

  const dimensions = {
    antigenWidth: Math.max(baseDimensions.antigenWidth * zoomLevel, 10),
    cellNumberWidth: Math.max(baseDimensions.antigenWidth * zoomLevel, 10),
    resultWidth: Math.max(baseDimensions.antigenWidth * zoomLevel, 10),
    gradeWidth: Math.max(baseDimensions.antigenWidth * zoomLevel, 10), // Add Grade width
    checkWidth: Math.max(baseDimensions.antigenWidth * zoomLevel, 10), // Add Check width
    donorIdWidth: Math.max(baseDimensions.antigenWidth * zoomLevel, 10),
  };

  const getAntigenGroup = (antigen: string): string => {
    for (const [group, antigens] of Object.entries(ANTIGEN_GROUPS)) {
      if (antigens.includes(antigen)) {
        return group;
      }
    }
    return '';
  };

  const isLastInGroup = (antigen: string): boolean => {
    const group = getAntigenGroup(antigen);
    const groupAntigens = ANTIGEN_GROUPS[group] || [];
    return groupAntigens[groupAntigens.length - 1] === antigen;
  };

  const isSpecialAntigen = (antigen: string): boolean => {
    return ['C', 'E', 'K'].includes(antigen);
  };

  const shouldShowRuleIndicator = (cell: CellData, antigen: string): { show: boolean; type: 'X' | 'slash' | null } => {
    // Skip for special columns
    if (antigen === 'Grade' || antigen === 'Check') {
      return { show: false, type: null };
    }

    if (testingMethod === 'gel') {
      // For gel method, check all possible positive result formats
      if (!['0'].includes(cell.results['result'])) {
        return { show: false, type: null };
      }
    } else {
      // For tube method
      if (cell.results['result'] !== '0') {
        return { show: false, type: null };
      }
    }

    const value = cell.results[antigen];
    if (value !== '+') {
      return { show: false, type: null };
    }

    if (isSpecialAntigen(antigen)) {
      const lowerAntigen = antigen.toLowerCase();
      if (cell.results[lowerAntigen] === '+') {
        return { show: true, type: 'slash' };
      }
      if (cell.results[lowerAntigen] === '0') {
        return { show: true, type: 'X' };
      }
    } else {
      return { show: true, type: 'X' };
    }

    return { show: false, type: null };
  };

  // Render the Result cell
  const renderResultCell = (cell: CellData, index: number) => {
    const result = cell.results['result'] || '';

    // Define styles based on result value and testing method
    let resultStyle = {};
    let resultColor = theme.colors.onSurface;

    // Special styles for gel method
    if (['MF', '1+', '2+', '3+', '4+', '+', 'W+'].includes(result)) {
      resultStyle = { backgroundColor: '#DCEDC8' }; // Light green
      resultColor = '#33691E'; // Dark green text
    } else if (result === '0') {
      resultStyle = { backgroundColor: '#FFCDD2' }; // Light red
      resultColor = '#D32F2F'; // Dark red text
    }

    return (
      <TouchableOpacity
        style={[
          styles.resultCell,
          resultStyle,
          { borderColor: theme.colors.outline },
          { width: dimensions.resultWidth },
          { height: dimensions.resultWidth * 0.95 }
        ]}
        onPress={() => onResultPress?.(index)}
        disabled={!editable}
      >
        <Text
          style={[
            styles.resultText,
            {
              color: resultColor,
              fontSize: Math.max(12 * zoomLevel, 8)
            }
          ]}
        >
          {result}
        </Text>
      </TouchableOpacity>
    );
  };

  // Render the Grade cell
  const renderGradeCell = (cell: CellData, index: number) => {
    const grade = cell.results['Grade'] || '';

    // Define styles based on grade value
    let gradeStyle = {};
    let gradeColor = theme.colors.onSurface;

    if (['1+', '2+', '3+', '4+'].includes(grade)) {
      // Red intensity increasing with grade number
      const intensity = parseInt(grade.charAt(0)) * 30 + 100;
      gradeStyle = { backgroundColor: `rgba(255, ${255 - intensity}, ${255 - intensity}, 0.2)` };
      gradeColor = '#D32F2F'; // Dark red text
    } else if (grade === 'MF') {
      gradeStyle = { backgroundColor: '#E8F5E9' }; // Light green
      gradeColor = '#388E3C'; // Dark green text
    } else if (grade === 'W+') {
      gradeStyle = { backgroundColor: '#FFF8E1' }; // Light amber
      gradeColor = '#FFA000'; // Amber text
    }

    return (
      <TouchableOpacity
        style={[
          styles.gradeCell,
          gradeStyle,
          { borderColor: theme.colors.outline },
          { width: dimensions.gradeWidth },
          { height: dimensions.gradeWidth * 0.95 }
        ]}
        onPress={() => onGradePress?.(index)}
        disabled={!editable}
      >
        <Text
          style={[
            styles.gradeText,
            {
              color: gradeColor,
              fontSize: Math.max(12 * zoomLevel, 8)
            }
          ]}
        >
          {grade}
        </Text>
      </TouchableOpacity>
    );
  };

  // Render the Check cell
  const renderCheckCell = (cell: CellData, index: number) => {
    const check = cell.results['Check'] || '';

    // Define styles
    const checkStyle = check === '✓' ?
      { backgroundColor: '#E8F5E9' } : // Light green if checked
      {};
    const checkColor = check === '✓' ? '#4CAF50' : theme.colors.onSurface;

    return (
      <TouchableOpacity
        style={[
          styles.checkCell,
          checkStyle,
          { borderColor: theme.colors.outline },
          { width: dimensions.checkWidth },
          { height: dimensions.checkWidth * 0.95 },
        ]}
        onPress={() => onCheckPress?.(index)}
        disabled={!editable}
      >
        <Text
          style={[
            styles.checkText,
            {
              color: checkColor,
              fontSize: Math.max(12 * zoomLevel, 10)
            }
          ]}
        >
          {check}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderCell = (cell: CellData, cellIndex: number, antigen: string, index: number) => {
    // Special handling for Grade and Check columns
    // if (antigen === 'Grade') {
    //   return renderGradeCell(cell, cellIndex);
    // }

    // if (antigen === 'Check') {
    //   return renderCheckCell(cell, cellIndex);
    // }

    // Regular antigen cell rendering
    const value = cell.results[antigen];
    const ruledOut = isAntigenRuledOut?.(antigen) ??
      (combinedRuleState[antigen]?.isRuledOut || ruleState[antigen]?.isRuledOut);

    const { show: showIndicator, type: ruleIndicator } = shouldShowRuleIndicator(cell, antigen);
    const currentGroup = getAntigenGroup(antigen);

    return (
      <View
        key={`${cell.cellId}-${antigen}`}
        style={[
          styles.cellContainer,
          index === 0 && styles.firstInGroup,
          { width: dimensions.antigenWidth }
        ]}
      >
        <Cell
          value={value}
          onPress={() => onCellPress?.(cellIndex, antigen)}
          editable={editable}
          highlighted={showIndicator}
          isShaded={ruledOut}
          ruleIndicator={ruleIndicator}
          isLastInGroup={isLastInGroup(antigen)}
          groupName={currentGroup}
          width={dimensions.antigenWidth}
          zoomLevel={zoomLevel}
        />
      </View>
    );
  };

  const renderDonorCell = (cell: CellData) => (
    <View style={[
      styles.donorCell,
      {
        width: dimensions.donorIdWidth,
        backgroundColor: theme.colors.surfaceVariant
      }
    ]}>
      <Text style={[
        styles.cellId,
        {
          color: theme.colors.onSurfaceVariant,
          fontSize: 12 * zoomLevel
        }
      ]}>
        {cell.cellId}
      </Text>
      <Text style={[
        styles.donorNumber,
        {
          color: theme.colors.onSurfaceVariant,
          fontSize: 11 * zoomLevel
        }
      ]}>
        {cell.donorNumber}
      </Text>
    </View>
  );

  const renderCellNumber = (cell: CellData, index: number, isFirst = false) => {
    const shouldBeEditable = index === 0 && !isRenderResultCell && editable && isFirst;

    if (shouldBeEditable && isEditingRowNumber) {
      return (
        <View style={[
          styles.cellNumber,
          { width: dimensions.cellNumberWidth }
        ]}>
          <TextInput
            style={[
              styles.cellNumberInput,
              { fontSize: 10 * zoomLevel }
            ]}
            value={firstRowNumber}
            onChangeText={setFirstRowNumber}
            keyboardType="numeric"
            onBlur={finishEditingRowNumber}
            autoFocus
            selectTextOnFocus
            maxLength={3}
          />
        </View>
      );
    }

    return (
      <TouchableOpacity
        style={[
          styles.cellNumber,
          { width: dimensions.cellNumberWidth }
        ]}
        onPress={() => shouldBeEditable && startEditingRowNumber()}
        disabled={!shouldBeEditable}
      >
        <Text style={[
          styles.cellNumberText,
          shouldBeEditable && styles.editableCellNumber,
          { fontSize: 10 * zoomLevel }
        ]}>
          {index === 0 ? firstRowNumber : getRowNumber(index)}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderDeleteButton = (index: number) => {
    if (!editable || !onRowDelete || isRenderResultCell) return null;

    return (
      <TouchableOpacity
        style={[styles.deleteButton, { width: dimensions.cellNumberWidth }]}
        onPress={() => showDeleteConfirmation(index)}
      >
        <IconButton
          icon="delete"
          size={16 * zoomLevel}
          iconColor={theme.colors.error}
        />
      </TouchableOpacity>
    );
  };

  const getRuledOutAntigens = () => {
    return panel.antigens.filter(antigen =>
      isAntigenRuledOut?.(antigen) ??
      (combinedRuleState[antigen]?.isRuledOut || ruleState[antigen]?.isRuledOut)
    );
  };

  const renderHeaderContent = () => {
    const panelAntigens = [...panel.antigens];

    return (
      <Header
        antigens={[
          ...panelAntigens,
          'No',
          ...(isRenderResultCell ? testingMethod === 'Tube' ? ['RXN', 'Check'] : ['RXN'] : [])
        ]}
        antigenGroups={ANTIGEN_GROUPS}
        rules={rules}
        onAntigenOverride={onAntigenOverride}
        ruledOutAntigens={getRuledOutAntigens()}
        dimensions={dimensions}
        zoomLevel={zoomLevel}
        onColumnLock={onColumnLock}
        lockedColumns={lockedColumns}
      />
    );
  };

  const isColumnLocked = (antigen: string): boolean => {
    return lockedColumns.includes(antigen);
  };

  const showDeleteColumnConfirmation = (antigen: string) => {
    setColumnToDelete(antigen);
    setDeleteColumnDialogVisible(true);
  };

  const handleDeleteColumnConfirm = () => {
    if (columnToDelete !== null && onColumnDelete) {
      onColumnDelete(columnToDelete);
    }
    setDeleteColumnDialogVisible(false);
    setColumnToDelete(null);
  };

  const handleDeleteColumnCancel = () => {
    setDeleteColumnDialogVisible(false);
    setColumnToDelete(null);
  };

  const handleToggleColumnLock = (antigen: string) => {
    if (onColumnLock) {
      onColumnLock(antigen);
    }
  };

  const renderColumnActions = () => {
    if (!editable || (!onColumnDelete && !onColumnLock)) return null;

    return (
      <View style={styles.columnActionsRow}>
        <View style={[styles.cellNumber, { width: dimensions.cellNumberWidth }]}>
        </View>

        <View style={styles.cellsRow}>
          {panel.antigens.map((antigen, index) => (
            <View
              key={`action-${antigen}`}
              style={[
                styles.columnActionCell,
                { width: dimensions.antigenWidth }
              ]}
            >
              <View style={styles.columnActionButtons}>
                {/* {onColumnLock && (
                  <TouchableOpacity style={[
                    { width: dimensions.antigenWidth / 2 }
                  ]} onPress={() => handleToggleColumnLock(antigen)}>
                    <IconButton
                      style={[{ width: dimensions.antigenWidth / 2, height: dimensions.antigenWidth / 2, left: -dimensions.antigenWidth / 4 }]}
                      icon={isColumnLocked(antigen) ? "lock" : "lock-open"}
                      size={8 * zoomLevel}
                      iconColor={isColumnLocked(antigen) ? theme.colors.primary : theme.colors.onSurfaceVariant}
                    />
                  </TouchableOpacity>
                )} */}

                {onColumnDelete && (
                  <TouchableOpacity style={[
                    { width: dimensions.antigenWidth / 2 }
                  ]} onPress={() => showDeleteColumnConfirmation(antigen)}>
                    <IconButton
                      style={[{ width: dimensions.antigenWidth / 2, height: dimensions.antigenWidth / 2, left: -dimensions.antigenWidth / 8 }]}
                      icon="trash-can"
                      size={8 * zoomLevel}
                      iconColor={theme.colors.error}
                    />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ))}

          {/* Add space for the other cells as needed */}
          <View style={{ width: dimensions.cellNumberWidth }} />
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.tableContainer}>
        {stickyHeaders && showHeaders && (
          <View style={styles.stickyHeaderWrapper}>
            <Animated.ScrollView
              ref={headerScrollRef}
              horizontal
              showsHorizontalScrollIndicator={false}
              scrollEventThrottle={1}
              onScroll={handleScroll}
              style={styles.stickyHeaderScroll}
              contentContainerStyle={{ flexGrow: 1 }}
            >
              {renderHeaderContent()}
            </Animated.ScrollView>
          </View>
        )}

        <View style={[styles.scrollContainer, stickyHeaders && showHeaders && { paddingTop: dimensions.antigenWidth * 2 - 6 }]}>
          <Animated.ScrollView
            ref={mainScrollRef}
            horizontal
            showsHorizontalScrollIndicator={true}
            scrollEventThrottle={1}
            onScroll={handleScroll}
            contentContainerStyle={{ flexGrow: 1 }}
          >
            <View style={styles.gridWrapper}>
              {!stickyHeaders && showHeaders && (
                <View style={styles.headerWrapper}>
                  {renderHeaderContent()}
                </View>
              )}

              <ScrollView
                ref={verticalScrollRef}
                showsVerticalScrollIndicator={true}
                style={styles.verticalScroll}
                contentContainerStyle={{ flexGrow: 1 }}
              >
                <View style={styles.gridContent}>
                  {panel.cells.map((cell, index) => (
                    <View
                      key={index}
                      style={[
                        styles.row,
                        {
                          borderBottomColor: theme.colors.outlineVariant,
                          height: dimensions.antigenWidth
                        }
                      ]}
                    >
                      {renderCellNumber(cell, index, true)}

                      <View style={styles.cellsRow}>
                        {panel.antigens.map((antigen, antigenIndex) =>
                          renderCell(cell, index, antigen, antigenIndex)
                        )}

                        {renderCellNumber(cell, index)}
                        {/* {renderDeleteButton(index)} */}
                        {isRenderResultCell && renderResultCell(cell, index)}
                        {isRenderResultCell && testingMethod === 'Tube' && renderCheckCell(cell, index)}
                      </View>
                    </View>
                  ))}

                  {renderColumnActions()}
                </View>
              </ScrollView>
            </View>
          </Animated.ScrollView>
        </View>
      </View>

      <Portal>
        <Dialog visible={deleteDialogVisible} onDismiss={handleDeleteCancel}>
          <Dialog.Title>Confirm Deletion</Dialog.Title>
          <Dialog.Content>
            <Text>Are you sure you want to remove this row?</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={handleDeleteCancel}>Cancel</Button>
            <Button onPress={handleDeleteConfirm} textColor={theme.colors.error}>Delete</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <Portal>
        <Dialog visible={deleteColumnDialogVisible} onDismiss={handleDeleteColumnCancel}>
          <Dialog.Title>Confirm Column Deletion</Dialog.Title>
          <Dialog.Content>
            <Text>Are you sure you want to remove the {columnToDelete} column?</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={handleDeleteColumnCancel}>Cancel</Button>
            <Button onPress={handleDeleteColumnConfirm} textColor={theme.colors.error}>Delete</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
};

const styles = StyleSheet.create({
    midText: {
    fontSize: 12,
    color: COLORS.TEXT,
    textAlign: 'center',
    fontFamily: FONTS.POPPINS_BOLD,
  },
  container: {
    flex: 1,
    flexDirection: 'column',
  },
  tableContainer: {
    flex: 1,
    position: 'relative',
  },
  stickyHeaderWrapper: {
    position: 'absolute',
    top: 0,
    left: 8,
    right: 8,
    zIndex: 5,
    borderRightWidth: 1,
    borderLeftWidth: 1,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
    borderColor: '#ccc',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 3,
    overflow: 'hidden'
  },
  stickyHeaderScroll: {
    width: '100%',
  },
  scrollContainer: {
    flex: 1
  },
  headerWrapper: {
    backgroundColor: 'white',
    zIndex: 2,
  },
  gridWrapper: {
    flex: 1,
    flexDirection: 'column',
    borderWidth: 1,
    borderColor: '#ccc',
    backgroundColor: 'white',
    margin: 8,
  },
  verticalScroll: {
    flex: 1,
  },
  gridContent: {
    flex: 1
  },
  row: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    alignItems: 'center',
  },
  cellsRow: {
    flexDirection: 'row',
    flex: 1,
    alignItems: 'center',
  },
  cellNumber: {
    padding: 0,
    justifyContent: 'center',
    alignItems: 'center',
    borderColor: '#ccc',
  },
  cellNumberText: {
    fontWeight: 'bold',
    color: '#333',
  },
  editableCellNumber: {
    color: 'blue',
    textDecorationLine: 'underline',
  },
  cellNumberInput: {
    textAlign: 'center',
    padding: 2,
    fontWeight: 'bold',
    color: 'blue',
    backgroundColor: '#f0f0f0',
    borderColor: '#ccc',
    width: '100%',
    height: '100%',
  },
  cellContainer: {
    padding: 0,
  },
  firstInGroup: {
    marginLeft: 0,
  },
  resultCell: {
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ccc',
    marginLeft: 0,
    borderLeftWidth: 1,
  },
  gradeCell: {
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ccc',
    margin: 0,
  },
  checkCell: {
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ccc',
    margin: 0,
  },
  resultText: {
    fontWeight: 'bold',
    color: '#333',
  },
  gradeText: {
    fontWeight: 'bold',
    color: '#333',
  },
  checkText: {
    fontWeight: 'bold',
    color: '#333',
  },
  deleteButton: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  donorCell: {
    justifyContent: 'center',
    alignItems: 'center',
    borderRightWidth: 1,
    borderColor: '#ccc',
    backgroundColor: '#6B96AC',
  },
  cellId: {
    fontWeight: 'bold',
    marginBottom: 4,
    color: '#ffffff',
  },
  donorNumber: {
    color: '#ffffff',
  },
  columnActionsRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
    backgroundColor: '#f9f9f9',
    // padding: 4,
  },
  columnActionCell: {
    alignItems: 'center',
    justifyContent: 'space-around',
    borderRightWidth: 1,
    borderLeftWidth: 1,
    borderColor: '#ccc',
    // padding: 4,
  },
  columnActionButtons: {
    flexDirection: 'row',
    // justifyContent: 'space-around',
    // alignItems: 'center',
    width: '100%',
  },
});
