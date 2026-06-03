import {
  computeExtractionAccuracyPercent,
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

    it('case 2: 5 empty cells out of 100 → accuracy 95%', () => {
      const summary = summarizeExtractionAccuracy(
        buildSlots(100, [0, 1, 2, 3, 4]),
      );
      expect(summary.invalidCount).toBe(5);
      expect(summary.accuracyPercent).toBe(95);
    });

    it('case 3: 20 empty cells out of 100 → accuracy 80%', () => {
      const summary = summarizeExtractionAccuracy(
        buildSlots(100, Array.from({length: 20}, (_, i) => i)),
      );
      expect(summary.invalidCount).toBe(20);
      expect(summary.accuracyPercent).toBe(80);
    });

    it('displayed accuracy matches formula (n×X − invalid) / (n×X) × 100', () => {
      const summary = summarizeExtractionAccuracy(buildSlots(100, [7, 42, 99]));
      const expected = Math.round(((100 - 3) / 100) * 100);
      expect(summary.accuracyPercent).toBe(expected);
      expect(summary.accuracyPercent).toBe(97);
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

  describe('logExtractionAccuracyBreakdown', () => {
    it('logs formula and displayed percentage for inspection', () => {
      const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      const summary = summarizeExtractionAccuracy(buildSlots(100, [0, 1, 2, 3, 4]));

      logExtractionAccuracyBreakdown('jest-test', summary, {forceLog: true});

      expect(logSpy).toHaveBeenCalledWith(
        '[OCR Accuracy] jest-test',
        expect.objectContaining({
          formula: '(100 - 5) / 100 * 100 = 95%',
          accuracyPercent: 95,
          displayedAccuracy: '95%',
          passAt95Threshold: true,
          invalidCount: 5,
        }),
      );

      logSpy.mockRestore();
    });
  });
});
