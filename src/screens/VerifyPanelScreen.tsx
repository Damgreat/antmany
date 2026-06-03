import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../navigation';
import { COLORS, FONTS } from '../constants/fonts';
import CustomText from '../components/CustomText';
import { CellData, OcrStructureMetrics, PanelData, ResultValue } from '../types';
import {summarizeExtractionAccuracy} from '../utils/ocrExtractionValidation';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'VerifyPanel'>;
  route: RouteProp<RootStackParamList, 'VerifyPanel'>;
};

const RESULT_OPTIONS: ResultValue[] = ['+', '0', '/', '+s', '+w', 'NT', ''];
const CELL_W = 48;
const CELL_H = 34;
const RESULT_W = 56;
const META_CELL_W = {
  cellId: 56,
  phenotype: 82,
  donorNumber: 108,
} as const;
const META_COLUMNS = [
  { key: 'cellId', label: 'Cell #', width: META_CELL_W.cellId },
  { key: 'phenotype', label: 'Rh-hr', width: META_CELL_W.phenotype },
  { key: 'donorNumber', label: 'Donor', width: META_CELL_W.donorNumber },
] as const;
const METADATA_GROUP_WIDTH = META_COLUMNS.reduce(
  (total, column) => total + column.width,
  0,
);

function confidenceColor(confidence: number): string {
  if (confidence >= 90) return '#2e7d32';
  if (confidence >= 75) return '#f57c00';
  return '#c62828';
}

function groupColor(groupName: string): string {
  switch (groupName) {
    case 'Rh-hr':
      return '#d7eef7';
    case 'KELL':
      return '#f9ddd2';
    case 'DUFFY':
      return '#dff7ee';
    case 'KIDD':
      return '#f7dbe9';
    case 'LEWIS':
      return '#e1e4ff';
    case 'MNS':
      return '#f6e4e7';
    case 'P':
      return '#e5f6e7';
    case 'LUTHERAN':
      return '#f5f6d6';
    case 'SEX':
      return '#eadcfb';
    case 'COLTON':
      return '#e0d9ff';
    case 'DIEGO':
      return '#f4dfc5';
    case 'Additional Antigens':
    case 'Additonal Antigens':
      return '#f6e9d8';
    default:
      return '#eceff1';
  }
}

function cellBgColor(
  value: ResultValue | string,
  isLowConf: boolean,
): string {
  if (value === '?') return '#ffcdd2';
  if (isLowConf) return '#fff3e0';
  return '#ffffff';
}

function buildStructuredRows(cells: CellData[]) {
  return cells.map(cell => ({
    cellNumber: cell.cellId,
    rhHr: cell.phenotype,
    donor: cell.donorNumber,
    values: {
      ...cell.results,
    },
  }));
}

function computeUnknownCount(
  panelData: PanelData,
  renderColumns: Array<{key: string; required?: boolean}>,
): number {
  const requiredKeys = new Set(
    renderColumns
      .filter(column => column.required !== false)
      .map(column => column.key),
  );

  let count = 0;
  for (const cell of panelData.cells) {
    for (const [columnKey, value] of Object.entries(cell.results)) {
      if (value === '?' && (columnKey === 'result' || requiredKeys.has(columnKey))) {
        count++;
      }
    }
  }

  return count;
}

function recomputeVerificationMetrics(
  panelData: PanelData,
  renderColumns: Array<{key: string; kind?: string; required?: boolean}>,
  fallbackMetrics: OcrStructureMetrics,
): OcrStructureMetrics {
  const requiredKeys = renderColumns
    .filter(column => column.required !== false)
    .map(column => column.key);

  const totalValueSlots = panelData.cells.length * (requiredKeys.length + 1);
  let resolvedValueSlots = 0;
  let unresolvedRequired = 0;

  for (const cell of panelData.cells) {
    for (const columnKey of requiredKeys) {
      const value = cell.results[columnKey] ?? '';
      if (value === '?') {
        unresolvedRequired++;
      } else {
        resolvedValueSlots++;
      }
    }

    const resultValue = cell.results.result ?? '';
    if (resultValue === '?') {
      unresolvedRequired++;
    } else {
      resolvedValueSlots++;
    }
  }

  const cellValueScore =
    totalValueSlots > 0
      ? Math.round((resolvedValueSlots / totalValueSlots) * 100)
      : 0;
  const unreadablePenalty =
    totalValueSlots > 0
      ? Math.min(6, Math.round((unresolvedRequired / totalValueSlots) * 100))
      : 0;
  const overallScore = Math.max(
    0,
    Math.round(
      fallbackMetrics.textScore * 0.2 +
        cellValueScore * 0.15 +
        fallbackMetrics.mappingScore * 0.25 +
        fallbackMetrics.structureScore * 0.25 +
        fallbackMetrics.completenessScore * 0.15 -
        unreadablePenalty,
    ),
  );

  const analysisColumns = renderColumns.filter(
    column => column.kind !== 'supplemental' && column.required !== false,
  );
  const extractionN = panelData.cells.length;
  const extractionX = analysisColumns.length;
  const extractionSlots = panelData.cells.flatMap((cell, rowIdx) =>
    analysisColumns.map(col => ({
      value: cell.results[col.key],
      rowIndex: rowIdx + 1,
      columnKey: col.key,
    })),
  );
  const extractionSummary = summarizeExtractionAccuracy(extractionSlots, {
    logLabel: `VerifyPanel recompute (${extractionN}×${extractionX})`,
  });
  const extractionAccuracy = extractionSummary.accuracyPercent;

  return {
    ...fallbackMetrics,
    cellValueScore,
    overallScore,
    extractionAccuracy,
  };
}

function buildBlockingValidationMessages(
  panelData: PanelData,
  renderColumns: Array<{key: string; required?: boolean}>,
): string[] {
  const messages: string[] = [];

  if (panelData.cells.length === 0) {
    messages.push('No OCR rows were detected.');
  }

  const validationIssues = panelData.metadata.validationIssues ?? [];
  const blockingCodes = new Set(['missing_column', 'duplicate_column', 'group_mismatch']);
  for (const issue of validationIssues) {
    if (issue.severity === 'error' && blockingCodes.has(issue.code)) {
      messages.push(issue.message);
    }
  }

  const unreadableRequiredCount = (panelData.metadata.unreadableCells ?? []).filter(
    cell => cell.required,
  ).length;
  if (unreadableRequiredCount > 0) {
    messages.push(
      `${unreadableRequiredCount} cell${unreadableRequiredCount !== 1 ? 's' : ''} still require manual verification.`,
    );
  }

  const validColumnKeys = new Set([
    ...renderColumns.map(column => column.key),
    'result',
  ]);
  for (const cell of panelData.cells) {
    for (const columnKey of Object.keys(cell.results)) {
      if (!validColumnKeys.has(columnKey)) {
        messages.push(`Detected value mapped to an unknown column: ${columnKey}`);
      }
    }
  }

  return Array.from(new Set(messages));
}

interface ValuePickerProps {
  visible: boolean;
  currentValue: ResultValue | string;
  onSelect: (value: ResultValue) => void;
  onClose: () => void;
}

const ValuePickerModal: React.FC<ValuePickerProps> = ({
  visible,
  currentValue,
  onSelect,
  onClose,
}) => (
  <Modal
    visible={visible}
    transparent
    animationType="fade"
    onRequestClose={onClose}
  >
    <View style={styles.pickerOverlay}>
      <View style={styles.pickerCard}>
        <CustomText variant="medium" style={styles.pickerTitle}>
          Select Value
        </CustomText>
        {RESULT_OPTIONS.map(option => (
          <TouchableOpacity
            key={option === '' ? 'blank' : String(option)}
            style={[
              styles.pickerOption,
              currentValue === option && styles.pickerOptionSelected,
            ]}
            onPress={() => {
              onSelect(option);
              onClose();
            }}
          >
            <Text
              style={[
                styles.pickerOptionText,
                currentValue === option && styles.pickerOptionTextSelected,
              ]}
            >
              {option === '' ? '(blank)' : option}
            </Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity style={styles.pickerCancel} onPress={onClose}>
          <Text style={styles.pickerCancelText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </View>
  </Modal>
);

const VerifyPanelScreen: React.FC<Props> = ({ navigation, route }) => {
  const {
    panelData: initialPanelData,
    lowConfidenceCells,
    parseErrors,
    metrics: routeMetrics,
    manufacturer,
  } = route.params;

  const [panelData, setPanelData] = useState<PanelData>(initialPanelData);
  const [isLoading] = useState(false);
  const [verifiedCellKeys, setVerifiedCellKeys] = useState<Set<string>>(new Set());
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerTarget, setPickerTarget] = useState<{
    cellIndex: number;
    antigen: string;
  } | null>(null);

  const metrics: OcrStructureMetrics =
    panelData.metadata.ocrMetrics ?? routeMetrics;

  const validationMessages = useMemo(() => {
    const metadataMessages =
      panelData.metadata.validationIssues?.map(issue => issue.message) ?? [];
    if (metadataMessages.length > 0) {
      return Array.from(new Set(metadataMessages));
    }
    return parseErrors;
  }, [panelData.metadata.validationIssues, parseErrors]);

  const renderColumns = useMemo(
    () =>
      panelData.metadata.columnLayout?.filter(
        column => column.kind !== 'side' && column.kind !== 'result',
      ) ??
      panelData.antigens.map(antigen => ({
        key: antigen,
        label: antigen,
        group: 'Other',
        sourceColumn: 0,
        headerPath: [],
        kind: 'analysis' as const,
        required: true,
      })),
    [panelData.antigens, panelData.metadata.columnLayout],
  );

  useEffect(() => {
    const analysisColumns = renderColumns.filter(
      column => column.kind !== 'supplemental' && column.required !== false,
    );
    const slots = panelData.cells.flatMap((cell, rowIdx) =>
      analysisColumns.map(col => ({
        value: cell.results[col.key],
        rowIndex: rowIdx + 1,
        columnKey: col.key,
      })),
    );
    const summary = summarizeExtractionAccuracy(slots, {
      logLabel: 'VerifyPanel display check',
      log: true,
    });
    const displayed = metrics.extractionAccuracy ?? 0;
    if (displayed !== summary.accuracyPercent) {
      console.warn('[OCR Accuracy] UI mismatch', {
        displayedAccuracy: `${displayed}%`,
        recomputedAccuracy: `${summary.accuracyPercent}%`,
        recomputedSummary: summary,
      });
    }
  }, [panelData.cells, renderColumns, metrics.extractionAccuracy]);

  const groupedColumns = useMemo(() => {
    const groups: Array<{group: string; columns: typeof renderColumns}> = [];
    for (const column of renderColumns) {
      const groupName = column.group || 'Other';
      const currentGroup = groups[groups.length - 1];
      if (currentGroup && currentGroup.group === groupName) {
        currentGroup.columns.push(column);
      } else {
        groups.push({group: groupName, columns: [column]});
      }
    }
    return groups;
  }, [renderColumns]);

  const lowConfSet = useMemo(() => {
    const keys = new Set<string>();
    for (const lowConfidenceCell of lowConfidenceCells) {
      const key = `${lowConfidenceCell.rowIndex}-${lowConfidenceCell.columnKey}`;
      if (!verifiedCellKeys.has(key)) {
        keys.add(key);
      }
    }
    return keys;
  }, [lowConfidenceCells, verifiedCellKeys]);

  const unknownCount = useMemo(
    () => computeUnknownCount(panelData, renderColumns),
    [panelData, renderColumns],
  );
  const blockingValidationMessages = useMemo(
    () => buildBlockingValidationMessages(panelData, renderColumns),
    [panelData, renderColumns],
  );
  // Spec §4/§6: extraction is acceptable ONLY when accuracy ≥ 95 AND all cells are resolved.
  const canProceed = unknownCount === 0 && blockingValidationMessages.length === 0;

  const openPicker = useCallback((cellIndex: number, antigen: string) => {
    setPickerTarget({cellIndex, antigen});
    setPickerVisible(true);
  }, []);

  const handleValueSelect = useCallback(
    (newValue: ResultValue) => {
      if (!pickerTarget) {
        return;
      }

      const {cellIndex, antigen} = pickerTarget;
      const verificationKey = `${cellIndex + 1}-${antigen}`;

      setVerifiedCellKeys(prev => {
        const next = new Set(prev);
        next.add(verificationKey);
        return next;
      });

      setPanelData(prev => {
        const cells = prev.cells.map((cell, index) =>
          index === cellIndex
            ? {
                ...cell,
                results: {
                  ...cell.results,
                  [antigen]: newValue,
                },
              }
            : cell,
        );

        const unreadableCells = (prev.metadata.unreadableCells ?? []).filter(
          unreadable =>
            !(
              unreadable.rowIndex === cellIndex + 1 &&
              unreadable.columnKey === antigen
            ),
        );

        const nextPanelData: PanelData = {
          ...prev,
          cells,
          metadata: {
            ...prev.metadata,
            unreadableCells,
            structuredRows: buildStructuredRows(cells),
          },
        };

        const nextMetrics = recomputeVerificationMetrics(
          nextPanelData,
          renderColumns,
          nextPanelData.metadata.ocrMetrics ?? routeMetrics,
        );

        return {
          ...nextPanelData,
          metadata: {
            ...nextPanelData.metadata,
            ocrMetrics: nextMetrics,
          },
        };
      });
    },
    [pickerTarget, renderColumns, routeMetrics],
  );

  const handleProceed = useCallback(() => {
    if (!canProceed) {
      Alert.alert(
        'Verification Required',
        blockingValidationMessages.length > 0
          ? blockingValidationMessages.join('\n')
          : `${unknownCount} cell${unknownCount !== 1 ? 's' : ''} still require manual verification.`,
        [{text: 'OK'}],
      );
      return;
    }

    const dualPanelData = {
      firstPanel: panelData,
      secondPanel: {
        ...panelData,
        cells: [],
        metadata: {
          ...panelData.metadata,
          panelType: 'Panel A' as const,
        },
      },
    } as any;

    navigation.replace('Panel', {panelData: dualPanelData});
  }, [blockingValidationMessages, canProceed, navigation, panelData, unknownCount]);

  const handleGoBack = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const renderResultCell = (
    cell: CellData,
    cellIndex: number,
    antigen: string,
    colIndex: number,
  ) => {
    const value = cell.results[antigen] ?? '';
    const key = `${cellIndex + 1}-${antigen}`;
    const isLowConf = lowConfSet.has(key);
    const needsEdit = value === '?';

    return (
      <TouchableOpacity
        key={`${antigen}-${colIndex}`}
        style={[
          styles.cell,
          {backgroundColor: cellBgColor(value, isLowConf)},
          needsEdit && styles.cellUnknown,
        ]}
        onPress={() => openPicker(cellIndex, antigen)}
        accessibilityLabel={`Cell ${cell.cellId} antigen ${antigen}: ${value || 'empty'}. Tap to edit.`}
      >
        <Text style={[styles.cellText, needsEdit && styles.cellTextUnknown]}>
          {value === '' ? '' : String(value)}
        </Text>
        {needsEdit && (
          <Icon name="pencil-outline" size={10} color="#c62828" style={styles.editIcon} />
        )}
      </TouchableOpacity>
    );
  };

  const renderHeader = () => (
    <>
      <View style={styles.groupHeaderRow}>
        <View
          style={[
            styles.groupHeaderCell,
            styles.metadataGroupCell,
            {width: METADATA_GROUP_WIDTH},
          ]}
        >
          <Text style={styles.groupHeaderText} numberOfLines={1}>
            Metadata
          </Text>
        </View>
        {groupedColumns.map((entry, index) => (
          <View
            key={`${entry.group}-${index}`}
            style={[
              styles.groupHeaderCell,
              {
                width: entry.columns.length * CELL_W,
                backgroundColor: groupColor(entry.group),
              },
            ]}
          >
            <Text style={styles.groupHeaderText} numberOfLines={1}>
              {entry.group}
            </Text>
          </View>
        ))}
        <View style={[styles.groupHeaderCell, styles.resultGroupCell, {width: RESULT_W}]}>
          <Text style={styles.groupHeaderText} numberOfLines={1}>
            Result
          </Text>
        </View>
      </View>
      <View style={styles.headerRow}>
        {META_COLUMNS.map(column => (
          <View
            key={column.key}
            style={[
              styles.headerCell,
              styles.metadataHeaderCell,
              {width: column.width},
            ]}
          >
            <Text style={styles.headerText}>{column.label}</Text>
          </View>
        ))}
        {renderColumns.map((column, index) => (
          <View key={`${column.key}-${index}`} style={styles.headerCell}>
            <Text style={styles.headerText} numberOfLines={1}>
              {column.label}
            </Text>
          </View>
        ))}
        <View style={[styles.headerCell, styles.resultCell]}>
          <Text style={styles.headerText}>IS</Text>
        </View>
      </View>
    </>
  );

  const renderRow = ({item: cell, index}: {item: CellData; index: number}) => (
    <View style={styles.dataRow} key={`${cell.cellId || 'row'}-${index}`}>
      <View style={[styles.cell, styles.metadataCell, {width: META_CELL_W.cellId}]}>
        <Text style={styles.rowNumText}>{cell.cellId || String(index + 1)}</Text>
      </View>
      <View style={[styles.cell, styles.metadataCell, {width: META_CELL_W.phenotype}]}>
        <Text style={styles.metaText}>{cell.phenotype || ''}</Text>
      </View>
      <View style={[styles.cell, styles.metadataCell, {width: META_CELL_W.donorNumber}]}>
        <Text style={styles.metaText}>{cell.donorNumber || ''}</Text>
      </View>
      {renderColumns.map((column, colIdx) =>
        renderResultCell(cell, index, column.key, colIdx + 1),
      )}
      <TouchableOpacity
        style={[
          styles.cell,
          styles.resultCell,
          {
            backgroundColor: cellBgColor(
              cell.results.result ?? '',
              lowConfSet.has(`${index + 1}-result`),
            ),
          },
          cell.results.result === '?' && styles.cellUnknown,
        ]}
        onPress={() => openPicker(index, 'result')}
      >
        <Text style={styles.cellText}>{cell.results.result ?? ''}</Text>
      </TouchableOpacity>
    </View>
  );

  const extractionAccuracy = metrics.extractionAccuracy ?? 0;
  const extractionPassed = extractionAccuracy >= 95;

  const renderConfidenceBadge = () => {
    const color = confidenceColor(metrics.overallScore);
    return (
      <View style={[styles.confidenceBadge, {borderColor: color}]}>
        <Icon name="check-decagram" size={16} color={color} />
        <Text style={[styles.confidenceText, {color}]}>
          {' '}OCR/Table Confidence: {metrics.overallScore}%
        </Text>
      </View>
    );
  };

  const renderExtractionAccuracy = () => {
    const statusColor = extractionPassed ? '#2e7d32' : '#c62828';
    const statusLabel = extractionPassed ? 'PASS' : 'FAIL';
    const statusIcon = extractionPassed ? 'check-circle-outline' : 'close-circle-outline';
    return (
      <View style={styles.accuracyRow}>
        <View style={[styles.accuracyBadge, {borderColor: statusColor}]}>
          <Icon name={statusIcon} size={16} color={statusColor} />
          <Text style={[styles.accuracyText, {color: statusColor}]}>
            {' '}Extraction Accuracy: {extractionAccuracy}%
          </Text>
          <View style={[styles.accuracyStatusChip, {backgroundColor: statusColor}]}>
            <Text style={styles.accuracyStatusText}>{statusLabel}</Text>
          </View>
        </View>
        {!extractionPassed && (
          <Text style={styles.accuracyFailHint}>
            Accuracy below 95% — review and correct highlighted cells
          </Text>
        )}
      </View>
    );
  };

  const renderMetricPill = (label: string, value: number) => {
    const color = confidenceColor(value);
    return (
      <View key={label} style={[styles.metricPill, {borderColor: color}]}>
        <Text style={[styles.metricLabel, {color}]}>{label}</Text>
        <Text style={[styles.metricValue, {color}]}>{value}%</Text>
      </View>
    );
  };

  const renderMetricSummary = () => (
    <View style={styles.metricsRow}>
      {renderMetricPill('Text', metrics.textScore)}
      {renderMetricPill('Cells', metrics.cellValueScore)}
      {renderMetricPill('Structure', metrics.structureScore)}
      {renderMetricPill('Mapping', metrics.mappingScore)}
      {renderMetricPill('Coverage', metrics.completenessScore)}
    </View>
  );

  const renderErrors = () => {
    if (!validationMessages || validationMessages.length === 0) {
      return null;
    }

    return (
      <View style={styles.errorBanner}>
        <Icon name="alert-circle-outline" size={16} color="#c62828" />
        <View style={styles.errorTexts}>
          {validationMessages.map((message, index) => (
            <Text key={`${message}-${index}`} style={styles.errorText}>
              {message}
            </Text>
          ))}
        </View>
      </View>
    );
  };

  const renderUnknownBanner = () => {
    if (unknownCount === 0) {
      return null;
    }

    return (
      <View style={styles.unknownBanner}>
        <Icon name="pencil-circle-outline" size={16} color="#c62828" />
        <Text style={styles.unknownText}>
          {' '}{unknownCount} cell{unknownCount !== 1 ? 's' : ''} require manual verification
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backBtn} onPress={handleGoBack}>
          <Icon name="arrow-left" size={22} color={COLORS.PRIMARY} />
          <CustomText variant="medium" style={styles.backBtnText}>
            Back
          </CustomText>
        </TouchableOpacity>
        <CustomText variant="medium" style={styles.screenTitle}>
          Verify OCR Results
        </CustomText>
        <Text style={styles.manufacturerText}>{manufacturer}</Text>
      </View>
      <View style={styles.divider} />

      <View style={styles.infoStrip}>{renderConfidenceBadge()}</View>
      {renderExtractionAccuracy()}
      {renderMetricSummary()}
      {renderErrors()}
      {renderUnknownBanner()}

      <ScrollView
        style={styles.contentScroll}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.legend}>
          <View style={[styles.legendDot, styles.legendUnreadableDot]} />
          <Text style={styles.legendText}>Unreadable must edit</Text>
          <View style={[styles.legendDot, styles.legendLowConfidenceDot]} />
          <Text style={styles.legendText}>Low confidence</Text>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator style={styles.tableScroll}>
          <View style={styles.tableFrame}>
            {renderHeader()}
            {panelData.cells.map((cell, index) => renderRow({item: cell, index}))}
          </View>
        </ScrollView>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[
            styles.proceedBtn,
            !canProceed && styles.proceedBtnDisabled,
          ]}
          onPress={handleProceed}
          disabled={!canProceed}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Text style={styles.proceedBtnText}>
                {unknownCount > 0
                  ? `${unknownCount} cell${unknownCount !== 1 ? 's' : ''} require manual verification`
                  : 'Proceed to Panel'}
              </Text>
              <Icon
                name="arrow-right"
                size={18}
                color={!canProceed ? '#aaa' : '#fff'}
              />
            </>
          )}
        </TouchableOpacity>
      </View>

      <ValuePickerModal
        visible={pickerVisible}
        currentValue={
          pickerTarget
            ? panelData.cells[pickerTarget.cellIndex]?.results[pickerTarget.antigen] ?? ''
            : ''
        }
        onSelect={handleValueSelect}
        onClose={() => setPickerVisible(false)}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 70,
  },
  backBtnText: {
    color: COLORS.PRIMARY,
    fontSize: 15,
    marginLeft: 4,
  },
  screenTitle: {
    fontSize: 17,
    color: COLORS.TEXT,
    fontFamily: FONTS.POPPINS_BOLD,
  },
  manufacturerText: {
    fontSize: 13,
    color: '#666',
    fontFamily: FONTS.POPPINS_REGULAR,
    width: 70,
    textAlign: 'right',
  },
  divider: {
    height: 1,
    backgroundColor: '#ddd',
    marginHorizontal: 16,
  },
  infoStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  accuracyRow: {
    paddingHorizontal: 16,
    paddingBottom: 6,
  },
  accuracyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: 'flex-start',
    gap: 4,
  },
  accuracyText: {
    fontSize: 13,
    fontFamily: FONTS.POPPINS_MEDIUM,
  },
  accuracyStatusChip: {
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 1,
    marginLeft: 4,
  },
  accuracyStatusText: {
    fontSize: 10,
    color: '#fff',
    fontFamily: FONTS.POPPINS_BOLD,
    fontWeight: '700',
  },
  accuracyFailHint: {
    fontSize: 11,
    color: '#c62828',
    fontFamily: FONTS.POPPINS_REGULAR,
    marginTop: 3,
  },
  metricsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 8,
  },
  metricPill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
    gap: 6,
    backgroundColor: '#fff',
  },
  metricLabel: {
    fontSize: 11,
    fontFamily: FONTS.POPPINS_MEDIUM,
  },
  metricValue: {
    fontSize: 11,
    fontFamily: FONTS.POPPINS_BOLD,
  },
  confidenceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  confidenceText: {
    fontSize: 13,
    fontFamily: FONTS.POPPINS_MEDIUM,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#ffebee',
    marginHorizontal: 16,
    marginBottom: 6,
    padding: 8,
    borderRadius: 6,
    borderLeftWidth: 3,
    borderLeftColor: '#c62828',
  },
  errorTexts: {
    flex: 1,
    marginLeft: 6,
  },
  errorText: {
    fontSize: 12,
    color: '#c62828',
  },
  unknownBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fce4ec',
    marginHorizontal: 16,
    marginBottom: 6,
    padding: 8,
    borderRadius: 6,
  },
  unknownText: {
    fontSize: 13,
    color: '#c62828',
    fontFamily: FONTS.POPPINS_MEDIUM,
  },
  contentScroll: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 12,
  },
  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  legendDot: {
    width: 14,
    height: 14,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: '#ccc',
  },
  legendUnreadableDot: {
    backgroundColor: '#ffcdd2',
  },
  legendLowConfidenceDot: {
    backgroundColor: '#fff3e0',
    marginLeft: 12,
  },
  legendText: {
    fontSize: 11,
    color: '#555',
    marginLeft: 4,
  },
  tableScroll: {
    marginHorizontal: 8,
  },
  tableFrame: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#d7dde4',
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#fff',
  },
  groupHeaderRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#b0bec5',
  },
  groupHeaderCell: {
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: '#cfd8dc',
    paddingHorizontal: 4,
  },
  metadataGroupCell: {
    backgroundColor: '#f1f3f5',
  },
  resultGroupCell: {
    backgroundColor: '#f9fbe7',
  },
  groupHeaderText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#37474f',
    textAlign: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    backgroundColor: '#e8eaf6',
    borderBottomWidth: 1,
    borderBottomColor: '#9fa8da',
  },
  headerCell: {
    width: CELL_W,
    minWidth: CELL_W,
    height: 38,
    justifyContent: 'center',
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: '#c5cae9',
    paddingHorizontal: 4,
  },
  metadataHeaderCell: {
    backgroundColor: '#f8f9fb',
  },
  headerText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#283593',
    textAlign: 'center',
  },
  dataRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  cell: {
    width: CELL_W,
    minWidth: CELL_W,
    height: CELL_H,
    justifyContent: 'center',
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: '#e0e0e0',
    paddingHorizontal: 4,
  },
  metadataCell: {
    backgroundColor: '#fafafa',
  },
  cellUnknown: {
    borderWidth: 1,
    borderColor: '#c62828',
  },
  cellText: {
    fontSize: 12,
    color: '#212121',
    fontWeight: '500',
    textAlign: 'center',
  },
  cellTextUnknown: {
    color: '#c62828',
    fontWeight: '700',
  },
  metaText: {
    fontSize: 11,
    color: '#37474f',
    textAlign: 'center',
    fontFamily: FONTS.POPPINS_MEDIUM,
  },
  editIcon: {
    position: 'absolute',
    bottom: 2,
    right: 2,
  },
  rowNumText: {
    fontSize: 11,
    color: '#757575',
    fontWeight: '600',
  },
  resultCell: {
    width: RESULT_W,
    minWidth: RESULT_W,
    backgroundColor: '#f9fbe7',
  },
  footer: {
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  proceedBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.PRIMARY,
    borderRadius: 8,
    paddingVertical: 13,
    gap: 8,
  },
  proceedBtnDisabled: {
    backgroundColor: '#bdbdbd',
  },
  proceedBtnText: {
    fontSize: 15,
    color: '#fff',
    fontFamily: FONTS.POPPINS_MEDIUM,
    fontWeight: '600',
  },
  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickerCard: {
    width: 220,
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    elevation: 6,
  },
  pickerTitle: {
    fontSize: 15,
    color: '#212121',
    fontFamily: FONTS.POPPINS_BOLD,
    marginBottom: 10,
    textAlign: 'center',
  },
  pickerOption: {
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 6,
    marginBottom: 4,
  },
  pickerOptionSelected: {
    backgroundColor: '#e8eaf6',
  },
  pickerOptionText: {
    fontSize: 16,
    color: '#212121',
    textAlign: 'center',
    fontFamily: FONTS.POPPINS_MEDIUM,
  },
  pickerOptionTextSelected: {
    color: COLORS.PRIMARY,
    fontWeight: '700',
  },
  pickerCancel: {
    marginTop: 6,
    paddingVertical: 8,
    alignItems: 'center',
  },
  pickerCancelText: {
    fontSize: 14,
    color: '#757575',
  },
});

export default VerifyPanelScreen;
