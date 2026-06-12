import {
  buildExtractionAccuracyColumnSpecs,
  computeExtractionAccuracyPercent,
  computeLiveExtractionAccuracy,
  computeMetadataCompleteness,
  countManualVerificationSlots,
  countUnresolvedAnalysisSlots,
  filterColumnsForExtractionAccuracy,
  getExtractionInvalidReason,
  isInvalidExtractionSlot,
  logExtractionAccuracyBreakdown,
  normalizeExtractionCellValue,
  summarizeExtractionAccuracy,
  type ExtractionSlotSpec,
} from '../src/utils/ocrExtractionValidation';

function buildSlots(
  total: number,
  invalidAt: number[],
  valueForInvalid: (index: number) => unknown = () => '',
): ExtractionSlotSpec[] {
  const invalidSet = new Set(invalidAt);
  return Array.from({length: total}, (_, index) => ({
    value: invalidSet.has(index) ? valueForInvalid(index) : '+',
    rowIndex: Math.floor(index / 10) + 1,
    columnKey: `col${index % 10}`,
  }));
}

describe('OCR extraction accuracy calculation', () => {
  describe('computeExtractionAccuracyPercent', () => {
    it('case 1: all 100 slots valid → 100%', () => {
      expect(computeExtractionAccuracyPercent(100, 0)).toBe(100);
    });

    it('case 2: 5 invalid out of 100 → 95%', () => {
      expect(computeExtractionAccuracyPercent(100, 5)).toBe(95);
    });

    it('case 3: 20 invalid out of 100 → 80%', () => {
      expect(computeExtractionAccuracyPercent(100, 20)).toBe(80);
    });
  });

  describe('summarizeExtractionAccuracy (displayed percentage)', () => {
    it('case 1: all cells populated correctly → accuracy 100%', () => {
      const summary = summarizeExtractionAccuracy(buildSlots(100, []));
      expect(summary.slotCount).toBe(100);
      expect(summary.invalidCount).toBe(0);
      expect(summary.accuracyPercent).toBe(100);
      expect(summary.validCount).toBe(100);
    });

    it('case 2: 5 empty slots out of 100 → 95%', () => {
      const summary = summarizeExtractionAccuracy(
        buildSlots(100, [0, 1, 2, 3, 4]),
      );
      expect(summary.slotCount).toBe(100);
      expect(summary.invalidCount).toBe(5);
      expect(summary.accuracyPercent).toBe(95);
    });

    it('case 3: 20 empty slots out of 100 → 80%', () => {
      const summary = summarizeExtractionAccuracy(
        buildSlots(100, Array.from({length: 20}, (_, i) => i)),
      );
      expect(summary.slotCount).toBe(100);
      expect(summary.invalidCount).toBe(20);
      expect(summary.accuracyPercent).toBe(80);
    });

    it('sparse panel: few + marks among many blanks → low accuracy', () => {
      const slots: ExtractionSlotSpec[] = Array.from({length: 50}, (_, index) => ({
        value: index < 4 ? '+' : '',
        rowIndex: Math.floor(index / 5) + 1,
        columnKey: ['D', 'C', 'E', 'c', 'e'][index % 5],
      }));
      const summary = summarizeExtractionAccuracy(slots);
      expect(summary.slotCount).toBe(50);
      expect(summary.invalidCount).toBe(46);
      expect(summary.accuracyPercent).toBe(8);
    });

    it('full-grid accuracy penalizes empty and unreadable values', () => {
      const summary = summarizeExtractionAccuracy(
        buildSlots(10, [0, 1, 2], () => '?'),
      );
      expect(summary.slotCount).toBe(10);
      expect(summary.invalidCount).toBe(3);
      expect(summary.accuracyPercent).toBe(70);
    });

    it('expected schema keys expand slot grid when columns missing from layout', () => {
      const cells = [{results: {D: '+', C: ''}}];
      const columns = [{key: 'D', kind: 'analysis' as const}];
      const summary = computeLiveExtractionAccuracy(cells, columns, {
        expectedKeys: ['D', 'C', 'E'],
      });
      expect(summary.slotCount).toBe(3);
      expect(summary.invalidCount).toBe(2);
      expect(summary.accuracyPercent).toBe(33);
    });
  });

  describe('missing value detection (cases 4–7)', () => {
    it('case 4: empty string counts as missing', () => {
      expect(isInvalidExtractionSlot('')).toBe(true);
      expect(getExtractionInvalidReason('')).toBe('empty');
    });

    it('case 5: null counts as missing', () => {
      expect(isInvalidExtractionSlot(null)).toBe(true);
      expect(normalizeExtractionCellValue(null)).toBe('');
    });

    it('case 6: undefined counts as missing', () => {
      expect(isInvalidExtractionSlot(undefined)).toBe(true);
      expect(normalizeExtractionCellValue(undefined)).toBe('');
    });

    it('case 7: whitespace-only counts as missing', () => {
      expect(isInvalidExtractionSlot('   ')).toBe(true);
      expect(isInvalidExtractionSlot('\t\n')).toBe(true);
      expect(normalizeExtractionCellValue('  \t  ')).toBe('');
    });

    it('valid result symbols are not missing', () => {
      expect(isInvalidExtractionSlot('+')).toBe(false);
      expect(isInvalidExtractionSlot('0')).toBe(false);
      expect(isInvalidExtractionSlot('NT')).toBe(false);
    });

    it('unreadable marker counts as invalid', () => {
      expect(isInvalidExtractionSlot('?')).toBe(true);
      expect(getExtractionInvalidReason('?')).toBe('unreadable');
    });

    it('low confidence counts as invalid when value is present', () => {
      expect(isInvalidExtractionSlot('+', 40)).toBe(true);
      expect(getExtractionInvalidReason('+', 40)).toBe('low_confidence');
      expect(isInvalidExtractionSlot('+', 90)).toBe(false);
    });
  });

  describe('filterColumnsForExtractionAccuracy', () => {
    it('excludes schema_projection columns with no extracted values', () => {
      const columns = [
        {key: 'D', kind: 'analysis' as const, evidence: 'header'},
        {key: 'C', kind: 'analysis' as const, evidence: 'schema_projection'},
      ];
      const cells = [{results: {D: '+', C: ''}}];

      expect(filterColumnsForExtractionAccuracy(columns, cells).map(c => c.key)).toEqual([
        'D',
      ]);
      expect(buildExtractionAccuracyColumnSpecs(columns, cells)).toEqual([
        {key: 'D', kind: 'analysis'},
      ]);
    });

    it('includes schema_projection columns when at least one row has data', () => {
      const columns = [
        {key: 'D', kind: 'analysis' as const, evidence: 'schema_projection'},
      ];
      const cells = [{results: {D: '+'}}];

      expect(filterColumnsForExtractionAccuracy(columns, cells).map(c => c.key)).toEqual([
        'D',
      ]);
    });
  });

  describe('countManualVerificationSlots', () => {
    it('counts only empty and unreadable cells, not low-confidence values', () => {
      const cells = [
        {results: {D: '+', C: '', E: '?'}},
        {results: {D: '+', C: '0', E: '+' }},
      ];
      const columns = [
        {key: 'D', kind: 'analysis' as const},
        {key: 'C', kind: 'analysis' as const},
        {key: 'E', kind: 'analysis' as const},
      ];

      expect(countManualVerificationSlots(cells, columns)).toBe(2);
    });
  });

  describe('countUnresolvedAnalysisSlots', () => {
    it('does not count empty result column when includeResult is false', () => {
      const cells = Array.from({length: 10}, () => ({
        results: {D: '+', result: ''},
      }));
      const columns = [
        {key: 'D', kind: 'analysis' as const},
        {key: 'result', kind: 'result' as const},
      ];

      expect(
        countUnresolvedAnalysisSlots(cells, columns, undefined, true),
      ).toBe(10);
      expect(
        countUnresolvedAnalysisSlots(cells, columns, undefined, false),
      ).toBe(0);
    });

    it('counts only analysis empties without inflating from result column', () => {
      const cells = [
        {results: {D: '+', C: '', result: ''}},
        {results: {D: '0', C: '', result: ''}},
      ];
      const columns = [
        {key: 'D', kind: 'analysis' as const},
        {key: 'C', kind: 'analysis' as const},
        {key: 'result', kind: 'result' as const},
      ];

      expect(
        countUnresolvedAnalysisSlots(cells, columns, undefined, true),
      ).toBe(4);
      expect(
        countUnresolvedAnalysisSlots(cells, columns, undefined, false),
      ).toBe(2);
    });
  });

  describe('computeMetadataCompleteness', () => {
    it('flags missing phenotype and row-index donor placeholders', () => {
      const summary = computeMetadataCompleteness([
        {cellId: '1', phenotype: '', donorNumber: '1'},
        {cellId: '2', phenotype: 'rr', donorNumber: '2069930'},
      ]);

      expect(summary.invalidCount).toBe(2);
      expect(summary.completenessPercent).toBe(50);
      expect(summary.issues.some(issue => issue.includes('missing Rh-hr'))).toBe(true);
      expect(summary.issues.some(issue => issue.includes('row index'))).toBe(true);
    });
  });

  describe('logExtractionAccuracyBreakdown', () => {
    it('logs formula and displayed percentage for inspection', () => {
      const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      const occupiedSummary = summarizeExtractionAccuracy(
        buildSlots(100, [7, 42, 99], () => '?'),
      );
      logExtractionAccuracyBreakdown('jest-test', occupiedSummary, {forceLog: true});

      expect(logSpy).toHaveBeenCalledWith(
        '[OCR Accuracy] jest-test',
        expect.objectContaining({
          accuracyPercent: 97,
          displayedAccuracy: '97%',
          passAt95Threshold: true,
          invalidCount: 3,
        }),
      );

      logSpy.mockRestore();
    });
  });
});
