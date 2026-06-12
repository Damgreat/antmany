/**
 * PlainTextPanelParser — fallback parser for the CSV/plain-text output
 * that the Lambda also writes alongside the full Textract JSON.
 *
 * Format produced by the Lambda:
 *   Table: Table_1
 *   <col1> <col2> ... <colN>\n   ← header row (antigen names separated by spaces)
 *   <val1> <val2> ... <valN>\n   ← data rows
 *   ...
 *   ENDOFTABLEDATA
 *
 * Used as a confidence cross-check / fallback when PanelTableParser cannot
 * extract a TABLE block from the JSON (e.g. Textract returned FORMS-only).
 */

import { PanelData, CellData, AntigenGroups, OcrStructureMetrics } from '../types';
import {summarizeExtractionAccuracy} from '../utils/ocrExtractionValidation';
import * as AntigenData from './AntigenData';
import { ParseResult } from './PanelTableParser';

const RESULT_MAP: Record<string, string> = {
  'POS': '+', 'NEG': '0', 'N': '0', '-': '0',
  'W': '+w', '+W': '+w', 'W+': '+w',
  'S': '+s', '+S': '+s', 'S+': '+s',
};

function normalise(raw: string): string {
  const t = raw.trim().toUpperCase();
  return RESULT_MAP[t] ?? raw.trim();
}

function getAntigenGroups(manufacturer: string): AntigenGroups {
  return (AntigenData.DataSources[manufacturer] ??
    AntigenData.DEFAULT_GROUP_MEMBERS) as AntigenGroups;
}

export class PlainTextPanelParser {
  private manufacturer: string;

  constructor(manufacturer: string = 'CUSTOM') {
    this.manufacturer = manufacturer;
  }

  parse(csvText: string): ParseResult {
    const errors: string[] = [];

    // Extract the table section before ENDOFTABLEDATA marker
    const endMarker = csvText.indexOf('ENDOFTABLEDATA');
    const tableText = endMarker >= 0 ? csvText.slice(0, endMarker) : csvText;

    // Split into lines, drop Table: header lines and blanks
    const lines = tableText
      .split('\n')
      .map(l => l.trim())
      .filter(l => l && !l.startsWith('Table:'));

    if (lines.length < 2) {
      return this.emptyResult(['Not enough rows in plain-text output']);
    }

    // First non-empty line = antigen header row
    const antigens = lines[0].split(/\s+/).map(t => t.trim()).filter(Boolean);

    const cells: CellData[] = [];
    let confidenceSum = 0;
    let confidenceCount = 0;

    for (let i = 1; i < lines.length; i++) {
      const tokens = lines[i].split(/\s+/).map(t => t.trim()).filter(Boolean);
      if (tokens.length === 0) continue;

      const results: CellData['results'] = {};
      antigens.forEach((antigen, idx) => {
        const raw = tokens[idx] ?? '';
        results[antigen] = normalise(raw) as any;
        // Plain-text has no per-word confidence — use 92% filled, 100% empty
        confidenceSum += raw === '' ? 100 : 92;
        confidenceCount++;
      });

      cells.push({
        rowNumber: String(i),
        cellId: String(i),
        donorNumber: String(i),
        phenotype: '',
        results,
      });
    }

    const overallConfidence = confidenceCount > 0
      ? Math.round(confidenceSum / confidenceCount)
      : 0;

    const extractionSlots = cells.flatMap((cell, rowIdx) =>
      antigens.map(antigen => ({
        value: cell.results[antigen],
        rowIndex: rowIdx + 1,
        columnKey: antigen,
      })),
    );
    const extractionSummary = summarizeExtractionAccuracy(extractionSlots, {
      logLabel: `PlainTextPanelParser (${cells.length}×${antigens.length})`,
    });
    const extractionAccuracy = extractionSummary.accuracyPercent;
    const extractionAccuracyColumns = antigens;

    const metrics: OcrStructureMetrics = {
      textScore: overallConfidence,
      cellValueScore: 100,
      structureScore: antigens.length > 0 ? 80 : 0,
      mappingScore: antigens.length > 0 ? 80 : 0,
      completenessScore: antigens.length > 0 ? 80 : 0,
      overallScore: overallConfidence,
      extractionAccuracy,
      missingColumns: [],
      duplicateColumns: [],
      unexpectedColumns: [],
      groupMismatches: [],
      detectedHeaderRows: [1],
      detectedDataStartRow: 2,
    };

    const panelData: PanelData = {
      cells,
      antigens,
      metadata: {
        manufacturer: this.manufacturer,
        lotNumber: '',
        expirationDate: '',
        panelType: 'Panel A',
        testName: '',
        extractionAccuracyColumns,
        ocrMetrics: metrics,
      },
      antigenGroups: getAntigenGroups(this.manufacturer),
    };

    return {
      panelData,
      overallConfidence,
      cellConfidences: [],
      lowConfidenceCells: [],
      parseErrors: errors,
      metrics,
    };
  }

  private emptyResult(errors: string[]): ParseResult {
    const metrics: OcrStructureMetrics = {
      textScore: 0,
      cellValueScore: 0,
      structureScore: 0,
      mappingScore: 0,
      completenessScore: 0,
      overallScore: 0,
      extractionAccuracy: 0,
      missingColumns: [],
      duplicateColumns: [],
      unexpectedColumns: [],
      groupMismatches: [],
      detectedHeaderRows: [],
      detectedDataStartRow: 0,
    };

    return {
      panelData: {
        cells: [],
        antigens: [],
        metadata: {
          manufacturer: this.manufacturer,
          lotNumber: '',
          expirationDate: '',
          panelType: 'Panel A',
          testName: '',
          ocrMetrics: metrics,
        },
        antigenGroups: {} as AntigenGroups,
      },
      overallConfidence: 0,
      cellConfidences: [],
      lowConfidenceCells: [],
      parseErrors: errors,
      metrics,
    };
  }
}
