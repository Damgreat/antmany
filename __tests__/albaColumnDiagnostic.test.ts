jest.mock('../src/services/DatabaseService', () => ({
  __esModule: true,
  default: {},
}));

import {PanelTableParser} from '../src/services/PanelTableParser';
import {
  computeLiveExtractionAccuracy,
  countManualVerificationSlots,
  filterAnalysisExtractionColumns,
} from '../src/utils/ocrExtractionValidation';

type Block = Record<string, any>;

function buildWord(id: string, text: string, confidence = 99): Block {
  return {BlockType: 'WORD', Id: id, Text: text, Confidence: confidence};
}

function buildCell(
  id: string,
  row: number,
  col: number,
  text: string,
  rowSpan = 1,
  colSpan = 1,
  blockType = 'CELL',
): Block[] {
  const tokens = text.trim() ? text.split(/\s+/) : [];
  const wordIds = tokens.map((_, index) => `${id}-w${index + 1}`);
  const cellBlock: Block = {
    BlockType: blockType,
    Id: id,
    RowIndex: row,
    ColumnIndex: col,
    RowSpan: rowSpan,
    ColumnSpan: colSpan,
    Relationships: wordIds.length > 0 ? [{Type: 'CHILD', Ids: wordIds}] : [],
  };
  return [cellBlock, ...tokens.map((token, index) => buildWord(wordIds[index], token))];
}

type AlbaRow = {
  cell: string;
  phenotype: string;
  donor: string;
  rh: [string, string, string, string, string, string, string, string]; // D C E c e f V Cw
};

/** Ground truth from ALBA panel image (rows 1–10, Rh-hr only). */
const ALBA_RH_GROUND_TRUTH: AlbaRow[] = [
  {cell: '1', phenotype: 'R1R1', donor: '6110302318014', rh: ['+', '+', '0', '0', '+', '+', 'NT', '+']},
  {cell: '2', phenotype: 'rr', donor: '2069930', rh: ['+', '+', '0', '+', '0', '+', 'NT', '+']},
  {cell: '3', phenotype: 'R0r', donor: '1787373', rh: ['+', '0', '+', '+', '0', '0', 'NT', '+']},
  {cell: '4', phenotype: 'R1R2', donor: '6110302318015', rh: ['+', '0', '+', '+', '+', '+', 'NT', '+']},
  {cell: '5', phenotype: 'R1r', donor: '6110302318016', rh: ['0', '+', '0', '0', '+', '+', 'NT', '+']},
  {cell: '6', phenotype: 'R2R2', donor: '6110302318017', rh: ['0', '+', '0', '0', '0', '+', 'NT', '+']},
  {cell: '7', phenotype: 'R1R1', donor: '6110302318018', rh: ['+', '+', '0', '+', '+', '0', '0', '+']},
  {cell: '8', phenotype: 'R1R0', donor: '6110302318019', rh: ['+', '+', '0', '0', '0', '+', 'NT', '+']},
  {cell: '9', phenotype: 'R1r', donor: '6110302318020', rh: ['0', '0', '0', '0', '+', '+', 'NT', '+']},
  {cell: '10', phenotype: 'R1R1', donor: '6110302318021', rh: ['0', '0', '0', '0', '0', '+', 'NT', '+']},
];

const RH_KEYS = ['D', 'C', 'E', 'c', 'e', 'f', 'V', 'Cw'] as const;

function buildAlbaRhFixture(options?: {
  /** Textract colSpan on merged antigen header — 8 = correct, 1 = common OCR bug */
  antigenHeaderColSpan?: number;
  /** If set, blank these raw grid columns (simulates Textract missing cells). */
  blankRawCols?: number[];
}): string {
  const blocks: Block[] = [];
  const tableChildIds: string[] = [];
  const headerColSpan = options?.antigenHeaderColSpan ?? 8;
  const blankCols = new Set(options?.blankRawCols ?? []);

  const appendCell = (
    id: string,
    row: number,
    col: number,
    text: string,
    rowSpan = 1,
    colSpan = 1,
    blockType = 'CELL',
  ) => {
    const cellBlocks = buildCell(id, row, col, text, rowSpan, colSpan, blockType);
    tableChildIds.push(id);
    blocks.push(...cellBlocks);
  };

  appendCell('cell-header', 1, 1, 'Cell #');
  appendCell('rh-group', 1, 2, 'Rh-hr', 1, 10, 'MERGED_CELL');
  appendCell('kell-group', 1, 12, 'KELL', 1, 2, 'MERGED_CELL');

  appendCell('rh-sub', 2, 2, 'Rh-hr');
  appendCell('donor-sub', 2, 3, 'Donor');
  appendCell('rh-antigens', 2, 4, 'D C E c e f V Cw', 1, headerColSpan, 'MERGED_CELL');
  appendCell('k-col', 2, 12, 'K');
  appendCell('little-k', 2, 13, 'k');

  ALBA_RH_GROUND_TRUTH.forEach((rowData, index) => {
    const row = 3 + index;
    appendCell(`row${row}-cell`, row, 1, rowData.cell);
    appendCell(`row${row}-phenotype`, row, 2, rowData.phenotype);
    appendCell(`row${row}-donor`, row, 3, rowData.donor);
    rowData.rh.forEach((value, rhIndex) => {
      const col = 4 + rhIndex;
      const text = blankCols.has(col) ? '' : value;
      appendCell(`row${row}-rh-${rhIndex}`, row, col, text);
    });
    appendCell(`row${row}-k`, row, 12, '+');
    appendCell(`row${row}-little-k`, row, 13, '0');
  });

  blocks.unshift({
    BlockType: 'TABLE',
    Id: 'table-alba-diagnostic',
    Relationships: [{Type: 'CHILD', Ids: tableChildIds}],
  });

  return JSON.stringify({Blocks: blocks});
}

function diagnose(label: string, json: string) {
  const parser = new PanelTableParser('ALBA');
  const result = parser.parse(json);
  const layout = result.panelData.metadata.columnLayout ?? [];
  const analysisLayout = layout.filter(column => column.kind === 'analysis');
  const sourceByKey = new Map(analysisLayout.map(column => [column.key, column.sourceColumn]));

  const rhMapping = RH_KEYS.map(key => ({
    antigen: key,
    sourceColumn: sourceByKey.get(key),
  }));

  const duplicateCols = rhMapping.filter(
    (entry, index, arr) =>
      entry.sourceColumn !== undefined &&
      arr.findIndex(other => other.sourceColumn === entry.sourceColumn) !== index,
  );

  const rhExtracted = result.panelData.cells.map((cell, rowIdx) => {
    const ground = ALBA_RH_GROUND_TRUTH[rowIdx];
    const extracted: Record<string, string> = {};
    const mismatches: string[] = [];
    for (const key of RH_KEYS) {
      extracted[key] = String(cell.results[key] ?? '');
      if (ground && extracted[key] !== ground.rh[RH_KEYS.indexOf(key)]) {
        mismatches.push(`${key}: expected ${ground.rh[RH_KEYS.indexOf(key)]}, got "${extracted[key]}"`);
      }
    }
    return {row: rowIdx + 1, extracted, mismatches};
  });

  const renderColumns = analysisLayout.map(column => ({
    key: column.key,
    kind: column.kind as 'analysis',
  }));
  const extraction = computeLiveExtractionAccuracy(
    result.panelData.cells,
    renderColumns,
    {cellConfidences: result.cellConfidences},
  );
  const manualCount = countManualVerificationSlots(
    result.panelData.cells,
    renderColumns,
    result.cellConfidences,
  );

  const emptyE = result.panelData.cells.filter(cell => !String(cell.results.E ?? '').trim()).length;
  const dSameAsC = result.panelData.cells.filter(
    cell => String(cell.results.D) === String(cell.results.C) && String(cell.results.D) !== '',
  ).length;

  return {
    label,
    rhMapping,
    duplicateCols,
    emptyECount: emptyE,
    dMatchesCCount: dSameAsC,
    extractionAccuracy: extraction.accuracyPercent,
    invalidSlots: extraction.invalidCount,
    manualVerification: manualCount,
    rhExtracted,
    parseErrors: result.parseErrors,
  };
}

describe('ALBA column diagnostic', () => {
  it('reports correct mapping when Textract header colSpan matches antigen count', () => {
    const report = diagnose('correct-colSpan-8', buildAlbaRhFixture({antigenHeaderColSpan: 8}));
    console.log('\n=== DIAGNOSTIC:', report.label, '===\n', JSON.stringify(report, null, 2));

    expect(report.duplicateCols).toHaveLength(0);
    expect(report.emptyECount).toBe(0);
    expect(report.extractionAccuracy).toBeGreaterThanOrEqual(95);
    expect(report.rhExtracted.every(row => row.mismatches.length === 0)).toBe(true);

    const parser = new PanelTableParser('ALBA');
    const result = parser.parse(buildAlbaRhFixture({antigenHeaderColSpan: 8}));
    expect(result.panelData.cells[0].phenotype).toBe('R1R1');
    expect(result.panelData.cells[0].donorNumber).toBe('6110302318014');
    expect(result.panelData.cells[1].phenotype).toBe('rr');
    expect(result.panelData.cells[1].donorNumber).toBe('2069930');
  });

  it('reports mapping failure when Textract collapses merged header to colSpan=1', () => {
    const report = diagnose('broken-colSpan-1', buildAlbaRhFixture({antigenHeaderColSpan: 1}));
    console.log('\n=== DIAGNOSTIC:', report.label, '===\n', JSON.stringify(report, null, 2));

    // This reproduces buyer symptoms: D/C duplicate pattern, E empty, low accuracy
    expect(report.duplicateCols.length + report.emptyECount + report.dMatchesCCount).toBeGreaterThan(0);
  });

  it('leaves E blank when Textract E cells are missing instead of borrowing neighbors', () => {
    const report = diagnose(
      'textract-empty-E-col6',
      buildAlbaRhFixture({antigenHeaderColSpan: 8, blankRawCols: [6]}),
    );
    console.log('\n=== DIAGNOSTIC:', report.label, '===\n', JSON.stringify(report, null, 2));

    expect(report.duplicateCols).toHaveLength(0);
    expect(report.rhMapping.find(entry => entry.antigen === 'E')?.sourceColumn).toBe(6);
    expect(report.emptyECount).toBeGreaterThan(0);
    expect(report.rhExtracted.filter(row => row.mismatches.some(m => m.startsWith('E:'))).length)
      .toBeGreaterThan(0);
  });

  it('explains 68% accuracy: schema projection adds undetected columns as empty slots', () => {
    const parser = new PanelTableParser('ALBA');
    const result = parser.parse(buildAlbaRhFixture({antigenHeaderColSpan: 8}));
    const layout = result.panelData.metadata.columnLayout ?? [];
    const analysisColumns = filterAnalysisExtractionColumns(
      layout.map(column => ({key: column.key, kind: column.kind})),
    );
    const detectedOnly = computeLiveExtractionAccuracy(
      result.panelData.cells,
      analysisColumns,
      {cellConfidences: result.cellConfidences},
    );
    const withSchemaUnion = computeLiveExtractionAccuracy(
      result.panelData.cells,
      analysisColumns,
      {
        cellConfidences: result.cellConfidences,
        expectedKeys: ['D', 'C', 'E', 'c', 'e', 'f', 'V', 'Cw', 'K', 'k', 'Kpa', 'Kpb', 'Jsa', 'Jsb', 'Fya', 'Fyb', 'Jka', 'Jkb', 'Lea', 'Leb', 'M', 'N', 'S', 's', 'P1', 'Lua', 'Lub', 'Xga', 'Wra'],
      },
    );

    console.log('\n=== SCHEMA SLOT ANALYSIS ===\n', JSON.stringify({
      analysisColumnsInLayout: analysisColumns.length,
      columnKeys: analysisColumns.map(c => c.key),
      detectedOnlyAccuracy: detectedOnly.accuracyPercent,
      detectedOnlyInvalid: detectedOnly.invalidCount,
      detectedOnlySlots: detectedOnly.slotCount,
      withSchemaUnionAccuracy: withSchemaUnion.accuracyPercent,
      withSchemaUnionInvalid: withSchemaUnion.invalidCount,
      withSchemaUnionSlots: withSchemaUnion.slotCount,
      parserReportedAccuracy: result.metrics.extractionAccuracy,
    }, null, 2));

    expect(withSchemaUnion.slotCount).toBeGreaterThan(detectedOnly.slotCount);
    expect(withSchemaUnion.accuracyPercent).toBeLessThan(detectedOnly.accuracyPercent);
    expect(result.metrics.extractionAccuracy).toBe(detectedOnly.accuracyPercent);
  });
});
