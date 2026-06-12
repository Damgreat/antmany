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
import {
  summarizeExtractionAccuracy,
  buildAnalysisExtractionSlots,
  buildExtractionAccuracyColumnSpecs,
} from '../utils/ocrExtractionValidation';
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

/** Strip OCR junk (quotes, stars) before antigen header matching. */
function sanitizeOcrHeaderLabel(raw: string): string {
  return raw
    .trim()
    .replace(/^\*+/, '')
    .replace(/^["'`‘’""]+|["'`‘’""]+$/g, '')
    .trim();
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
  if (compact === '/' || compact === '|') {
    return false;
  }

  return /^[.,:;'"`’‘~_¦]+$/.test(compact);
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
    .replace(/[’‘]/g, "'")
    .replace(/^\*+/, '');

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

  if (compact === 'NT' || compact === 'N/T' || compact === 'NOTTESTED') {
    return {value: 'NT', exact: true, recovered: true, blankLike: false};
  }

  if (compact === '0' || /^[OQD]$/.test(compact) || compact === '00' || compact === 'OO') {
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

  const stripped = raw.trim().replace(/^\*+/, '');
  if (stripped !== raw.trim()) {
    const starResolved = resolveAntigenValue(stripped, lookup);
    if (starResolved) {
      return starResolved;
    }
  }

  const caseInsensitiveKey = normalizeInsensitiveKey(raw);
  const matches = uniqueValues(
    Array.from(lookup.entries())
      .filter(([lookupKey]) => normalizeInsensitiveKey(lookupKey) === caseInsensitiveKey)
      .map(([, antigen]) => antigen),
  );

  return matches.length === 1 ? matches[0] : null;
}

function antigenIndexForColumnInSpan(
  colIndex: number,
  span: GroupSpan,
  specialColumns: SpecialColumns,
): number {
  let dataColIndex = 0;
  for (let col = span.startCol; col < colIndex; col++) {
    if (!isMetadataSourceColumn(col, specialColumns)) {
      dataColIndex++;
    }
  }
  return dataColIndex;
}

function resolveTruncatedAntigenLabel(
  raw: string,
  colIndex: number,
  groupSpan: GroupSpan | null | undefined,
  expectedAntigens: string[],
  specialColumns: SpecialColumns,
  lookup: Map<string, string>,
): string | null {
  const cleaned = sanitizeOcrHeaderLabel(raw);
  const direct = resolveAntigenValue(cleaned, lookup);
  if (direct) {
    return direct;
  }

  if (expectedAntigens.length === 0) {
    return null;
  }
  if (
    groupSpan &&
    (colIndex < groupSpan.startCol || colIndex > groupSpan.endCol)
  ) {
    return null;
  }

  const normalized = normalizeInsensitiveKey(cleaned);
  if (normalized.length < 2) {
    return null;
  }

  const prefixMatches = expectedAntigens.filter(antigen =>
    normalizeInsensitiveKey(antigen).startsWith(normalized),
  );
  if (prefixMatches.length === 1) {
    return prefixMatches[0];
  }

  const index = groupSpan
    ? antigenIndexForColumnInSpan(colIndex, groupSpan, specialColumns)
    : -1;
  if (index >= 0 && index < expectedAntigens.length) {
    const positional = expectedAntigens[index];
    if (normalizeInsensitiveKey(positional).startsWith(normalized)) {
      return positional;
    }
  }

  if (prefixMatches.length > 1 && index >= 0) {
    const positional = prefixMatches[Math.min(index, prefixMatches.length - 1)];
    if (positional) {
      return positional;
    }
  }

  return null;
}

function reorderDescriptorsBySchema(
  descriptors: ColumnDescriptor[],
  schemaColumns: Array<{key: string}>,
): ColumnDescriptor[] {
  const order = new Map(schemaColumns.map((column, index) => [column.key, index]));
  return [...descriptors].sort((left, right) => {
    const leftOrder = order.get(left.antigen) ?? Number.MAX_SAFE_INTEGER;
    const rightOrder = order.get(right.antigen) ?? Number.MAX_SAFE_INTEGER;
    if (leftOrder !== rightOrder) {
      return leftOrder - rightOrder;
    }
    return left.sourceColumn - right.sourceColumn;
  });
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
    const leftWidth = left.endCol - left.startCol;
    const rightWidth = right.endCol - right.startCol;
    if (leftWidth !== rightWidth) {
      return leftWidth - rightWidth;
    }
    if (left.row !== right.row) {
      return left.row - right.row;
    }
    return left.startCol - right.startCol;
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

function getDeepestHeaderCells(coveringCells: RawTableCell[]): RawTableCell[] {
  if (coveringCells.length === 0) {
    return [];
  }

  const maxRow = Math.max(...coveringCells.map(cell => cell.row + cell.rowSpan - 1));
  return coveringCells.filter(cell => cell.row + cell.rowSpan - 1 === maxRow);
}

function getColumnSpecificHeaderLabel(cell: RawTableCell, colIndex: number): string {
  if (cell.colSpan <= 1) {
    return cell.text.trim();
  }

  const tokens = splitHeaderTokens(cell.text);
  if (tokens.length === cell.colSpan) {
    return tokens[colIndex - cell.col] ?? '';
  }

  return cell.text.trim();
}

/** Prefer the innermost header label so parent "Rh-hr" group labels do not steal antigen columns. */
function classifySpecialColumnFromDeepestHeader(
  coveringCells: RawTableCell[],
  colIndex: number,
  antigenLookup: Map<string, string>,
): keyof SpecialColumns | undefined {
  const deepestCells = getDeepestHeaderCells(coveringCells);
  for (const cell of deepestCells) {
    if (resolvePerColumnToken(cell, colIndex, antigenLookup)) {
      continue;
    }

    const label = getColumnSpecificHeaderLabel(cell, colIndex);
    if (!label) {
      continue;
    }

    const normalized = normalizeInsensitiveKey(label);
    if (cell.colSpan !== 1) {
      continue;
    }
    if (SPECIAL_COLUMN_ALIASES.result.includes(normalized)) {
      return 'resultCol';
    }
    if (SPECIAL_COLUMN_ALIASES.cell.includes(normalized)) {
      return 'cellNumberCol';
    }
    if (SPECIAL_COLUMN_ALIASES.donor.includes(normalized)) {
      return 'donorNumberCol';
    }
    if (
      SPECIAL_COLUMN_ALIASES.phenotype.includes(normalized) &&
      !resolveAntigenValue(label, antigenLookup)
    ) {
      return 'phenotypeCol';
    }
  }

  return undefined;
}

function isPhenotypeLikeCellText(raw: string): boolean {
  const compact = raw.trim().replace(/\s+/g, '');
  if (!compact || compact.length < 2 || compact.length > 16) {
    return false;
  }
  if (isResultLikeToken(compact)) {
    return false;
  }
  if (/^\d{5,}$/.test(compact)) {
    return false;
  }

  return (
    /^[Rr][0-9r''wR]*$/i.test(compact) ||
    /^rr$/i.test(compact) ||
    /^r['']r$/i.test(compact) ||
    /^r['']{2}r$/i.test(compact)
  );
}

function scoreColumnDataPattern(
  grid: Array<Array<{text: string}>>,
  dataStartRow: number,
  col: number,
  matcher: (text: string) => boolean,
  maxRows = 10,
): number {
  let score = 0;
  const lastRow = Math.min(grid.length - 1, dataStartRow + maxRows - 1);
  for (let row = dataStartRow; row <= lastRow; row++) {
    const text = grid[row]?.[col]?.text?.trim() ?? '';
    if (matcher(text)) {
      score++;
    }
  }
  return score;
}

function inferMissingSpecialColumns(
  grid: Array<Array<{text: string}>>,
  dataStartRow: number,
  groupSpans: GroupSpan[],
  specialColumns: SpecialColumns,
  columnDescriptors: ColumnDescriptor[],
): void {
  const rhSpan = groupSpans.find(span => span.group === 'Rh-hr');
  if (!rhSpan) {
    return;
  }

  const searchEnd = Math.min(rhSpan.startCol + 4, rhSpan.endCol);
  const reservedCols = new Set(
    [specialColumns.phenotypeCol, specialColumns.donorNumberCol, specialColumns.cellNumberCol].filter(
      col => col > 0,
    ),
  );

  if (specialColumns.phenotypeCol <= 0) {
    let bestCol = -1;
    let bestScore = 0;
    for (let col = rhSpan.startCol; col <= searchEnd; col++) {
      if (reservedCols.has(col)) {
        continue;
      }
      const score = scoreColumnDataPattern(grid, dataStartRow, col, isPhenotypeLikeCellText);
      if (score > bestScore) {
        bestScore = score;
        bestCol = col;
      }
    }
    if (bestCol > 0 && bestScore >= 3) {
      specialColumns.phenotypeCol = bestCol;
      reservedCols.add(bestCol);
    }
  }

  if (specialColumns.donorNumberCol <= 0) {
    let bestCol = -1;
    let bestScore = 0;
    for (let col = rhSpan.startCol; col <= searchEnd; col++) {
      if (reservedCols.has(col)) {
        continue;
      }
      const score = scoreColumnDataPattern(grid, dataStartRow, col, isDonorLikeCellText);
      if (score > bestScore) {
        bestScore = score;
        bestCol = col;
      }
    }
    if (bestCol > 0 && bestScore >= 3) {
      specialColumns.donorNumberCol = bestCol;
      reservedCols.add(bestCol);
    }
  }

  const specialColSet = new Set(
    [specialColumns.phenotypeCol, specialColumns.donorNumberCol].filter(col => col > 0),
  );
  if (specialColSet.size === 0) {
    return;
  }

  for (let index = columnDescriptors.length - 1; index >= 0; index--) {
    if (specialColSet.has(columnDescriptors[index].sourceColumn)) {
      columnDescriptors.splice(index, 1);
    }
  }
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
  specialColumns: SpecialColumns,
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

  const groupName = groupSpan?.group || detectedGroup;
  const expectedAntigens = groupName ? antigenGroups[groupName] ?? [] : [];

  for (let index = candidatePieces.length - 1; index >= 0; index--) {
    const sanitizedPiece = sanitizeOcrHeaderLabel(candidatePieces[index]);
    const resolved =
      resolveTruncatedAntigenLabel(
        sanitizedPiece,
        colIndex,
        groupSpan,
        expectedAntigens,
        specialColumns,
        antigenLookup,
      ) ?? resolveAntigenValue(sanitizedPiece, antigenLookup);
    if (resolved) {
      return {
        descriptor: toColumnDescriptor(
          colIndex,
          resolved,
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

  const specialBeforeGroupSpan = classifySpecialColumnFromDeepestHeader(
    coveringCells,
    colIndex,
    antigenLookup,
  );
  if (specialBeforeGroupSpan) {
    return {specialColumn: specialBeforeGroupSpan, headerPath};
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
  grid: Array<Array<{text: string; confidence: number}>>,
  dataStartRow: number,
  specialColumns: SpecialColumns,
  antigenLookup: Map<string, string>,
): ColumnDescriptor[] {
  const descriptorsByColumn = new Map<number, ColumnDescriptor>();
  for (const descriptor of columnDescriptors) {
    descriptorsByColumn.set(descriptor.sourceColumn, descriptor);
  }

  for (const span of groupSpans) {
    const expectedAntigens = antigenGroups[span.group] ?? [];
    const spanWidth = span.endCol - span.startCol + 1;
    if (expectedAntigens.length === 0 || spanWidth < expectedAntigens.length) {
      continue;
    }

    const offset = computeGroupSpanAntigenOffset(
      span,
      expectedAntigens,
      descriptorsByColumn,
      table,
      headerRows,
      antigenLookup,
      grid,
      dataStartRow,
      specialColumns,
    );

    for (let index = 0; index < expectedAntigens.length; index++) {
      const sourceColumn = span.startCol + offset + index;
      const antigen = expectedAntigens[index];
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

function countResultLikeCellsInRange(
  grid: Array<Array<{text: string}>>,
  dataStartRow: number,
  startCol: number,
  endCol: number,
  maxRows = 14,
): number {
  let count = 0;
  const endRow = Math.min(grid.length - 1, dataStartRow + maxRows - 1);
  for (let row = dataStartRow; row <= endRow; row++) {
    for (let col = startCol; col <= endCol; col++) {
      const text = grid[row]?.[col]?.text ?? '';
      const resolved = resolveCellResultValue(text);
      if (resolved.value !== '' && resolved.value !== '?') {
        count++;
      }
    }
  }
  return count;
}

function computeMetadataSkipOffset(
  span: GroupSpan,
  specialColumns: SpecialColumns,
  grid?: Array<Array<{text: string}>>,
  dataStartRow?: number,
): number {
  let lastMetadataCol = span.startCol - 1;
  for (const col of [specialColumns.phenotypeCol, specialColumns.donorNumberCol]) {
    if (col >= span.startCol && col <= span.endCol && col > lastMetadataCol) {
      lastMetadataCol = col;
    }
  }

  if (grid && dataStartRow !== undefined) {
    for (let col = span.startCol; col <= span.endCol; col++) {
      if (
        col === specialColumns.phenotypeCol ||
        col === specialColumns.donorNumberCol ||
        col === specialColumns.cellNumberCol
      ) {
        continue;
      }
      if (
        columnHasDataSignal(grid, dataStartRow, col) &&
        countResultLikeCellsInRange(grid, dataStartRow, col, col, 10) === 0
      ) {
        if (col > lastMetadataCol) {
          lastMetadataCol = col;
        }
      }
    }
  }

  return lastMetadataCol >= span.startCol ? lastMetadataCol - span.startCol + 1 : 0;
}

function computeGroupSpanAntigenOffset(
  span: GroupSpan,
  expectedAntigens: string[],
  descriptorsByColumn: Map<number, ColumnDescriptor>,
  table: RawTable,
  headerRows: number[],
  antigenLookup: Map<string, string>,
  grid?: Array<Array<{text: string; confidence: number}>>,
  dataStartRow?: number,
  specialColumns?: SpecialColumns,
): number {
  const spanWidth = span.endCol - span.startCol + 1;
  if (expectedAntigens.length === 0 || spanWidth < expectedAntigens.length) {
    return 0;
  }
  if (spanWidth === expectedAntigens.length) {
    return specialColumns
      ? computeMetadataSkipOffset(span, specialColumns, grid, dataStartRow)
      : 0;
  }

  const minOffset = specialColumns
    ? computeMetadataSkipOffset(span, specialColumns, grid, dataStartRow)
    : 0;
  let bestOffset = minOffset;
  let bestScore = -1;
  for (let offset = minOffset; offset <= spanWidth - expectedAntigens.length; offset++) {
    let score = 0;
    for (let index = 0; index < expectedAntigens.length; index++) {
      const sourceColumn = span.startCol + offset + index;
      const existing = descriptorsByColumn.get(sourceColumn);
      if (existing?.antigen === expectedAntigens[index]) {
        score += 25;
      }
      const headerPath = buildHeaderPathForColumn(table, headerRows, sourceColumn);
      for (const label of headerPath) {
        if (resolveAntigenValue(label, antigenLookup) === expectedAntigens[index]) {
          score += 20;
        }
      }
      if (grid && dataStartRow !== undefined) {
        score +=
          countResultLikeCellsInRange(grid, dataStartRow, sourceColumn, sourceColumn, 10) * 4;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestOffset = offset;
    }
  }
  return bestOffset;
}

function columnHasDataSignal(
  grid: Array<Array<{text: string}>>,
  dataStartRow: number,
  col: number,
  maxRows = 12,
): boolean {
  const endRow = Math.min(grid.length - 1, dataStartRow + maxRows - 1);
  for (let row = dataStartRow; row <= endRow; row++) {
    if ((grid[row]?.[col]?.text ?? '').trim()) {
      return true;
    }
  }
  return false;
}

function refineSourceColumnByDataDensity(
  grid: Array<Array<{text: string}>>,
  dataStartRow: number,
  sourceColumn: number,
  span: GroupSpan,
  neighborRadius = 1,
): number {
  if (columnHasDataSignal(grid, dataStartRow, sourceColumn)) {
    return sourceColumn;
  }

  const baseCount = countResultLikeCellsInRange(
    grid,
    dataStartRow,
    sourceColumn,
    sourceColumn,
    12,
  );
  let bestColumn = sourceColumn;
  let bestCount = baseCount;

  for (let delta = -neighborRadius; delta <= neighborRadius; delta++) {
    if (delta === 0) {
      continue;
    }
    const col = sourceColumn + delta;
    if (col < span.startCol || col > span.endCol) {
      continue;
    }
    const count = countResultLikeCellsInRange(grid, dataStartRow, col, col, 12);
    if (count > bestCount) {
      bestCount = count;
      bestColumn = col;
    }
  }
  return bestColumn;
}

function mergeDetectedColumnsIntoHeaderMaps(
  headerMapsByGroup: Map<string, Map<string, number>>,
  columnDescriptors: ColumnDescriptor[],
  spanByGroup: Map<string, GroupSpan>,
  specialColumns: SpecialColumns,
): void {
  for (const descriptor of columnDescriptors) {
    const groupName = descriptor.expectedGroup || descriptor.detectedGroup;
    const span = spanByGroup.get(groupName);
    if (
      !span ||
      descriptor.sourceColumn < span.startCol ||
      descriptor.sourceColumn > span.endCol ||
      isMetadataSourceColumn(descriptor.sourceColumn, specialColumns)
    ) {
      continue;
    }

    if (
      descriptor.evidence !== 'exact' &&
      descriptor.evidence !== 'combined' &&
      descriptor.evidence !== 'compact'
    ) {
      continue;
    }

    const map = headerMapsByGroup.get(groupName) ?? new Map<string, number>();
    const currentCol = map.get(descriptor.antigen);
    if (currentCol === undefined) {
      map.set(descriptor.antigen, descriptor.sourceColumn);
      headerMapsByGroup.set(groupName, map);
    }
  }
}

function buildHeaderAntigenColumnMapInSpan(
  table: RawTable,
  headerRows: number[],
  span: GroupSpan,
  expectedAntigens: string[],
  antigenLookup: Map<string, string>,
  specialColumns: SpecialColumns,
): Map<string, number> {
  const map = new Map<string, number>();
  for (let col = span.startCol; col <= span.endCol; col++) {
    if (
      col === specialColumns.phenotypeCol ||
      col === specialColumns.donorNumberCol ||
      col === specialColumns.cellNumberCol
    ) {
      continue;
    }

    const coveringCells = getCoveringHeaderCells(table, headerRows, col);
    let mappedFromToken = false;
    for (const cell of coveringCells) {
      const tokenAntigen = resolvePerColumnToken(cell, col, antigenLookup);
      if (tokenAntigen) {
        map.set(tokenAntigen, col);
        mappedFromToken = true;
        break;
      }
    }
    if (mappedFromToken) {
      continue;
    }

    const headerPath = buildHeaderPathForColumn(table, headerRows, col);
    for (const label of headerPath) {
      const sanitizedLabel = sanitizeOcrHeaderLabel(label);
      const antigen =
        resolveTruncatedAntigenLabel(
          sanitizedLabel,
          col,
          span,
          expectedAntigens,
          specialColumns,
          antigenLookup,
        ) ?? resolveAntigenValue(sanitizedLabel, antigenLookup);
      if (antigen) {
        map.set(antigen, col);
        break;
      }
    }
  }
  return map;
}

function collectResultDataColumnsInSpan(
  span: GroupSpan,
  grid: Array<Array<{text: string}>>,
  dataStartRow: number,
  specialColumns: SpecialColumns,
  minHits = 2,
): number[] {
  const dataColumns: number[] = [];
  for (let col = span.startCol; col <= span.endCol; col++) {
    if (isMetadataSourceColumn(col, specialColumns)) {
      continue;
    }
    const resultLike = countResultLikeCellsInRange(grid, dataStartRow, col, col, 12);
    if (resultLike >= minHits) {
      dataColumns.push(col);
      continue;
    }
    if (columnHasDataSignal(grid, dataStartRow, col)) {
      continue;
    }
  }
  return dataColumns.sort((left, right) => left - right);
}

function buildSequentialGroupAssignment(
  expectedAntigens: string[],
  dataColumns: number[],
): Map<string, number> {
  const assignment = new Map<string, number>();
  expectedAntigens.forEach((antigen, index) => {
    const sourceColumn = dataColumns[index];
    if (sourceColumn !== undefined) {
      assignment.set(antigen, sourceColumn);
    }
  });
  return assignment;
}

function buildGroupColumnAssignment(
  span: GroupSpan,
  expectedAntigens: string[],
  headerMap: Map<string, number>,
  grid: Array<Array<{text: string}>>,
  dataStartRow: number,
  metadataSkip: number,
  specialColumns: SpecialColumns,
): Map<string, number> {
  const assignment = new Map<string, number>();
  const usedCols = new Set<number>();

  for (const antigen of expectedAntigens) {
    const headerCol = headerMap.get(antigen);
    if (headerCol !== undefined && !usedCols.has(headerCol)) {
      assignment.set(antigen, headerCol);
      usedCols.add(headerCol);
    }
  }

  const dataColumns = collectResultDataColumnsInSpan(
    span,
    grid,
    dataStartRow,
    specialColumns,
    1,
  );
  const unusedDataColumns = dataColumns.filter(col => !usedCols.has(col));

  let dataIndex = 0;
  for (const antigen of expectedAntigens) {
    if (assignment.has(antigen)) {
      continue;
    }
    if (dataIndex < unusedDataColumns.length) {
      assignment.set(antigen, unusedDataColumns[dataIndex]);
      usedCols.add(unusedDataColumns[dataIndex]);
      dataIndex++;
      continue;
    }
    const fallbackCol = span.startCol + metadataSkip + expectedAntigens.indexOf(antigen);
    if (fallbackCol <= span.endCol && !usedCols.has(fallbackCol)) {
      assignment.set(antigen, fallbackCol);
      usedCols.add(fallbackCol);
    }
  }

  const sequentialAssignment = buildSequentialGroupAssignment(
    expectedAntigens,
    dataColumns,
  );

  const hasDuplicateCols = new Set(assignment.values()).size < assignment.size;
  const headerCoverage = expectedAntigens.filter(antigen => headerMap.has(antigen)).length;
  const headersSparse =
    headerCoverage < Math.ceil(expectedAntigens.length * 0.45);
  if (
    sequentialAssignment.size > 0 &&
    dataColumns.length >= Math.ceil(expectedAntigens.length * 0.5) &&
    (hasDuplicateCols || headersSparse)
  ) {
    return sequentialAssignment;
  }

  return assignment;
}

function splitResultTokens(raw: string): string[] {
  return raw
    .trim()
    .split(/\s+/)
    .map(token => token.trim())
    .filter(Boolean);
}

function isDonorLikeCellText(raw: string): boolean {
  const compact = raw.trim().replace(/\s+/g, '');
  if (!compact) {
    return false;
  }
  if (isPhenotypeLikeCellText(compact)) {
    return false;
  }
  if (compact.length >= 7 && /^\d+$/.test(compact)) {
    return true;
  }
  return (
    compact.length >= 5 &&
    /^[A-Z0-9]+$/i.test(compact) &&
    /\d/.test(compact) &&
    !isResultLikeToken(compact)
  );
}

function isResultLikeToken(raw: string): boolean {
  const resolved = resolveCellResultValue(raw);
  return resolved.value !== '' && !resolved.blankLike;
}

type ResolveCellOptions = {
  groupSpan?: GroupSpan | null;
  specialColumns?: SpecialColumns;
  groupAntigens?: string[];
  antigen?: string;
};

function resolveCellValueFromRow(
  row: Array<{text: string; confidence: number}>,
  sourceColumn: number,
  options?: ResolveCellOptions,
): {text: string; confidence: number} {
  const cell = row[sourceColumn] ?? {text: '', confidence: 100};
  const trimmed = cell.text.trim();

  if (trimmed) {
    const tokens = splitResultTokens(trimmed);
    if (tokens.length > 1 && options?.groupAntigens && options.antigen) {
      const targetIndex = options.groupAntigens.indexOf(options.antigen);
      if (targetIndex >= 0 && targetIndex < tokens.length) {
        const token = tokens[targetIndex];
        if (isResultLikeToken(token)) {
          return {text: token, confidence: cell.confidence};
        }
      }
    }

    const resolved = resolveCellResultValue(trimmed);
    if (resolved.blankLike || resolved.value !== '') {
      return cell;
    }
  }

  return cell;
}

function buildGroupMappingContext(
  table: RawTable,
  headerRows: number[],
  groupSpans: GroupSpan[],
  antigenGroups: AntigenGroups,
  antigenLookup: Map<string, string>,
  columnDescriptors: ColumnDescriptor[],
  grid: Array<Array<{text: string; confidence: number}>>,
  dataStartRow: number,
  specialColumns: SpecialColumns,
): {
  spanByGroup: Map<string, GroupSpan>;
  groupAssignments: Map<string, Map<string, number>>;
} {
  const spanByGroup = new Map<string, GroupSpan>();
  for (const span of groupSpans) {
    const current = spanByGroup.get(span.group);
    const spanWidth = span.endCol - span.startCol;
    const currentWidth = current ? current.endCol - current.startCol : -1;
    if (!current || spanWidth > currentWidth) {
      spanByGroup.set(span.group, span);
    }
  }

  const headerMapsByGroup = new Map<string, Map<string, number>>();
  for (const [groupName, span] of spanByGroup.entries()) {
    headerMapsByGroup.set(
      groupName,
      buildHeaderAntigenColumnMapInSpan(
        table,
        headerRows,
        span,
        antigenGroups[groupName] ?? [],
        antigenLookup,
        specialColumns,
      ),
    );
  }
  mergeDetectedColumnsIntoHeaderMaps(
    headerMapsByGroup,
    columnDescriptors,
    spanByGroup,
    specialColumns,
  );

  const groupAssignments = new Map<string, Map<string, number>>();
  for (const [groupName, span] of spanByGroup.entries()) {
    const expectedAntigens = antigenGroups[groupName] ?? [];
    if (expectedAntigens.length === 0) {
      continue;
    }
    const metadataSkip = computeMetadataSkipOffset(span, specialColumns, grid, dataStartRow);
    groupAssignments.set(
      groupName,
      buildGroupColumnAssignment(
        span,
        expectedAntigens,
        headerMapsByGroup.get(groupName) ?? new Map(),
        grid,
        dataStartRow,
        metadataSkip,
        specialColumns,
      ),
    );
  }

  return {spanByGroup, groupAssignments};
}

function isMetadataSourceColumn(
  sourceColumn: number,
  specialColumns: SpecialColumns,
): boolean {
  return (
    sourceColumn === specialColumns.phenotypeCol ||
    sourceColumn === specialColumns.donorNumberCol
  );
}

function buildDescriptorsFromSchemaAndSpans(
  columnDescriptors: ColumnDescriptor[],
  groupSpans: GroupSpan[],
  schemaColumns: Array<{
    key: string;
    label: string;
    kind: 'analysis' | 'supplemental';
    required: boolean;
    aliases?: string[];
    group: string;
    groupAliases: string[];
  }>,
  table: RawTable,
  headerRows: number[],
  antigenGroups: AntigenGroups,
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
  antigenLookup: Map<string, string>,
  grid: Array<Array<{text: string; confidence: number}>>,
  dataStartRow: number,
  specialColumns: SpecialColumns,
): ColumnDescriptor[] {
  const byAntigen = new Map(columnDescriptors.map(descriptor => [descriptor.antigen, descriptor]));
  const spanByGroup = new Map<string, GroupSpan>();
  for (const span of groupSpans) {
    const current = spanByGroup.get(span.group);
    const spanWidth = span.endCol - span.startCol;
    const currentWidth = current ? current.endCol - current.startCol : -1;
    if (!current || spanWidth > currentWidth) {
      spanByGroup.set(span.group, span);
    }
  }

  const headerMapsByGroup = new Map<string, Map<string, number>>();
  for (const [groupName, span] of spanByGroup.entries()) {
    headerMapsByGroup.set(
      groupName,
      buildHeaderAntigenColumnMapInSpan(
        table,
        headerRows,
        span,
        antigenGroups[groupName] ?? [],
        antigenLookup,
        specialColumns,
      ),
    );
  }
  mergeDetectedColumnsIntoHeaderMaps(
    headerMapsByGroup,
    columnDescriptors,
    spanByGroup,
    specialColumns,
  );

  const groupAssignments = new Map<string, Map<string, number>>();
  for (const [groupName, span] of spanByGroup.entries()) {
    const expectedAntigens = antigenGroups[groupName] ?? [];
    if (expectedAntigens.length === 0) {
      continue;
    }
    const metadataSkip = computeMetadataSkipOffset(span, specialColumns, grid, dataStartRow);
    groupAssignments.set(
      groupName,
      buildGroupColumnAssignment(
        span,
        expectedAntigens,
        headerMapsByGroup.get(groupName) ?? new Map(),
        grid,
        dataStartRow,
        metadataSkip,
        specialColumns,
      ),
    );
  }

  const result: ColumnDescriptor[] = [];
  const usedSourceColumns = new Map<number, string>();
  for (const schemaColumn of schemaColumns) {
    const existing = byAntigen.get(schemaColumn.key);
    const span = spanByGroup.get(schemaColumn.group);
    let sourceColumn = groupAssignments.get(schemaColumn.group)?.get(schemaColumn.key);

    if (
      sourceColumn === undefined &&
      existing &&
      !isMetadataSourceColumn(existing.sourceColumn, specialColumns)
    ) {
      sourceColumn = existing.sourceColumn;
    }

    if (sourceColumn === undefined) {
      if (existing) {
        result.push({
          ...existing,
          kind: schemaColumn.kind,
          required: schemaColumn.required,
          expectedGroup: schemaColumn.group,
        });
      }
      continue;
    }

    const priorAntigen = usedSourceColumns.get(sourceColumn);
    if (priorAntigen && priorAntigen !== schemaColumn.key && span) {
      const groupAntigens = antigenGroups[schemaColumn.group] ?? [];
      const metadataSkip = computeMetadataSkipOffset(span, specialColumns, grid, dataStartRow);
      const reassigned = buildGroupColumnAssignment(
        span,
        groupAntigens,
        headerMapsByGroup.get(schemaColumn.group) ?? new Map(),
        grid,
        dataStartRow,
        metadataSkip,
        specialColumns,
      );
      sourceColumn = reassigned.get(schemaColumn.key) ?? sourceColumn;
    }

    usedSourceColumns.set(sourceColumn, schemaColumn.key);
    const headerPath = buildHeaderPathForColumn(table, headerRows, sourceColumn);
    const evidence =
      existing?.sourceColumn === sourceColumn
        ? existing.evidence
        : headerMapsByGroup.get(schemaColumn.group)?.get(schemaColumn.key) === sourceColumn
          ? 'exact'
          : 'group_span';

    result.push({
      ...toColumnDescriptor(
        sourceColumn,
        schemaColumn.key,
        schemaColumn.group,
        headerPath,
        evidence,
        schemaColumnMap,
        antigenToGroupMap,
      ),
      kind: schemaColumn.kind,
      required: schemaColumn.required,
      expectedGroup: schemaColumn.group,
    });
  }

  return result;
}

function mergeDetectedIntoProjection(
  detected: ColumnDescriptor[],
  projected: ColumnDescriptor[],
): ColumnDescriptor[] {
  const detectedByAntigen = new Map(detected.map(descriptor => [descriptor.antigen, descriptor]));

  return projected.map(projectedDescriptor => {
    const match = detectedByAntigen.get(projectedDescriptor.antigen);
    if (
      match &&
      EVIDENCE_SCORES[match.evidence] >= EVIDENCE_SCORES.compact
    ) {
      return {
        ...projectedDescriptor,
        sourceColumn: match.sourceColumn,
        headerPath: match.headerPath.length > 0 ? match.headerPath : projectedDescriptor.headerPath,
        detectedGroup: match.detectedGroup || projectedDescriptor.detectedGroup,
        evidence: match.evidence,
      };
    }
    return projectedDescriptor;
  });
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
  grid: Array<Array<{text: string}>>,
  dataStartRow: number,
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
    conflictingColumns * 3 +
    countResultLikeCellsInRange(
      grid,
      dataStartRow,
      candidate.startCol,
      candidate.endCol,
    ) *
      0.35
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
  grid: Array<Array<{text: string; confidence: number}>>,
  dataStartRow: number,
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
        grid,
        dataStartRow,
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
  const existingByAntigen = new Map(
    columnDescriptors.map(descriptor => [descriptor.antigen, descriptor]),
  );

  return schemaColumns.map((schemaColumn, index) => {
    const antigenMatch = existingByAntigen.get(schemaColumn.key);
    const projectedSourceColumn = bestCandidate.candidate.startCol + index;
    const sourceColumn = antigenMatch?.sourceColumn ?? projectedSourceColumn;
    const headerPath = buildHeaderPathForColumn(table, headerRows, sourceColumn);
    const existing = existingByColumn.get(sourceColumn);
    const groupSpan = getGroupSpanForColumn(groupSpans, sourceColumn);
    const detectedGroup =
      groupSpan?.group ||
      antigenMatch?.detectedGroup ||
      existing?.detectedGroup ||
      resolveDetectedGroup(headerPath, groupLookup) ||
      schemaColumn.group;
    const evidence =
      antigenMatch?.evidence ??
      (existing?.antigen === schemaColumn.key ? existing.evidence : 'schema_projection');

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

  let dataHits = 0;
  for (let row = headerRow + 1; row <= Math.min(table.numRows, headerRow + 16); row++) {
    for (let col = 1; col <= table.numCols; col++) {
      const text = grid[row]?.[col]?.text.trim() ?? '';
      if (text && resolveCellResultValue(text).value !== '' && resolveCellResultValue(text).value !== '?') {
        dataHits++;
      }
    }
  }

  return table.numCols * 10 + headerMatches * 25 + table.numRows + dataHits * 4;
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
    const normalized = normalizeInsensitiveKey(sanitizeOcrHeaderLabel(label));
    if (
      groupLookup.has(normalized) ||
      normalized === 'additionalantigens' ||
      normalized === 'antigens' ||
      normalized === 'specialtypes' ||
      normalized === 'specialantigentyping' ||
      normalized === 'additionalcells' ||
      normalized === 'test' ||
      normalized === 'results'
    ) {
      return true;
    }
    return ['fy', 'le', 'lu', 'jk', 'kp', 'js'].includes(normalized);
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
        specialColumns,
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

    inferMissingSpecialColumns(
      grid,
      dataStartRow,
      groupSpans,
      specialColumns,
      columnDescriptors,
    );

    const stabilizedDescriptors = stabilizeDescriptorsFromGroupSpans(
      mainTable,
      headerRows,
      columnDescriptors,
      groupSpans,
      this.antigenGroups,
      this.antigenToGroupMap,
      this.schemaColumnMap,
      grid,
      dataStartRow,
      specialColumns,
      this.antigenLookup,
    );
    const spanAlignedDescriptors = buildDescriptorsFromSchemaAndSpans(
      stabilizedDescriptors,
      groupSpans,
      this.schemaColumns,
      mainTable,
      headerRows,
      this.antigenGroups,
      this.schemaColumnMap,
      this.antigenToGroupMap,
      this.antigenLookup,
      grid,
      dataStartRow,
      specialColumns,
    );
    columnDescriptors.length = 0;
    columnDescriptors.push(...spanAlignedDescriptors);

    const detectedBeforeProjection = [...columnDescriptors];
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
      grid,
      dataStartRow,
    );
    if (projectedDescriptors && projectedDescriptors.length > 0) {
      const mappedAntigens = new Set(columnDescriptors.map(descriptor => descriptor.antigen));
      for (const projectedDescriptor of projectedDescriptors) {
        if (!mappedAntigens.has(projectedDescriptor.antigen)) {
          const detected = detectedBeforeProjection.find(
            match => match.antigen === projectedDescriptor.antigen,
          );
          columnDescriptors.push(
            detected &&
              EVIDENCE_SCORES[detected.evidence] >= EVIDENCE_SCORES.compact
              ? {
                  ...projectedDescriptor,
                  sourceColumn: detected.sourceColumn,
                  headerPath:
                    detected.headerPath.length > 0
                      ? detected.headerPath
                      : projectedDescriptor.headerPath,
                  evidence: detected.evidence,
                }
              : projectedDescriptor,
          );
          mappedAntigens.add(projectedDescriptor.antigen);
        }
      }
      const reordered = reorderDescriptorsBySchema(columnDescriptors, this.schemaColumns);
      columnDescriptors.length = 0;
      columnDescriptors.push(...reordered);
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

    const {spanByGroup, groupAssignments} = buildGroupMappingContext(
      mainTable,
      headerRows,
      groupSpans,
      this.antigenGroups,
      this.antigenLookup,
      columnDescriptors,
      grid,
      dataStartRow,
      specialColumns,
    );

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
        const groupName = descriptor.expectedGroup || descriptor.detectedGroup || '';
        const groupSpan = spanByGroup.get(groupName) ?? null;
        const groupAntigens = this.antigenGroups[groupName] ?? [];
        const valueCell = resolveCellValueFromRow(row, descriptor.sourceColumn, {
          groupSpan,
          specialColumns,
          groupAntigens,
          antigen: descriptor.antigen,
        });
        const normalized = resolveCellResultValue(valueCell.text);
        const isEmpty = normalized.value === '';
        const needsReview = !isEmpty && (!normalized.exact || normalized.value === '?');
        const isLowConfidence = !isEmpty && normalized.exact && valueCell.confidence < LOW_CONFIDENCE_WARN_THRESHOLD;
        const finalValue = isEmpty ? '' : needsReview && !normalized.exact ? '?' : normalized.value;

        results[descriptor.antigen] = finalValue ?? '';
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

    const extractionColumns = buildExtractionAccuracyColumnSpecs(
      columnDescriptors.map(descriptor => ({
        key: descriptor.antigen,
        kind: descriptor.kind,
        evidence: descriptor.evidence,
        sourceColumn: descriptor.sourceColumn,
      })),
      cells,
    );
    const extractionN = cells.length;
    const extractionX = extractionColumns.length;
    const extractionSlots = buildAnalysisExtractionSlots(cells, extractionColumns, {
      cellConfidences,
    });

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
      extractionAccuracyColumns: extractionColumns.map(column => column.key),
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
