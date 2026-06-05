import {
  capOverallScoreByExtraction,
  computeOverallOcrConfidence,
  refreshOcrConfidenceMetrics,
} from '../src/utils/ocrTableConfidence';
import {CellConfidence} from '../src/services/PanelTableParser';
import {OcrStructureMetrics, PanelData} from '../src/types';

describe('OCR table confidence weighting', () => {
  it('reproduces 94% from user-reported sub-scores (pre-fix)', () => {
    expect(
      computeOverallOcrConfidence({
        textScore: 83,
        cellValueScore: 100,
        mappingScore: 93,
        structureScore: 95,
        completenessScore: 100,
      }),
    ).toBe(94);
  });

  it('reaches 100% when validated structure and exact filled symbols score 100', () => {
    expect(
      computeOverallOcrConfidence({
        textScore: 100,
        cellValueScore: 100,
        mappingScore: 100,
        structureScore: 100,
        completenessScore: 100,
      }),
    ).toBe(100);
  });

  it('caps overall score by extraction accuracy', () => {
    expect(capOverallScoreByExtraction(100, 13)).toBe(13);
    expect(capOverallScoreByExtraction(94, 95)).toBe(94);
  });

  it('refreshes structural sub-scores but caps overall by extraction', () => {
    const stale: OcrStructureMetrics = {
      textScore: 83,
      cellValueScore: 100,
      mappingScore: 93,
      structureScore: 95,
      completenessScore: 100,
      overallScore: 94,
      extractionAccuracy: 13,
    };
    const panelData: PanelData = {
      cells: [{rowNumber: 1, cellId: '1', donorNumber: '1', phenotype: '', results: {D: '+'}}],
      antigens: ['D', 'C', 'E', 'c', 'e'],
      metadata: {manufacturer: 'ALBA', validationIssues: []},
      antigenGroups: {},
    };
    const confidences: CellConfidence[][] = [
      [
        {
          rowIndex: 1,
          colIndex: 3,
          columnKey: 'D',
          value: '+',
          confidence: 52,
          needsReview: true,
        },
      ],
    ];

    const refreshed = refreshOcrConfidenceMetrics(stale, panelData, confidences);
    expect(refreshed.textScore).toBe(100);
    expect(refreshed.mappingScore).toBe(100);
    expect(refreshed.structureScore).toBe(100);
    expect(refreshed.overallScore).toBe(13);
  });
});
