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
  const summary: ExtractionAccuracySummary = {
    slotCount,
    invalidCount,
    validCount: slotCount - invalidCount,
    accuracyPercent: computeExtractionAccuracyPercent(slotCount, invalidCount),
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
