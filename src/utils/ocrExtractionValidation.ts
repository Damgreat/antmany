/** Matches PanelTableParser low-confidence warn threshold for extraction slots. */
export const LOW_CONFIDENCE_EXTRACTION_THRESHOLD = 52;

export type ExtractionInvalidReason = 'empty' | 'unreadable' | 'low_confidence';

export type ExtractionSlotSpec = {
  value: unknown;
  confidence?: number;
  rowIndex?: number;
  columnKey?: string;
};

export interface ExtractionAccuracySummary {
  slotCount: number;
  invalidCount: number;
  validCount: number;
  accuracyPercent: number;
  invalidSamples: Array<{
    rowIndex?: number;
    columnKey?: string;
    normalizedValue: string;
    reason: ExtractionInvalidReason;
  }>;
}

/** Normalizes a cell value for extraction validation (null/undefined → '', trim whitespace). */
export function normalizeExtractionCellValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  return String(value).trim();
}

export function getExtractionInvalidReason(
  value: unknown,
  confidence?: number,
  lowConfidenceThreshold: number = LOW_CONFIDENCE_EXTRACTION_THRESHOLD,
): ExtractionInvalidReason | null {
  const normalized = normalizeExtractionCellValue(value);
  if (normalized === '') {
    return 'empty';
  }
  if (normalized === '?') {
    return 'unreadable';
  }
  if (
    confidence !== undefined &&
    confidence < lowConfidenceThreshold
  ) {
    return 'low_confidence';
  }
  return null;
}

/**
 * Returns true when an analysis-column extraction slot should reduce accuracy:
 * blank, unreadable (?), or below confidence threshold.
 */
export function isInvalidExtractionSlot(
  value: unknown,
  confidence?: number,
  lowConfidenceThreshold: number = LOW_CONFIDENCE_EXTRACTION_THRESHOLD,
): boolean {
  return getExtractionInvalidReason(value, confidence, lowConfidenceThreshold) !== null;
}

/** Spec formula: ((n × X) − invalidValues) / (n × X) × 100 */
export function computeExtractionAccuracyPercent(
  slotCount: number,
  invalidCount: number,
): number {
  if (slotCount <= 0) {
    return 0;
  }
  return Math.round(((slotCount - invalidCount) / slotCount) * 100);
}

const MAX_INVALID_SAMPLES_IN_LOG = 25;

/** Spec: only columns with kind === 'analysis' count toward n×X (not supplemental/side/result). */
export function filterAnalysisExtractionColumns<
  T extends {key: string; kind?: string},
>(columns: T[]): T[] {
  return columns.filter(column => column.kind === 'analysis');
}

export type ExtractionAccuracyColumn = {
  key: string;
  kind?: string;
  evidence?: string;
  sourceColumn?: number;
};

/**
 * Columns included in n×X for extraction accuracy.
 * Detected analysis columns always count; schema-only projections count only
 * when at least one row has a value (empty projected columns must not deflate accuracy).
 */
export function filterColumnsForExtractionAccuracy<
  T extends ExtractionAccuracyColumn,
>(
  columns: T[],
  cells: Array<{results: Record<string, unknown>}>,
): T[] {
  return filterAnalysisExtractionColumns(columns).filter(column => {
    if (column.evidence === 'schema_projection') {
      return cells.some(
        cell => normalizeExtractionCellValue(cell.results[column.key]) !== '',
      );
    }
    if (column.evidence) {
      return true;
    }
    const hasAnyValue = cells.some(
      cell => normalizeExtractionCellValue(cell.results[column.key]) !== '',
    );
    const hasMappedSource =
      typeof column.sourceColumn === 'number' && column.sourceColumn > 0;
    return hasAnyValue || hasMappedSource;
  });
}

export function buildExtractionAccuracyColumnSpecs(
  columns: ExtractionAccuracyColumn[],
  cells: Array<{results: Record<string, unknown>}>,
): Array<{key: string; kind: 'analysis'}> {
  return filterColumnsForExtractionAccuracy(columns, cells).map(column => ({
    key: column.key,
    kind: 'analysis' as const,
  }));
}

export function resolveExtractionAccuracyColumns(
  cells: Array<{results: Record<string, unknown>}>,
  columns: ExtractionAccuracyColumn[],
  storedKeys?: string[],
): Array<{key: string; kind: 'analysis'}> {
  if (storedKeys?.length) {
    return storedKeys.map(key => ({key, kind: 'analysis' as const}));
  }
  return buildExtractionAccuracyColumnSpecs(columns, cells);
}

export function mergeAnalysisColumnKeys(
  columns: Array<{key: string; kind?: string}>,
  expectedKeys?: string[],
): string[] {
  return [
    ...new Set([
      ...filterAnalysisExtractionColumns(columns).map(column => column.key),
      ...(expectedKeys ?? []),
    ]),
  ];
}

export type BuildExtractionSlotsOptions = {
  cellConfidences?: Array<Array<{columnKey: string; confidence: number}>>;
  expectedKeys?: string[];
};

export function buildAnalysisExtractionSlots(
  cells: Array<{results: Record<string, unknown>}>,
  columns: Array<{key: string; kind?: string}>,
  options?: BuildExtractionSlotsOptions,
): ExtractionSlotSpec[] {
  const keys = mergeAnalysisColumnKeys(columns, options?.expectedKeys);
  return cells.flatMap((cell, rowIdx) => {
    const rowConf = options?.cellConfidences?.[rowIdx] ?? [];
    const confByKey = new Map(rowConf.map(c => [c.columnKey, c.confidence]));
    return keys.map(key => ({
      value: cell.results[key],
      confidence: confByKey.get(key),
      rowIndex: rowIdx + 1,
      columnKey: key,
    }));
  });
}

export function computeLiveExtractionAccuracy(
  cells: Array<{results: Record<string, unknown>}>,
  columns: Array<{key: string; kind?: string}>,
  options?: BuildExtractionSlotsOptions &
    Parameters<typeof summarizeExtractionAccuracy>[1],
): ExtractionAccuracySummary {
  const {cellConfidences, expectedKeys, ...summaryOptions} = options ?? {};
  return summarizeExtractionAccuracy(
    buildAnalysisExtractionSlots(cells, columns, {cellConfidences, expectedKeys}),
    summaryOptions,
  );
}

export function countUnresolvedAnalysisSlots(
  cells: Array<{results: Record<string, unknown>}>,
  columns: Array<{key: string; kind?: string}>,
  expectedKeys?: string[],
  includeResult = true,
  cellConfidences?: BuildExtractionSlotsOptions['cellConfidences'],
): number {
  const keys = mergeAnalysisColumnKeys(columns, expectedKeys);
  let count = 0;
  cells.forEach((cell, rowIdx) => {
    const rowConf = cellConfidences?.[rowIdx] ?? [];
    const confByKey = new Map(rowConf.map(c => [c.columnKey, c.confidence]));
    for (const key of keys) {
      if (
        isInvalidExtractionSlot(cell.results[key], confByKey.get(key))
      ) {
        count++;
      }
    }
    if (
      includeResult &&
      isInvalidExtractionSlot(cell.results.result, confByKey.get('result'))
    ) {
      count++;
    }
  });
  return count;
}

export function isRowIndexDonorPlaceholder(
  donor: string,
  cellId?: string,
): boolean {
  const normalized = donor.trim();
  if (!normalized) {
    return true;
  }
  if (cellId && normalized === cellId.trim()) {
    return true;
  }
  return /^[1-9]\d?$/.test(normalized);
}

export type MetadataValidationSummary = {
  slotCount: number;
  invalidCount: number;
  completenessPercent: number;
  issues: string[];
};

/** Rh-hr phenotype and donor slots are required for panel verification. */
export function computeMetadataCompleteness(
  cells: Array<{cellId?: string; phenotype?: string; donorNumber?: string}>,
): MetadataValidationSummary {
  const issues: string[] = [];
  let invalidCount = 0;
  const slotCount = cells.length * 2;

  cells.forEach((cell, index) => {
    const phenotype = normalizeExtractionCellValue(cell.phenotype);
    const donor = normalizeExtractionCellValue(cell.donorNumber);
    const rowLabel = cell.cellId || String(index + 1);

    if (phenotype === '') {
      invalidCount++;
      issues.push(`Row ${rowLabel}: missing Rh-hr phenotype`);
    }

    if (isRowIndexDonorPlaceholder(donor, cell.cellId)) {
      invalidCount++;
      issues.push(
        donor === ''
          ? `Row ${rowLabel}: missing Donor ID`
          : `Row ${rowLabel}: Donor looks like row index (${donor})`,
      );
    }
  });

  return {
    slotCount,
    invalidCount,
    completenessPercent: computeExtractionAccuracyPercent(slotCount, invalidCount),
    issues,
  };
}

export function countManualVerificationSlots(
  cells: Array<{results: Record<string, unknown>}>,
  columns: Array<{key: string; kind?: string}>,
  cellConfidences?: BuildExtractionSlotsOptions['cellConfidences'],
): number {
  const keys = filterAnalysisExtractionColumns(columns).map(column => column.key);
  let count = 0;
  cells.forEach(cell => {
    for (const key of keys) {
      const normalized = normalizeExtractionCellValue(cell.results[key]);
      if (normalized === '' || normalized === '?') {
        count++;
      }
    }
  });
  return count;
}

export function computeAnalysisCellValueScore(
  cells: Array<{results: Record<string, unknown>}>,
  columns: Array<{key: string; kind?: string}>,
  expectedKeys?: string[],
  cellConfidences?: BuildExtractionSlotsOptions['cellConfidences'],
): number {
  const keys = mergeAnalysisColumnKeys(columns, expectedKeys);
  const totalSlots = cells.length * keys.length;
  if (totalSlots <= 0) {
    return 0;
  }
  const unresolved = countUnresolvedAnalysisSlots(
    cells,
    columns,
    expectedKeys,
    false,
    cellConfidences,
  );
  return Math.round(((totalSlots - unresolved) / totalSlots) * 100);
}

export function summarizeExtractionAccuracy(
  slots: ExtractionSlotSpec[],
  options?: {
    lowConfidenceThreshold?: number;
    logLabel?: string;
    /** Logs breakdown when true, or when __DEV__ is true if omitted. */
    log?: boolean;
  },
): ExtractionAccuracySummary {
  const threshold =
    options?.lowConfidenceThreshold ?? LOW_CONFIDENCE_EXTRACTION_THRESHOLD;
  const invalidSamples: ExtractionAccuracySummary['invalidSamples'] = [];
  let invalidCount = 0;

  for (const slot of slots) {
    const reason = getExtractionInvalidReason(
      slot.value,
      slot.confidence,
      threshold,
    );
    if (reason === null) {
      continue;
    }
    invalidCount++;
    if (invalidSamples.length < MAX_INVALID_SAMPLES_IN_LOG) {
      invalidSamples.push({
        rowIndex: slot.rowIndex,
        columnKey: slot.columnKey,
        normalizedValue: normalizeExtractionCellValue(slot.value),
        reason,
      });
    }
  }

  const slotCount = slots.length;
  const validCount = slotCount - invalidCount;
  const accuracyPercent = computeExtractionAccuracyPercent(slotCount, invalidCount);

  const summary: ExtractionAccuracySummary = {
    slotCount,
    invalidCount,
    validCount,
    accuracyPercent,
    invalidSamples,
  };

  const shouldLog =
    options?.log === true ||
    (options?.log !== false &&
      typeof __DEV__ !== 'undefined' &&
      __DEV__ &&
      options?.logLabel);

  if (shouldLog && options?.logLabel) {
    logExtractionAccuracyBreakdown(options.logLabel, summary, {forceLog: true});
  }

  return summary;
}

export function logExtractionAccuracyBreakdown(
  label: string,
  summary: ExtractionAccuracySummary,
  options?: {forceLog?: boolean},
): void {
  if (
    !options?.forceLog &&
    typeof __DEV__ !== 'undefined' &&
    !__DEV__
  ) {
    return;
  }

  const {slotCount, invalidCount, accuracyPercent} = summary;
  console.log(
    `[OCR Accuracy] ${label}`,
    {
      formula: `(${slotCount} - ${invalidCount}) / ${slotCount} * 100 = ${accuracyPercent}%`,
      slotCount,
      validCount: summary.validCount,
      invalidCount,
      accuracyPercent,
      displayedAccuracy: `${accuracyPercent}%`,
      passAt95Threshold: accuracyPercent >= 95,
      invalidSampleCount: summary.invalidSamples.length,
      invalidSamples: summary.invalidSamples,
    },
  );
}
