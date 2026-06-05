import {
  AntigenGroups,
  CellData,
  OcrColumnGroup,
  OcrStructureMetrics,
  OcrStructuredRow,
  OcrUnreadableCell,
  OcrValidationIssue,
  PanelData,
  PanelMetadata,
  ParsedColumnLayout,
  ResultValue,
} from '../types';
import {summarizeExtractionAccuracy} from '../utils/ocrExtractionValidation';
import {computeOverallOcrConfidence, capOverallScoreByExtraction} from '../utils/ocrTableConfidence';
import * as AntigenData from './AntigenData';

const LOW_CONFIDENCE_WARN_THRESHOLD = 52;
export const MIN_TABLE_CONFIDENCE = 60;

const DATA_ROW_RESULT_RE = /^(?:\+|0|\/|NT|MF|W\+|[1-4]\+|\+W|\+S)$/i;

export interface CellConfidence {
  rowIndex: number;
  colIndex: number;
  columnKey: string;
  value: string;
  confidence: number;
  needsReview: boolean;
}

export interface ParseResult {
  panelData: PanelData;
  overallConfidence: number;
  cellConfidences: CellConfidence[][];
  lowConfidenceCells: CellConfidence[];
  parseErrors: string[];
  metrics: OcrStructureMetrics;
}

interface TextractBlock {
  BlockType: string;
  Id: string;
  Confidence?: number;
  Text?: string;
  RowIndex?: number;
  ColumnIndex?: number;
  RowSpan?: number;
  ColumnSpan?: number;
  Relationships?: Array<{Type: string; Ids: string[]}>;
  EntityTypes?: string[];
}

interface TextractResponse {
  Blocks: TextractBlock[];
}

interface RawTableCell {
  row: number;
  col: number;
  rowSpan: number;
  colSpan: number;
  text: string;
  confidence: number;
  blockType: string;
  entityTypes: string[];
}

interface RawTable {
  cells: RawTableCell[];
  numRows: number;
  numCols: number;
}

interface ColumnDescriptor {
  sourceColumn: number;
  antigen: string;
  label: string;
  expectedGroup: string;
  detectedGroup: string;
  headerPath: string[];
  kind: 'analysis' | 'supplemental';
  required: boolean;
  evidence:
    | 'exact'
    | 'combined'
    | 'group_span'
    | 'compact'
    | 'schema_projection';
}

interface GroupSpan {
  group: string;
  startCol: number;
  endCol: number;
  row: number;
}

interface SpecialColumns {
  cellNumberCol: number;
  donorNumberCol: number;
  phenotypeCol: number;
  resultCol: number;
}

interface HeaderAnalysis {
  headerRows: number[];
  dataStartRow: number;
}

interface ProjectionCandidate {
  startCol: number;
  endCol: number;
  evidenceScore: number;
}

const RESULT_MAP: Record<string, ResultValue> = {
  '+': '+',
  'POS': '+',
  'P': '+',
  '1+': '+',
  '2+': '+',
  '3+': '+',
  '4+': '+',
  '+S': '+s',
  'S+': '+s',
  '+W': '+w',
  'W+': '+w',
  'WEAK': '+w',
  '0': '0',
  'NEG': '0',
  'N': '0',
  '-': '0',
  '/': '/',
  'NT': 'NT',
};

const EVIDENCE_SCORES: Record<ColumnDescriptor['evidence'], number> = {
  exact: 100,
  combined: 98,
  group_span: 96,
  compact: 94,
  schema_projection: 92,
};

const SPECIAL_COLUMN_ALIASES = {
  cell: ['cell', 'cellno', 'cellnumber', '#', 'no'],
  donor: ['donor', 'donornumber', 'lot', 'unit', 'unitnumber'],
  phenotype: ['phenotype', 'pheno', 'rhhr'],
  result: ['result', 'results', 'test', 'testresult', 'testresults', 'is', 'rxn'],
};

const EXTRA_GROUP_ALIASES: Record<string, string[]> = {
  'Additional Antigens': [
    'additonalantigens',
    'additionalantigen',
    'additionalantigens',
    'antigens',
    'othersspecial',
    'specialtypes',
    'specialantigentyping',
  ],
  'Additonal Antigens': [
    'additionalantigen',
    'additionalantigens',
    'antigens',
    'othersspecial',
    'specialtypes',
    'specialantigentyping',
  ],
};

function normalizeInsensitiveKey(raw: string): string {
  return raw
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9]+/g, '')
    .toLowerCase();
}

function normalizeExactKey(raw: string): string {
  return raw
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9]+/g, '');
}

function splitHeaderTokens(raw: string): string[] {
  const normalized = raw.normalize('NFKD').replace(/[^\w\s]+/g, ' ');
  return normalized
    .split(/\s+/)
    .map(token => token.trim())
    .filter(Boolean);
}

function normaliseResultValue(raw: string): {value: ResultValue; exact: boolean} {
  const cleaned = raw.trim().toUpperCase();
  if (cleaned === '') {
    return {value: '', exact: true};
  }

  if (cleaned in RESULT_MAP) {
    return {value: RESULT_MAP[cleaned], exact: true};
  }

  if (/^[1-4][+]?$/.test(cleaned)) {
    return {value: '+', exact: true};
  }

  return {value: '?', exact: false};
}

function isBlankLikeNoise(raw: string): boolean {
  const trimmed = raw.trim();
  if (!trimmed) {
    return true;
  }

  const compact = trimmed.replace(/\s+/g, '');
  return /^[.,:;'"`’‘~_|¦]+$/.test(compact);
}

function retryNormaliseResultValue(raw: string): {
  value: ResultValue;
  exact: boolean;
  recovered: boolean;
  blankLike: boolean;
} {
  if (isBlankLikeNoise(raw)) {
    return {
      value: '',
      exact: true,
      recovered: true,
      blankLike: true,
    };
  }

  const compact = raw
    .normalize('NFKD')
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace(/[()[\]{}]/g, '')
    .replace(/[’‘]/g, "'");

  if (!compact) {
    return {
      value: '',
      exact: true,
      recovered: true,
      blankLike: true,
    };
  }

  if (compact.includes('+')) {
    if (compact.includes('W')) {
      return {value: '+w', exact: true, recovered: true, blankLike: false};
    }
    if (compact.includes('S')) {
      return {value: '+s', exact: true, recovered: true, blankLike: false};
    }
    return {value: '+', exact: true, recovered: true, blankLike: false};
  }

  if (/^N[T7]$/.test(compact) || compact === 'TN') {
    return {value: 'NT', exact: true, recovered: true, blankLike: false};
  }

  if (/^[OQD]$/.test(compact) || compact === '00' || compact === 'OO') {
    return {value: '0', exact: true, recovered: true, blankLike: false};
  }

  if (compact === 'I' || compact === '|' || compact === '1') {
    return {value: '/', exact: true, recovered: true, blankLike: false};
  }

  return {value: '?', exact: false, recovered: false, blankLike: false};
}

function resolveCellResultValue(raw: string): {
  value: ResultValue;
  exact: boolean;
  recovered: boolean;
  blankLike: boolean;
} {
  const primary = normaliseResultValue(raw);
  if (primary.exact) {
    return {
      value: primary.value,
      exact: true,
      recovered: false,
      blankLike: primary.value === '',
    };
  }

  return retryNormaliseResultValue(raw);
}

function buildBlockMap(blocks: TextractBlock[]): Map<string, TextractBlock> {
  const blockMap = new Map<string, TextractBlock>();
  for (const block of blocks) {
    blockMap.set(block.Id, block);
  }
  return blockMap;
}

function collectBlockText(
  block: TextractBlock,
  blockMap: Map<string, TextractBlock>,
  visited = new Set<string>(),
): {text: string; confidence: number} {
  if (visited.has(block.Id)) {
    return {text: '', confidence: 100};
  }

  visited.add(block.Id);

  if (block.BlockType === 'WORD') {
    return {
      text: block.Text ?? '',
      confidence: block.Confidence ?? 100,
    };
  }

  let textParts: string[] = [];
  let confidenceTotal = 0;
  let confidenceCount = 0;

  const childIds = block.Relationships?.find(rel => rel.Type === 'CHILD')?.Ids ?? [];
  for (const childId of childIds) {
    const childBlock = blockMap.get(childId);
    if (!childBlock) {
      continue;
    }

    const childText = collectBlockText(childBlock, blockMap, visited);
    if (childText.text.trim()) {
      textParts.push(childText.text.trim());
    }
    confidenceTotal += childText.confidence;
    confidenceCount++;
  }

  if (textParts.length === 0 && block.Text?.trim()) {
    textParts = [block.Text.trim()];
    confidenceTotal += block.Confidence ?? 100;
    confidenceCount++;
  }

  return {
    text: textParts.join(' ').trim(),
    confidence: confidenceCount > 0 ? confidenceTotal / confidenceCount : 100,
  };
}

function extractTables(
  blocks: TextractBlock[],
  blockMap: Map<string, TextractBlock>,
): RawTable[] {
  const tables: RawTable[] = [];

  for (const block of blocks) {
    if (block.BlockType !== 'TABLE') {
      continue;
    }

    const childIds = block.Relationships?.find(rel => rel.Type === 'CHILD')?.Ids ?? [];
    const cells: RawTableCell[] = [];
    let maxRow = 0;
    let maxCol = 0;

    for (const childId of childIds) {
      const child = blockMap.get(childId);
      if (!child || (child.BlockType !== 'CELL' && child.BlockType !== 'MERGED_CELL')) {
        continue;
      }

      const row = child.RowIndex ?? 1;
      const col = child.ColumnIndex ?? 1;
      const rowSpan = child.RowSpan ?? 1;
      const colSpan = child.ColumnSpan ?? 1;
      const textPayload = collectBlockText(child, blockMap);

      cells.push({
        row,
        col,
        rowSpan,
        colSpan,
        text: textPayload.text,
        confidence: textPayload.confidence,
        blockType: child.BlockType,
        entityTypes: child.EntityTypes ?? [],
      });

      maxRow = Math.max(maxRow, row + rowSpan - 1);
      maxCol = Math.max(maxCol, col + colSpan - 1);
    }

    tables.push({cells, numRows: maxRow, numCols: maxCol});
  }

  return tables;
}

function tableToGrid(table: RawTable): Array<Array<{text: string; confidence: number}>> {
  const grid: Array<Array<{text: string; confidence: number}>> = [];
  for (let row = 0; row <= table.numRows; row++) {
    grid.push(
      Array(table.numCols + 1)
        .fill(null)
        .map(() => ({text: '', confidence: 100})),
    );
  }

  for (const cell of table.cells) {
    for (let rowOffset = 0; rowOffset < cell.rowSpan; rowOffset++) {
      for (let colOffset = 0; colOffset < cell.colSpan; colOffset++) {
        const row = cell.row + rowOffset;
        const col = cell.col + colOffset;
        if (row <= table.numRows && col <= table.numCols) {
          grid[row][col] = {text: cell.text, confidence: cell.confidence};
        }
      }
    }
  }

  return grid;
}

function getRenderableGroups(manufacturer: string): AntigenGroups {
  return AntigenData.getOcrRenderableGroups(manufacturer);
}

function getAnalysisGroups(manufacturer: string): AntigenGroups {
  return AntigenData.getOcrAnalysisGroups(manufacturer);
}

function getSchemaColumns(manufacturer: string) {
  return AntigenData.getOcrRenderSchema(manufacturer).flatMap(schemaGroup =>
    schemaGroup.columns.map(column => ({
      ...column,
      group: schemaGroup.group,
      groupAliases: schemaGroup.aliases ?? [],
    })),
  );
}

function getRenderableColumnKeys(manufacturer: string): string[] {
  return getSchemaColumns(manufacturer).map(column => column.key);
}

function buildAntigenLookup(
  columns: Array<{key: string; aliases?: string[]}>,
): Map<string, string> {
  const lookup = new Map<string, string>();
  for (const column of columns) {
    lookup.set(normalizeExactKey(column.key), column.key);
    for (const alias of column.aliases ?? []) {
      lookup.set(normalizeExactKey(alias), column.key);
    }
  }
  return lookup;
}

function buildGroupLookup(groups: AntigenGroups): Map<string, string> {
  const lookup = new Map<string, string>();
  for (const groupName of Object.keys(groups)) {
    lookup.set(normalizeInsensitiveKey(groupName), groupName);
    for (const alias of EXTRA_GROUP_ALIASES[groupName] ?? []) {
      lookup.set(normalizeInsensitiveKey(alias), groupName);
    }
  }
  return lookup;
}

function buildAntigenToGroupMap(groups: AntigenGroups): Map<string, string> {
  const map = new Map<string, string>();
  for (const [groupName, antigens] of Object.entries(groups)) {
    for (const antigen of antigens) {
      map.set(antigen, groupName);
    }
  }
  return map;
}

function findHeaderRow(
  grid: Array<Array<{text: string; confidence: number}>>,
  knownAntigens: string[],
): number {
  const antigenSet = new Set(knownAntigens.map(antigen => normalizeInsensitiveKey(antigen)));

  for (let row = 1; row < grid.length; row++) {
    let matches = 0;
    for (const cell of grid[row]) {
      if (antigenSet.has(normalizeInsensitiveKey(cell.text))) {
        matches++;
      }
    }
    if (matches >= Math.max(2, Math.floor(knownAntigens.length * 0.25))) {
      return row;
    }
  }

  return 1;
}

function findDataStartRow(grid: Array<Array<{text: string; confidence: number}>>): number {
  for (let row = 1; row < grid.length; row++) {
    const cells = grid[row] ?? [];
    const nonEmptyCount = cells.filter(cell => cell.text.trim()).length;
    const resultLikeCount = cells.filter(cell => DATA_ROW_RESULT_RE.test(cell.text.trim())).length;
    if (nonEmptyCount >= 5 && resultLikeCount >= 3) {
      return row;
    }
  }

  return -1;
}

function analyseHeaderRows(
  table: RawTable,
  grid: Array<Array<{text: string; confidence: number}>>,
  knownAntigens: string[],
): HeaderAnalysis {
  const detectedDataStartRow = findDataStartRow(grid);
  if (detectedDataStartRow > 1) {
    const headerRows: number[] = [];
    for (let row = 1; row < detectedDataStartRow; row++) {
      const hasText = (grid[row] ?? []).some(cell => cell.text.trim());
      if (hasText) {
        headerRows.push(row);
      }
    }

    if (headerRows.length > 0) {
      return {
        headerRows,
        dataStartRow: detectedDataStartRow,
      };
    }
  }

  const headerRow = findHeaderRow(grid, knownAntigens);
  return {
    headerRows: Array.from({length: headerRow}, (_, index) => index + 1),
    dataStartRow: Math.min(table.numRows, headerRow + 1),
  };
}

function getCoveringHeaderCells(table: RawTable, headerRows: number[], colIndex: number): RawTableCell[] {
  const headerRowSet = new Set(headerRows);
  return table.cells
    .filter(cell => {
      if (colIndex < cell.col || colIndex > cell.col + cell.colSpan - 1) {
        return false;
      }

      for (let row = cell.row; row < cell.row + cell.rowSpan; row++) {
        if (headerRowSet.has(row)) {
          return true;
        }
      }
      return false;
    })
    .sort((left, right) => {
      if (left.row !== right.row) {
        return left.row - right.row;
      }
      return right.rowSpan - left.rowSpan;
    });
}

function buildHeaderPathForColumn(
  table: RawTable,
  headerRows: number[],
  colIndex: number,
): string[] {
  return Array.from(
    new Set(
      getCoveringHeaderCells(table, headerRows, colIndex)
        .map(cell => cell.text.trim())
        .filter(Boolean),
    ),
  );
}

function resolveAntigenValue(raw: string, lookup: Map<string, string>): string | null {
  const exact = lookup.get(normalizeExactKey(raw));
  if (exact) {
    return exact;
  }

  const caseInsensitiveKey = normalizeInsensitiveKey(raw);
  const matches = uniqueValues(
    Array.from(lookup.entries())
      .filter(([lookupKey]) => normalizeInsensitiveKey(lookupKey) === caseInsensitiveKey)
      .map(([, antigen]) => antigen),
  );

  return matches.length === 1 ? matches[0] : null;
}

function resolveGroupValue(raw: string, lookup: Map<string, string>): string | null {
  return lookup.get(normalizeInsensitiveKey(raw)) ?? null;
}

function resolvePerColumnToken(cell: RawTableCell, colIndex: number, lookup: Map<string, string>): string | null {
  const tokens = splitHeaderTokens(cell.text);
  if (cell.colSpan <= 1 || tokens.length !== cell.colSpan) {
    return null;
  }

  const token = tokens[colIndex - cell.col];
  if (!token) {
    return null;
  }

  return resolveAntigenValue(token, lookup);
}

function resolveCombinedToken(
  parentText: string,
  childText: string,
  lookup: Map<string, string>,
): string | null {
  const combined = `${normalizeExactKey(parentText)}${normalizeExactKey(childText)}`;
  const exact = lookup.get(combined);
  if (exact) {
    return exact;
  }

  const caseInsensitiveKey = normalizeInsensitiveKey(`${parentText}${childText}`);
  const matches = uniqueValues(
    Array.from(lookup.entries())
      .filter(([lookupKey]) => normalizeInsensitiveKey(lookupKey) === caseInsensitiveKey)
      .map(([, antigen]) => antigen),
  );

  return matches.length === 1 ? matches[0] : null;
}

function resolveDetectedGroup(
  headerPath: string[],
  groupLookup: Map<string, string>,
): string {
  for (const label of headerPath) {
    const match = resolveGroupValue(label, groupLookup);
    if (match) {
      return match;
    }
  }
  return '';
}

function detectGroupSpans(
  table: RawTable,
  headerRows: number[],
  groupLookup: Map<string, string>,
): GroupSpan[] {
  const headerRowSet = new Set(headerRows);
  const deduped = new Map<string, GroupSpan>();

  for (const cell of table.cells) {
    if (!cell.text.trim()) {
      continue;
    }

    const touchesHeader = Array.from({length: cell.rowSpan}, (_, index) => cell.row + index)
      .some(row => headerRowSet.has(row));
    if (!touchesHeader) {
      continue;
    }

    const groupName = resolveGroupValue(cell.text, groupLookup);
    if (!groupName) {
      continue;
    }

    const span: GroupSpan = {
      group: groupName,
      startCol: cell.col,
      endCol: cell.col + cell.colSpan - 1,
      row: cell.row,
    };

    const key = `${groupName}:${span.startCol}:${span.endCol}`;
    const existing = deduped.get(key);
    if (!existing || span.row < existing.row) {
      deduped.set(key, span);
    }
  }

  return Array.from(deduped.values()).sort((left, right) => {
    if (left.row !== right.row) {
      return left.row - right.row;
    }
    return left.startCol - right.startCol;
  });
}

function getGroupSpanForColumn(groupSpans: GroupSpan[], colIndex: number): GroupSpan | null {
  const matches = groupSpans.filter(
    span => colIndex >= span.startCol && colIndex <= span.endCol,
  );
  if (matches.length === 0) {
    return null;
  }

  return matches.sort((left, right) => {
    if (left.row !== right.row) {
      return left.row - right.row;
    }
    const leftWidth = left.endCol - left.startCol;
    const rightWidth = right.endCol - right.startCol;
    return rightWidth - leftWidth;
  })[0];
}

// FIXED: This function now correctly maps antigens from group spans
// even when the span width doesn't exactly match the expected antigens length.
// This fixes the duplicate "Rh-hr" issue where D, C, E were missing.
function resolveGroupSpanAntigen(
  cell: RawTableCell,
  colIndex: number,
  groupSpan: GroupSpan | null,
  antigenGroups: AntigenGroups,
): string | null {
  if (!groupSpan) {
    return null;
  }

  const expectedAntigens = antigenGroups[groupSpan.group] ?? [];
  
  if (expectedAntigens.length === 0) {
    return null;
  }

  const cellStartOffset = cell.col - groupSpan.startCol;
  const indexInCell = colIndex - cell.col;
  const absoluteOffset = cellStartOffset + indexInCell;
  
  if (absoluteOffset < 0 || absoluteOffset >= expectedAntigens.length) {
    return null;
  }

  return expectedAntigens[absoluteOffset] ?? null;
}

function longestSharedPrefix(values: string[]): string {
  if (values.length === 0) {
    return '';
  }

  let prefix = values[0];
  for (let index = 1; index < values.length; index++) {
    while (prefix && !values[index].startsWith(prefix)) {
      prefix = prefix.slice(0, -1);
    }

    if (!prefix) {
      break;
    }
  }

  return prefix;
}

function scoreCompactSequence(rawToken: string, antigens: string[]): number {
  const normalizedToken = normalizeInsensitiveKey(rawToken);
  if (!normalizedToken) {
    return -1;
  }

  const normalizedAntigens = antigens.map(antigen => normalizeInsensitiveKey(antigen));
  const concatenated = normalizedAntigens.join('');
  const initials = normalizedAntigens.map(antigen => antigen[0] ?? '').join('');
  const sharedPrefix = longestSharedPrefix(normalizedAntigens);

  let score = -1;

  if (normalizedAntigens.length === 1) {
    const antigen = normalizedAntigens[0];
    if (antigen === normalizedToken) {
      score = Math.max(score, 250);
    }
    if (antigen.startsWith(normalizedToken) || normalizedToken.startsWith(antigen)) {
      score = Math.max(score, 210 - Math.abs(antigen.length - normalizedToken.length) * 12);
    }
  }

  if (concatenated === normalizedToken) {
    score = Math.max(score, 280);
  }
  if (concatenated.startsWith(normalizedToken) || normalizedToken.startsWith(concatenated)) {
    score = Math.max(score, 220 - Math.abs(concatenated.length - normalizedToken.length) * 8);
  }

  if (sharedPrefix.length >= 2) {
    if (sharedPrefix === normalizedToken) {
      score = Math.max(score, 240);
    }
    if (sharedPrefix.startsWith(normalizedToken) || normalizedToken.startsWith(sharedPrefix)) {
      score = Math.max(score, 205 - Math.abs(sharedPrefix.length - normalizedToken.length) * 12);
    }
  }

  if (initials && (initials === normalizedToken || initials.startsWith(normalizedToken) || normalizedToken.startsWith(initials))) {
    score = Math.max(score, 190 - Math.abs(initials.length - normalizedToken.length) * 10);
  }

  if (normalizedAntigens.every(antigen => antigen.startsWith(normalizedToken))) {
    score = Math.max(score, 200 - Math.max(0, normalizedAntigens[0].length - normalizedToken.length) * 8);
  }

  if (concatenated.includes(normalizedToken)) {
    score = Math.max(score, normalizedToken.length * 10);
  }

  return score;
}

function resolveCompactSequenceAntigen(
  cell: RawTableCell,
  colIndex: number,
  detectedGroup: string,
  antigenGroups: AntigenGroups,
): string | null {
  if (!cell.text.trim()) {
    return null;
  }

  const indexInCell = colIndex - cell.col;
  if (indexInCell < 0 || indexInCell >= cell.colSpan) {
    return null;
  }

  const candidateGroups = detectedGroup
    ? [detectedGroup, ...Object.keys(antigenGroups).filter(groupName => groupName !== detectedGroup)]
    : Object.keys(antigenGroups);

  const candidates: Array<{score: number; antigens: string[]}> = [];

  for (const groupName of candidateGroups) {
    const groupAntigens = antigenGroups[groupName] ?? [];
    if (groupAntigens.length === 0 || groupAntigens.length < cell.colSpan) {
      continue;
    }

    if (cell.colSpan === 1) {
      for (const antigen of groupAntigens) {
        const score = scoreCompactSequence(cell.text, [antigen]);
        if (score >= 150) {
          candidates.push({score, antigens: [antigen]});
        }
      }
      continue;
    }

    for (let startIndex = 0; startIndex <= groupAntigens.length - cell.colSpan; startIndex++) {
      const sequence = groupAntigens.slice(startIndex, startIndex + cell.colSpan);
      const score = scoreCompactSequence(cell.text, sequence);
      if (score >= 150) {
        candidates.push({score, antigens: sequence});
      }
    }
  }

  if (candidates.length === 0) {
    return null;
  }

  candidates.sort((left, right) => right.score - left.score);
  const [best, secondBest] = candidates;
  if (secondBest && best.score - secondBest.score < 15) {
    return null;
  }

  return best.antigens[indexInCell] ?? null;
}

function classifySpecialColumn(headerPath: string[]): keyof SpecialColumns | undefined {
  const labels = headerPath
    .map(label => normalizeInsensitiveKey(label))
    .filter(Boolean);

  if (labels.some(label => SPECIAL_COLUMN_ALIASES.result.includes(label))) {
    return 'resultCol';
  }
  if (labels.some(label => SPECIAL_COLUMN_ALIASES.cell.includes(label))) {
    return 'cellNumberCol';
  }
  if (labels.some(label => SPECIAL_COLUMN_ALIASES.donor.includes(label))) {
    return 'donorNumberCol';
  }
  if (labels.some(label => SPECIAL_COLUMN_ALIASES.phenotype.includes(label))) {
    return 'phenotypeCol';
  }

  return undefined;
}

function toColumnDescriptor(
  sourceColumn: number,
  columnKey: string,
  detectedGroup: string,
  headerPath: string[],
  evidence: ColumnDescriptor['evidence'],
  schemaColumnMap: Map<string, {
    key: string;
    label: string;
    kind: 'analysis' | 'supplemental';
    required: boolean;
    aliases?: string[];
    group: string;
    groupAliases: string[];
  }>,
  antigenToGroupMap: Map<string, string>,
): ColumnDescriptor {
  const schemaColumn = schemaColumnMap.get(columnKey);

  return {
    sourceColumn,
    antigen: columnKey,
    label: schemaColumn?.label ?? columnKey,
    expectedGroup: schemaColumn?.group ?? antigenToGroupMap.get(columnKey) ?? detectedGroup,
    detectedGroup,
    headerPath,
    kind: schemaColumn?.kind ?? 'analysis',
    required: schemaColumn?.required ?? true,
    evidence,
  };
}

function buildColumnDescriptor(
  table: RawTable,
  headerRows: number[],
  colIndex: number,
  antigenLookup: Map<string, string>,
  groupLookup: Map<string, string>,
  antigenToGroupMap: Map<string, string>,
  antigenGroups: AntigenGroups,
  groupSpans: GroupSpan[],
  schemaColumnMap: Map<string, {
    key: string;
    label: string;
    kind: 'analysis' | 'supplemental';
    required: boolean;
    aliases?: string[];
    group: string;
    groupAliases: string[];
  }>,
): {descriptor?: ColumnDescriptor; specialColumn?: keyof SpecialColumns; headerPath: string[]} {
  const coveringCells = getCoveringHeaderCells(table, headerRows, colIndex);
  const headerPath = buildHeaderPathForColumn(table, headerRows, colIndex);
  const groupSpan = getGroupSpanForColumn(groupSpans, colIndex);
  const detectedGroup = groupSpan?.group || resolveDetectedGroup(headerPath, groupLookup);

  const candidatePieces: string[] = [];
  let positionalFallback: string | null = null;
  let compactFallback: string | null = null;
  for (const cell of coveringCells) {
    const perColumnToken = resolvePerColumnToken(cell, colIndex, antigenLookup);
    if (perColumnToken) {
      return {
        descriptor: toColumnDescriptor(
          colIndex,
          perColumnToken,
          detectedGroup,
          headerPath,
          'exact',
          schemaColumnMap,
          antigenToGroupMap,
        ),
        headerPath,
      };
    }

    if (!positionalFallback) {
      positionalFallback = resolveGroupSpanAntigen(cell, colIndex, groupSpan, antigenGroups);
    }
    if (!compactFallback) {
      compactFallback = resolveCompactSequenceAntigen(
        cell,
        colIndex,
        detectedGroup,
        antigenGroups,
      );
    }

    if (cell.text.trim()) {
      candidatePieces.push(cell.text.trim());
    }
  }

  for (let index = candidatePieces.length - 1; index >= 0; index--) {
    const direct = resolveAntigenValue(candidatePieces[index], antigenLookup);
    if (direct) {
      return {
        descriptor: toColumnDescriptor(
          colIndex,
          direct,
          detectedGroup,
          headerPath,
          'exact',
          schemaColumnMap,
          antigenToGroupMap,
        ),
        headerPath,
      };
    }
  }

  for (let parentIndex = 0; parentIndex < candidatePieces.length; parentIndex++) {
    for (let childIndex = parentIndex + 1; childIndex < candidatePieces.length; childIndex++) {
      const combined = resolveCombinedToken(
        candidatePieces[parentIndex],
        candidatePieces[childIndex],
        antigenLookup,
      );
      if (combined) {
        return {
          descriptor: toColumnDescriptor(
            colIndex,
            combined,
            detectedGroup,
            headerPath,
            'combined',
            schemaColumnMap,
            antigenToGroupMap,
          ),
          headerPath,
        };
      }
    }
  }

  if (positionalFallback) {
    return {
      descriptor: toColumnDescriptor(
        colIndex,
        positionalFallback,
        detectedGroup,
        headerPath,
        'group_span',
        schemaColumnMap,
        antigenToGroupMap,
      ),
      headerPath,
    };
  }

  if (compactFallback) {
    return {
      descriptor: toColumnDescriptor(
        colIndex,
        compactFallback,
        detectedGroup,
        headerPath,
        'compact',
        schemaColumnMap,
        antigenToGroupMap,
      ),
      headerPath,
    };
  }

  const specialColumn = classifySpecialColumn(headerPath);
  return {specialColumn, headerPath};
}


function stabilizeDescriptorsFromGroupSpans(
  table: RawTable,
  headerRows: number[],
  columnDescriptors: ColumnDescriptor[],
  groupSpans: GroupSpan[],
  antigenGroups: AntigenGroups,
  antigenToGroupMap: Map<string, string>,
  schemaColumnMap: Map<string, {
    key: string;
    label: string;
    kind: 'analysis' | 'supplemental';
    required: boolean;
    aliases?: string[];
    group: string;
    groupAliases: string[];
  }>,
): ColumnDescriptor[] {
  const descriptorsByColumn = new Map<number, ColumnDescriptor>();
  for (const descriptor of columnDescriptors) {
    descriptorsByColumn.set(descriptor.sourceColumn, descriptor);
  }

  for (const span of groupSpans) {
    const expectedAntigens = antigenGroups[span.group] ?? [];
    const spanWidth = span.endCol - span.startCol + 1;
    if (expectedAntigens.length === 0 || expectedAntigens.length !== spanWidth) {
      continue;
    }

    for (let offset = 0; offset < spanWidth; offset++) {
      const sourceColumn = span.startCol + offset;
      const antigen = expectedAntigens[offset];
      const headerPath = buildHeaderPathForColumn(table, headerRows, sourceColumn);
      const existing = descriptorsByColumn.get(sourceColumn);

      descriptorsByColumn.set(
        sourceColumn,
        toColumnDescriptor(
          sourceColumn,
          antigen,
          span.group,
          headerPath,
          existing?.antigen === antigen ? existing.evidence : 'group_span',
          schemaColumnMap,
          antigenToGroupMap,
        ),
      );
    }
  }

  return Array.from(descriptorsByColumn.values()).sort(
    (left, right) => left.sourceColumn - right.sourceColumn,
  );
}

function buildSchemaProjectionCandidates(
  table: RawTable,
  schemaColumns: Array<{
    key: string;
    label: string;
    kind: 'analysis' | 'supplemental';
    required: boolean;
    aliases?: string[];
    group: string;
    groupAliases: string[];
  }>,
  columnDescriptors: ColumnDescriptor[],
  groupSpans: GroupSpan[],
  specialColumns: SpecialColumns,
): ProjectionCandidate[] {
  const schemaWidth = schemaColumns.length;
  if (schemaWidth === 0) {
    return [];
  }

  const candidates: ProjectionCandidate[] = [];
  const pushCandidate = (startCol: number, endCol: number, evidenceScore: number) => {
    if (startCol < 1 || endCol > table.numCols || endCol < startCol) {
      return;
    }

    if (endCol - startCol + 1 !== schemaWidth) {
      return;
    }

    candidates.push({startCol, endCol, evidenceScore});
  };

  if (specialColumns.resultCol > 0) {
    pushCandidate(
      specialColumns.resultCol - schemaWidth,
      specialColumns.resultCol - 1,
      95,
    );
  }

  if (groupSpans.length > 0) {
    const groupedSpans = groupSpans
      .slice()
      .sort((left, right) => left.startCol - right.startCol);
    const startCol = groupedSpans[0].startCol;
    const endCol = groupedSpans[groupedSpans.length - 1].endCol;
    if (endCol - startCol + 1 === schemaWidth) {
      pushCandidate(startCol, endCol, 90);
    }
  }

  if (columnDescriptors.length > 0) {
    const sortedColumns = columnDescriptors
      .map(descriptor => descriptor.sourceColumn)
      .sort((left, right) => left - right);
    const firstCol = sortedColumns[0];
    const lastCol = sortedColumns[sortedColumns.length - 1];
    pushCandidate(firstCol, firstCol + schemaWidth - 1, 75);
    pushCandidate(lastCol - schemaWidth + 1, lastCol, 75);
  }

  return Array.from(
    new Map(
      candidates.map(candidate => [
        `${candidate.startCol}:${candidate.endCol}`,
        candidate,
      ]),
    ).values(),
  );
}

function scoreSchemaProjectionCandidate(
  candidate: ProjectionCandidate,
  table: RawTable,
  headerRows: number[],
  schemaColumns: Array<{
    key: string;
    label: string;
    kind: 'analysis' | 'supplemental';
    required: boolean;
    aliases?: string[];
    group: string;
    groupAliases: string[];
  }>,
  columnDescriptors: ColumnDescriptor[],
  groupSpans: GroupSpan[],
  groupLookup: Map<string, string>,
): number {
  const descriptorByColumn = new Map(
    columnDescriptors.map(descriptor => [descriptor.sourceColumn, descriptor]),
  );

  let directMatches = 0;
  let groupMatches = 0;
  let conflictingColumns = 0;
  let headerCoverage = 0;

  schemaColumns.forEach((schemaColumn, index) => {
    const sourceColumn = candidate.startCol + index;
    const descriptor = descriptorByColumn.get(sourceColumn);
    const headerPath = buildHeaderPathForColumn(table, headerRows, sourceColumn);
    const groupSpan = getGroupSpanForColumn(groupSpans, sourceColumn);
    const detectedGroup =
      groupSpan?.group ||
      descriptor?.detectedGroup ||
      resolveDetectedGroup(headerPath, groupLookup);

    if (headerPath.length > 0) {
      headerCoverage++;
    }

    if (descriptor?.antigen === schemaColumn.key) {
      directMatches++;
    } else if (descriptor?.expectedGroup && descriptor.expectedGroup !== schemaColumn.group) {
      conflictingColumns++;
    }

    if (detectedGroup === schemaColumn.group) {
      groupMatches++;
    } else if (detectedGroup) {
      conflictingColumns++;
    }
  });

  return (
    candidate.evidenceScore +
    directMatches * 4 +
    groupMatches * 2 +
    headerCoverage * 0.5 -
    conflictingColumns * 3
  );
}

function projectSchemaDescriptors(
  table: RawTable,
  headerRows: number[],
  schemaColumns: Array<{
    key: string;
    label: string;
    kind: 'analysis' | 'supplemental';
    required: boolean;
    aliases?: string[];
    group: string;
    groupAliases: string[];
  }>,
  columnDescriptors: ColumnDescriptor[],
  groupSpans: GroupSpan[],
  groupLookup: Map<string, string>,
  antigenToGroupMap: Map<string, string>,
  schemaColumnMap: Map<string, {
    key: string;
    label: string;
    kind: 'analysis' | 'supplemental';
    required: boolean;
    aliases?: string[];
    group: string;
    groupAliases: string[];
  }>,
  specialColumns: SpecialColumns,
): ColumnDescriptor[] | null {
  const candidates = buildSchemaProjectionCandidates(
    table,
    schemaColumns,
    columnDescriptors,
    groupSpans,
    specialColumns,
  );
  if (candidates.length === 0) {
    return null;
  }

  const scoredCandidates = candidates
    .map(candidate => ({
      candidate,
      score: scoreSchemaProjectionCandidate(
        candidate,
        table,
        headerRows,
        schemaColumns,
        columnDescriptors,
        groupSpans,
        groupLookup,
      ),
    }))
    .sort((left, right) => right.score - left.score);

  const bestCandidate = scoredCandidates[0];
  if (!bestCandidate) {
    return null;
  }

  const minimumScore = schemaColumns.length * 1.5;
  if (bestCandidate.score < minimumScore) {
    return null;
  }

  const existingByColumn = new Map(
    columnDescriptors.map(descriptor => [descriptor.sourceColumn, descriptor]),
  );

  return schemaColumns.map((schemaColumn, index) => {
    const sourceColumn = bestCandidate.candidate.startCol + index;
    const headerPath = buildHeaderPathForColumn(table, headerRows, sourceColumn);
    const existing = existingByColumn.get(sourceColumn);
    const groupSpan = getGroupSpanForColumn(groupSpans, sourceColumn);
    const detectedGroup =
      groupSpan?.group ||
      existing?.detectedGroup ||
      resolveDetectedGroup(headerPath, groupLookup) ||
      schemaColumn.group;
    const evidence =
      existing?.antigen === schemaColumn.key
        ? existing.evidence
        : 'schema_projection';

    return toColumnDescriptor(
      sourceColumn,
      schemaColumn.key,
      detectedGroup,
      headerPath,
      evidence,
      schemaColumnMap,
      antigenToGroupMap,
    );
  });
}

function scoreTableCandidate(
  table: RawTable,
  knownAntigens: string[],
  antigenLookup: Map<string, string>,
): number {
  const grid = tableToGrid(table);
  const headerRow = findHeaderRow(grid, knownAntigens);
  let headerMatches = 0;

  for (const cell of grid[headerRow] ?? []) {
    if (resolveAntigenValue(cell.text, antigenLookup)) {
      headerMatches++;
    }
  }

  return table.numCols * 10 + headerMatches * 25 + table.numRows;
}

function uniqueValues(values: string[]): string[] {
  return Array.from(new Set(values));
}

function shouldIgnoreUnmappedHeader(
  headerPath: string[],
  groupLookup: Map<string, string>,
): boolean {
  if (headerPath.length === 0) {
    return true;
  }

  if (classifySpecialColumn(headerPath)) {
    return true;
  }

  return headerPath.every(label => {
    const normalized = normalizeInsensitiveKey(label);
    return (
      groupLookup.has(normalized) ||
      normalized === 'additionalantigens' ||
      normalized === 'antigens' ||
      normalized === 'specialtypes' ||
      normalized === 'specialantigentyping' ||
      normalized === 'additionalcells' ||
      normalized === 'test' ||
      normalized === 'results'
    );
  });
}

export class PanelTableParser {
  private manufacturer: string;
  private antigenGroups: AntigenGroups;
  private analysisGroups: AntigenGroups;
  private knownAntigens: string[];
  private analysisAntigens: string[];
  private schemaColumns: Array<{
    key: string;
    label: string;
    kind: 'analysis' | 'supplemental';
    required: boolean;
    aliases?: string[];
    group: string;
    groupAliases: string[];
  }>;
  private schemaColumnMap: Map<string, {
    key: string;
    label: string;
    kind: 'analysis' | 'supplemental';
    required: boolean;
    aliases?: string[];
    group: string;
    groupAliases: string[];
  }>;
  private antigenLookup: Map<string, string>;
  private groupLookup: Map<string, string>;
  private antigenToGroupMap: Map<string, string>;

  constructor(manufacturer: string = 'CUSTOM') {
    this.manufacturer = manufacturer;
    this.antigenGroups = getRenderableGroups(manufacturer);
    this.analysisGroups = getAnalysisGroups(manufacturer);
    this.schemaColumns = getSchemaColumns(manufacturer);
    this.schemaColumnMap = new Map(
      this.schemaColumns.map(column => [column.key, column]),
    );
    this.knownAntigens = getRenderableColumnKeys(manufacturer);
    this.analysisAntigens = this.schemaColumns
      .filter(column => column.kind === 'analysis')
      .map(column => column.key);
    this.antigenLookup = buildAntigenLookup(this.schemaColumns);
    this.groupLookup = buildGroupLookup(this.antigenGroups);
    this.antigenToGroupMap = buildAntigenToGroupMap(this.antigenGroups);
  }

  parse(jsonText: string): ParseResult {
    const parseErrors: string[] = [];
    const validationIssues: OcrValidationIssue[] = [];

    let response: TextractResponse;
    try {
      response = JSON.parse(jsonText);
    } catch {
      return this.emptyResult(['Failed to parse Textract JSON']);
    }

    if (!response?.Blocks?.length) {
      return this.emptyResult(['No blocks found in Textract response']);
    }

    const blockMap = buildBlockMap(response.Blocks);
    const tables = extractTables(response.Blocks, blockMap);
    if (tables.length === 0) {
      return this.emptyResult(['No TABLE blocks found in Textract response']);
    }

    const mainTable = tables.reduce((best, current) =>
      scoreTableCandidate(current, this.knownAntigens, this.antigenLookup) >
      scoreTableCandidate(best, this.knownAntigens, this.antigenLookup)
        ? current
        : best,
    );

    const grid = tableToGrid(mainTable);
    const headerAnalysis = analyseHeaderRows(mainTable, grid, this.knownAntigens);
    const headerRows = headerAnalysis.headerRows;
    const dataStartRow = headerAnalysis.dataStartRow;
    const groupSpans = detectGroupSpans(mainTable, headerRows, this.groupLookup);

    const columnDescriptors: ColumnDescriptor[] = [];
    const specialColumns: SpecialColumns = {
      cellNumberCol: -1,
      donorNumberCol: -1,
      phenotypeCol: -1,
      resultCol: -1,
    };

    for (let colIndex = 1; colIndex <= mainTable.numCols; colIndex++) {
      const {descriptor, specialColumn, headerPath} = buildColumnDescriptor(
        mainTable,
        headerRows,
        colIndex,
        this.antigenLookup,
        this.groupLookup,
        this.antigenToGroupMap,
        this.antigenGroups,
        groupSpans,
        this.schemaColumnMap,
      );

      if (descriptor) {
        columnDescriptors.push(descriptor);
        continue;
      }

      if (specialColumn && specialColumns[specialColumn] === -1) {
        specialColumns[specialColumn] = colIndex;
        continue;
      }

      if (!shouldIgnoreUnmappedHeader(headerPath, this.groupLookup)) {
        const joinedHeader = headerPath.join(' > ');
        if (joinedHeader.trim()) {
          const message = `Unmapped header column ${colIndex}: ${joinedHeader}`;
          parseErrors.push(message);
          validationIssues.push({
            code: 'unmapped_header',
            severity: 'warning',
            message,
            sourceColumn: colIndex,
          });
        }
      }
    }

    const stabilizedDescriptors = stabilizeDescriptorsFromGroupSpans(
      mainTable,
      headerRows,
      columnDescriptors,
      groupSpans,
      this.antigenGroups,
      this.antigenToGroupMap,
      this.schemaColumnMap,
    );
    columnDescriptors.length = 0;
    columnDescriptors.push(...stabilizedDescriptors);

    const projectedDescriptors = projectSchemaDescriptors(
      mainTable,
      headerRows,
      this.schemaColumns,
      columnDescriptors,
      groupSpans,
      this.groupLookup,
      this.antigenToGroupMap,
      this.schemaColumnMap,
      specialColumns,
    );
    if (projectedDescriptors && projectedDescriptors.length > 0) {
      const projectedGroupMismatches = projectedDescriptors.filter(
        descriptor =>
          descriptor.detectedGroup &&
          descriptor.expectedGroup &&
          descriptor.detectedGroup !== descriptor.expectedGroup,
      ).length;
      if (projectedGroupMismatches === 0) {
        columnDescriptors.length = 0;
        columnDescriptors.push(...projectedDescriptors);
      }
    }

    const finalMappedColumns = new Set(
      columnDescriptors.map(descriptor => descriptor.sourceColumn),
    );
    const staleUnmappedColumns = new Set(
      validationIssues
        .filter(
          issue =>
            issue.code === 'unmapped_header' &&
            typeof issue.sourceColumn === 'number' &&
            finalMappedColumns.has(issue.sourceColumn),
        )
        .map(issue => issue.sourceColumn as number),
    );
    if (staleUnmappedColumns.size > 0) {
      for (let index = validationIssues.length - 1; index >= 0; index--) {
        const issue = validationIssues[index];
        if (
          issue.code === 'unmapped_header' &&
          typeof issue.sourceColumn === 'number' &&
          staleUnmappedColumns.has(issue.sourceColumn)
        ) {
          validationIssues.splice(index, 1);
        }
      }

      for (let index = parseErrors.length - 1; index >= 0; index--) {
        const match = parseErrors[index].match(/^Unmapped header column (\d+):/);
        if (match && staleUnmappedColumns.has(Number(match[1]))) {
          parseErrors.splice(index, 1);
        }
      }
    }

    const antigens = columnDescriptors.map(descriptor => descriptor.antigen);
    const uniqueAntigens = uniqueValues(antigens);
    const duplicateColumns = uniqueValues(
      antigens.filter((antigen, index) => antigens.indexOf(antigen) !== index),
    );

    const requiredColumnKeys = this.schemaColumns
      .filter(column => column.required)
      .map(column => column.key);

    const missingColumns = requiredColumnKeys.filter(
      antigen => !uniqueAntigens.includes(antigen),
    );
    const unexpectedColumns = uniqueValues(
      antigens.filter(antigen => !this.knownAntigens.includes(antigen)),
    );
    const groupMismatches = columnDescriptors
      .filter(
        descriptor =>
          descriptor.detectedGroup &&
          descriptor.expectedGroup &&
          descriptor.detectedGroup !== descriptor.expectedGroup,
      )
      .map(
        descriptor =>
          `${descriptor.antigen}: expected ${descriptor.expectedGroup}, detected ${descriptor.detectedGroup}`,
      );

    if (columnDescriptors.length === 0) {
      parseErrors.push('No antigen columns could be identified from the header structure.');
    }

    if (duplicateColumns.length > 0) {
      const message = `Duplicate antigen columns detected: ${duplicateColumns.join(', ')}`;
      parseErrors.push(message);
      duplicateColumns.forEach(columnKey => {
        validationIssues.push({
          code: 'duplicate_column',
          severity: 'error',
          message,
          columnKey,
        });
      });
    }

    if (missingColumns.length > 0) {
      const message = `Missing expected antigen columns: ${missingColumns.join(', ')}`;
      parseErrors.push(message);
      missingColumns.forEach(columnKey => {
        validationIssues.push({
          code: 'missing_column',
          severity: 'error',
          message,
          columnKey,
        });
      });
    }

    if (unexpectedColumns.length > 0) {
      const message = `Unexpected antigen columns detected: ${unexpectedColumns.join(', ')}`;
      parseErrors.push(message);
      unexpectedColumns.forEach(columnKey => {
        validationIssues.push({
          code: 'unexpected_column',
          severity: 'warning',
          message,
          columnKey,
        });
      });
    }

    if (groupMismatches.length > 0) {
      const message = `Header/group mismatches: ${groupMismatches.join('; ')}`;
      parseErrors.push(message);
      groupMismatches.forEach(issue => {
        validationIssues.push({
          code: 'group_mismatch',
          severity: 'warning',
          message: issue,
        });
      });
    }

    const cells: CellData[] = [];
    const cellConfidences: CellConfidence[][] = [];
    const lowConfidenceCells: CellConfidence[] = [];
    const unreadableCells: OcrUnreadableCell[] = [];

    let filledCellConfidenceTotal = 0;
    let filledCellConfidenceCount = 0;
    let accuratelyMappedCells = 0;
    let totalMappedCells = 0;
    let emptyRowStreak = 0;

    for (let rowIndex = dataStartRow; rowIndex <= mainTable.numRows; rowIndex++) {
      const row = grid[rowIndex];
      if (!row) {
        continue;
      }

      const dataSignalCount =
        columnDescriptors.filter(descriptor => row[descriptor.sourceColumn]?.text.trim()).length +
        [specialColumns.cellNumberCol, specialColumns.donorNumberCol, specialColumns.phenotypeCol, specialColumns.resultCol]
          .filter(col => col > 0 && row[col]?.text.trim())
          .length;

      const hasCellNumber =
        specialColumns.cellNumberCol > 0 &&
        Boolean(row[specialColumns.cellNumberCol]?.text.trim());
      const minDataSignals = hasCellNumber ? 1 : 2;

      if (dataSignalCount < minDataSignals) {
        emptyRowStreak++;
        if (cells.length > 0 && emptyRowStreak >= 3) {
          break;
        }
        continue;
      }

      emptyRowStreak = 0;
      const displayRowIndex = cells.length + 1;
      const rowConfidences: CellConfidence[] = [];
      const results: CellData['results'] = {};

      const inferredRowNumber = String(displayRowIndex);
      const cellId =
        specialColumns.cellNumberCol > 0
          ? row[specialColumns.cellNumberCol]?.text.trim() || inferredRowNumber
          : inferredRowNumber;
      const donorNumber =
        specialColumns.donorNumberCol > 0
          ? row[specialColumns.donorNumberCol]?.text.trim() || cellId
          : cellId;
      const phenotype =
        specialColumns.phenotypeCol > 0
          ? row[specialColumns.phenotypeCol]?.text.trim() || ''
          : '';

      if (specialColumns.resultCol > 0) {
        const resultCell = row[specialColumns.resultCol] ?? {text: '', confidence: 100};
        const normalized = resolveCellResultValue(resultCell.text);
        const isEmpty = normalized.value === '';
        const needsReview =
          !isEmpty &&
          (!normalized.exact || normalized.value === '?');
        const isLowConfidence = !isEmpty && normalized.exact && resultCell.confidence < LOW_CONFIDENCE_WARN_THRESHOLD;

        results.result = normalized.exact ? normalized.value : '?';
        rowConfidences.push({
          rowIndex: displayRowIndex,
          colIndex: specialColumns.resultCol,
          columnKey: 'result',
          value: String(results.result ?? ''),
          confidence: isEmpty ? 100 : resultCell.confidence,
          needsReview: needsReview || isLowConfidence,
        });

        totalMappedCells++;
        if (!isEmpty && !needsReview && normalized.value !== '?') {
          accuratelyMappedCells++;
        }
        if (!isEmpty) {
          filledCellConfidenceTotal += resultCell.confidence;
          filledCellConfidenceCount++;
        }
        if (needsReview || isLowConfidence) {
          lowConfidenceCells.push(rowConfidences[rowConfidences.length - 1]);
        }
        if (needsReview) {
          unreadableCells.push({
            rowIndex: displayRowIndex,
            columnKey: 'result',
            reason: normalized.value === '?' ? 'invalid_symbol' : 'low_confidence',
            suggestedValue: normalized.exact ? normalized.value : null,
            required: true,
          });
        }
      }

      for (const descriptor of columnDescriptors) {
        const valueCell = row[descriptor.sourceColumn] ?? {text: '', confidence: 100};
        const normalized = resolveCellResultValue(valueCell.text);
        const isEmpty = normalized.value === '';
        const needsReview = !isEmpty && (!normalized.exact || normalized.value === '?');
        const isLowConfidence = !isEmpty && normalized.exact && valueCell.confidence < LOW_CONFIDENCE_WARN_THRESHOLD;
        const finalValue = isEmpty ? '' : needsReview && !normalized.exact ? '?' : normalized.value;

        results[descriptor.antigen] = finalValue;
        const confidenceEntry: CellConfidence = {
          rowIndex: displayRowIndex,
          colIndex: descriptor.sourceColumn,
          columnKey: descriptor.antigen,
          value: String(finalValue ?? ''),
          confidence: isEmpty ? 100 : valueCell.confidence,
          needsReview: needsReview || isLowConfidence,
        };

        rowConfidences.push(confidenceEntry);
        totalMappedCells++;
        if (!isEmpty && !needsReview && finalValue !== '?') {
          accuratelyMappedCells++;
        }
        if (!isEmpty) {
          // Exact normalized symbols are trusted for table confidence; raw Textract
          // glyph confidence often understates legible +/0 cells (H1).
          const textContribution =
            !needsReview && normalized.exact ? 100 : valueCell.confidence;
          filledCellConfidenceTotal += textContribution;
          filledCellConfidenceCount++;
        }
        if (needsReview || isLowConfidence) {
          lowConfidenceCells.push(confidenceEntry);
        }
        if (needsReview) {
          unreadableCells.push({
            rowIndex: displayRowIndex,
            columnKey: descriptor.antigen,
            reason: normalized.value === '?' ? 'invalid_symbol' : 'low_confidence',
            suggestedValue: normalized.exact ? normalized.value : null,
            required: descriptor.required,
          });
        }
      }

      cells.push({
        rowNumber: inferredRowNumber,
        cellId,
        donorNumber,
        phenotype,
        results,
      });
      cellConfidences.push(rowConfidences);
    }

    const analysisDescriptors = columnDescriptors.filter(descriptor => descriptor.kind === 'analysis');
    const extractionN = cells.length;
    const extractionX = analysisDescriptors.length;
    const extractionSlots = [];
    for (let rowIdx = 0; rowIdx < cells.length; rowIdx++) {
      const cell = cells[rowIdx];
      const rowConf = cellConfidences[rowIdx] ?? [];
      const confByKey = new Map(rowConf.map(c => [c.columnKey, c.confidence]));

      for (const descriptor of analysisDescriptors) {
        extractionSlots.push({
          value: cell.results[descriptor.antigen],
          confidence: confByKey.get(descriptor.antigen),
          rowIndex: rowIdx + 1,
          columnKey: descriptor.antigen,
        });
      }
    }

    const extractionSummary = summarizeExtractionAccuracy(extractionSlots, {
      lowConfidenceThreshold: LOW_CONFIDENCE_WARN_THRESHOLD,
      logLabel: `PanelTableParser (${extractionN}×${extractionX})`,
    });
    const extractionAccuracy = extractionSummary.accuracyPercent;

    const tableStructureValidated =
      columnDescriptors.length > 0 &&
      groupMismatches.length === 0 &&
      duplicateColumns.length === 0 &&
      missingColumns.length === 0;

    const textScore =
      filledCellConfidenceCount > 0
        ? Math.round(filledCellConfidenceTotal / filledCellConfidenceCount)
        : 0;
    const cellValueScore =
      totalMappedCells > 0 ? Math.round((accuratelyMappedCells / totalMappedCells) * 100) : 0;
    const mappingScore = tableStructureValidated
      ? 100
      : columnDescriptors.length > 0
        ? Math.round(
            columnDescriptors.reduce(
              (total, descriptor) => total + EVIDENCE_SCORES[descriptor.evidence],
              0,
            ) / columnDescriptors.length,
          )
        : 0;
    const completenessScore =
      requiredColumnKeys.length > 0
        ? Math.round((uniqueAntigens.filter(antigen => requiredColumnKeys.includes(antigen)).length /
            requiredColumnKeys.length) * 100)
        : columnDescriptors.length > 0
          ? 100
          : 0;
    const uniqueRatio =
      antigens.length > 0 ? uniqueAntigens.length / antigens.length : 0;
    const groupAccuracy =
      columnDescriptors.length > 0
        ? (columnDescriptors.length - groupMismatches.length) / columnDescriptors.length
        : 0;
    const headerCoverage =
      columnDescriptors.length > 0
        ? columnDescriptors.filter(descriptor => descriptor.headerPath.length > 0).length /
          columnDescriptors.length
        : 0;
    const structureScore =
      tableStructureValidated && completenessScore === 100
        ? 100
        : Math.round(
            (completenessScore / 100) * 45 +
              uniqueRatio * 20 +
              groupAccuracy * 20 +
              headerCoverage * 15,
          );
    const unreadablePenalty =
      cells.length > 0
        ? Math.min(
            6,
            Math.round(
              (unreadableCells.filter(cell => cell.required).length /
                Math.max(1, cells.length * Math.max(1, requiredColumnKeys.length))) *
                100,
            ),
          )
        : 0;
    const overallConfidence = capOverallScoreByExtraction(
      computeOverallOcrConfidence({
        textScore,
        cellValueScore,
        mappingScore,
        structureScore,
        completenessScore,
        unreadablePenalty,
      }),
      extractionAccuracy,
    );

    const columnLayout: ParsedColumnLayout[] = [];
    if (specialColumns.cellNumberCol > 0) {
      columnLayout.push({
        key: '__cell_number',
        label: 'Cell #',
        group: 'Metadata',
        sourceColumn: specialColumns.cellNumberCol,
        headerPath: buildHeaderPathForColumn(mainTable, headerRows, specialColumns.cellNumberCol),
        kind: 'side',
        required: true,
      });
    }
    if (specialColumns.phenotypeCol > 0) {
      columnLayout.push({
        key: '__rhhr_phenotype',
        label: 'Rh-hr',
        group: 'Metadata',
        sourceColumn: specialColumns.phenotypeCol,
        headerPath: buildHeaderPathForColumn(mainTable, headerRows, specialColumns.phenotypeCol),
        kind: 'side',
        required: false,
      });
    }
    if (specialColumns.donorNumberCol > 0) {
      columnLayout.push({
        key: '__donor_number',
        label: 'Donor',
        group: 'Metadata',
        sourceColumn: specialColumns.donorNumberCol,
        headerPath: buildHeaderPathForColumn(mainTable, headerRows, specialColumns.donorNumberCol),
        kind: 'side',
        required: true,
      });
    }
    columnLayout.push(
      ...columnDescriptors.map(descriptor => ({
        key: descriptor.antigen,
        label: descriptor.label,
        group: descriptor.expectedGroup || descriptor.detectedGroup,
        sourceColumn: descriptor.sourceColumn,
        headerPath: descriptor.headerPath,
        kind: descriptor.kind,
        required: descriptor.required,
      })),
    );
    if (specialColumns.resultCol > 0) {
      columnLayout.push({
        key: 'result',
        label: 'IS',
        group: 'Test Results',
        sourceColumn: specialColumns.resultCol,
        headerPath: buildHeaderPathForColumn(mainTable, headerRows, specialColumns.resultCol),
        kind: 'result',
        required: true,
      });
    }

    const columnGroups: OcrColumnGroup[] = [];
    for (const descriptor of columnDescriptors) {
      const groupName = descriptor.expectedGroup || descriptor.detectedGroup || 'Other';
      const currentGroup = columnGroups[columnGroups.length - 1];
      if (currentGroup && currentGroup.group === groupName) {
        currentGroup.children.push(descriptor.antigen);
      } else {
        columnGroups.push({
          group: groupName,
          children: [descriptor.antigen],
        });
      }
    }

    const structuredRows: OcrStructuredRow[] = cells.map(cell => ({
      cellNumber: cell.cellId,
      rhHr: cell.phenotype,
      donor: cell.donorNumber,
      values: {
        ...cell.results,
      },
    }));

    const metrics: OcrStructureMetrics = {
      textScore,
      cellValueScore,
      structureScore,
      mappingScore,
      completenessScore,
      overallScore: overallConfidence,
      extractionAccuracy,
      missingColumns,
      duplicateColumns,
      unexpectedColumns,
      groupMismatches,
      detectedHeaderRows: headerRows,
      detectedDataStartRow: dataStartRow,
    };

    const metadata: PanelMetadata = {
      manufacturer: this.manufacturer,
      lotNumber: '',
      expirationDate: '',
      panelType: 'Panel A',
      testName: '',
      columnLayout,
      columnGroups,
      unreadableCells,
      validationIssues,
      structuredRows,
      ocrMetrics: metrics,
    };

    const panelData: PanelData = {
      cells,
      antigens: columnDescriptors
        .filter(descriptor => descriptor.kind === 'analysis')
        .map(descriptor => descriptor.antigen),
      metadata,
      antigenGroups: this.antigenGroups,
    };

    return {
      panelData,
      overallConfidence,
      cellConfidences,
      lowConfidenceCells,
      parseErrors: uniqueValues(parseErrors),
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
          columnLayout: [],
          columnGroups: [],
          unreadableCells: [],
          validationIssues: [],
          structuredRows: [],
          ocrMetrics: metrics,
        },
        antigenGroups: this.antigenGroups,
      },
      overallConfidence: 0,
      cellConfidences: [],
      lowConfidenceCells: [],
      parseErrors: errors,
      metrics,
    };
  }
}
