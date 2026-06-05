import {CellConfidence} from '../services/PanelTableParser';
import {OcrStructureMetrics, PanelData} from '../types';

const VALID_OCR_RESULT_RE = /^(?:\+|0|\/|NT|MF|W\+|[1-4]\+|\+W|\+S)$/i;

const STRUCTURAL_ERROR_CODES = new Set([
  'duplicate_column',
  'missing_column',
  'group_mismatch',
]);

export function computeOverallOcrConfidence(scores: {
  textScore: number;
  cellValueScore: number;
  mappingScore: number;
  structureScore: number;
  completenessScore: number;
  unreadablePenalty?: number;
}): number {
  const penalty = scores.unreadablePenalty ?? 0;
  return Math.max(
    0,
    Math.round(
      scores.textScore * 0.2 +
        scores.cellValueScore * 0.15 +
        scores.mappingScore * 0.25 +
        scores.structureScore * 0.25 +
        scores.completenessScore * 0.15 -
        penalty,
    ),
  );
}

export function hasStructuralTableErrors(panelData: PanelData): boolean {
  return (panelData.metadata.validationIssues ?? []).some(issue =>
    STRUCTURAL_ERROR_CODES.has(issue.code),
  );
}

export function shouldUsePerfectStructureScores(
  metrics: OcrStructureMetrics,
  panelData: PanelData,
): boolean {
  return !hasStructuralTableErrors(panelData) && metrics.completenessScore === 100;
}

/** Recompute text score using exact valid symbols at 100% (ignores low-confidence flag). */
export function recomputeTextScoreFromCellConfidences(
  cellConfidences: CellConfidence[][],
): number {
  let total = 0;
  let count = 0;

  for (const row of cellConfidences) {
    for (const cell of row) {
      const value = String(cell.value ?? '').trim();
      if (value === '') {
        continue;
      }
      const contribution = VALID_OCR_RESULT_RE.test(value) ? 100 : cell.confidence;
      total += contribution;
      count++;
    }
  }

  return count > 0 ? Math.round(total / count) : 0;
}

export function capOverallScoreByExtraction(
  overallScore: number,
  extractionAccuracy: number,
): number {
  return Math.min(overallScore, extractionAccuracy);
}

export function refreshOcrConfidenceMetrics(
  metrics: OcrStructureMetrics,
  panelData: PanelData,
  cellConfidences?: CellConfidence[][],
): OcrStructureMetrics {
  const perfectStructure = shouldUsePerfectStructureScores(metrics, panelData);
  const textScore =
    cellConfidences && cellConfidences.length > 0
      ? recomputeTextScoreFromCellConfidences(cellConfidences)
      : metrics.textScore;
  const mappingScore = perfectStructure ? 100 : metrics.mappingScore;
  const structureScore = perfectStructure ? 100 : metrics.structureScore;
  const structuralOverall = computeOverallOcrConfidence({
    textScore,
    cellValueScore: metrics.cellValueScore,
    mappingScore,
    structureScore,
    completenessScore: metrics.completenessScore,
  });
  const overallScore = capOverallScoreByExtraction(
    structuralOverall,
    metrics.extractionAccuracy,
  );

  return {
    ...metrics,
    textScore,
    mappingScore,
    structureScore,
    overallScore,
  };
}
