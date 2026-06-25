jest.mock('../src/services/DatabaseService', () => ({
  __esModule: true,
  default: {},
}));

import {PanelTableParser} from '../src/services/PanelTableParser';

type Block = Record<string, any>;

function buildWord(id: string, text: string, confidence = 99): Block {
  return {
    BlockType: 'WORD',
    Id: id,
    Text: text,
    Confidence: confidence,
  };
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

function buildResponse(): string {
  const blocks: Block[] = [];
  const tableChildIds: string[] = [];

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
  appendCell('donor-header', 1, 2, 'Donor Number');
  appendCell('rh-group', 1, 3, 'Rh-hr', 1, 5, 'MERGED_CELL');
  appendCell('result-group', 1, 8, 'Test Results');

  appendCell('rh-columns', 2, 3, 'D C E c e', 1, 5, 'MERGED_CELL');
  appendCell('result-header', 2, 8, 'IS');

  appendCell('row1-cell', 3, 1, '1');
  appendCell('row1-donor', 3, 2, '123456');
  appendCell('row1-d', 3, 3, '+');
  appendCell('row1-c', 3, 4, '0');
  appendCell('row1-e', 3, 5, '+');
  appendCell('row1-lc', 3, 6, '0');
  appendCell('row1-le', 3, 7, '+');
  appendCell('row1-is', 3, 8, '0');

  appendCell('row2-cell', 4, 1, '2');
  appendCell('row2-donor', 4, 2, '654321');
  appendCell('row2-d', 4, 3, '0');
  appendCell('row2-c', 4, 4, '+');
  appendCell('row2-e', 4, 5, '0');
  appendCell('row2-lc', 4, 6, '+');
  appendCell('row2-le', 4, 7, '0');
  appendCell('row2-is', 4, 8, '+');

  blocks.unshift({
    BlockType: 'TABLE',
    Id: 'table-1',
    Relationships: [{Type: 'CHILD', Ids: tableChildIds}],
  });

  return JSON.stringify({Blocks: blocks});
}

describe('PanelTableParser', () => {
  it('preserves grouped header child columns from merged header cells', () => {
    const parser = new PanelTableParser('ALBA');
    const result = parser.parse(buildResponse());

    expect(result.panelData.antigens.slice(0, 5)).toEqual(['D', 'C', 'E', 'c', 'e']);
    expect(
      result.panelData.metadata.columnLayout
        ?.filter(column => column.kind !== 'side' && column.kind !== 'result')
        .slice(0, 5)
        .map(column => column.group),
    ).toEqual(['Rh-hr', 'Rh-hr', 'Rh-hr', 'Rh-hr', 'Rh-hr']);
    expect(result.panelData.cells[0].results.D).toBe('+');
    expect(result.panelData.cells[0].results.C).toBe('0');
    expect(result.panelData.cells[1].results.c).toBe('+');
    expect(result.panelData.cells[1].results.result).toBe('+');
  });

  it('infers compact merged antigen headers by group span position', () => {
    const blocks: Block[] = [];
    const tableChildIds: string[] = [];

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
    appendCell('donor-header', 1, 2, 'Donor Number');
    appendCell('rh-group', 1, 3, 'Rh-hr', 1, 8, 'MERGED_CELL');
    appendCell('kell-group', 1, 11, 'KELL', 1, 6, 'MERGED_CELL');
    appendCell('duffy-group', 1, 17, 'DUFFY', 1, 2, 'MERGED_CELL');
    appendCell('kidd-group', 1, 19, 'KIDD', 1, 2, 'MERGED_CELL');
    appendCell('lewis-group', 1, 21, 'LEWIS', 1, 2, 'MERGED_CELL');
    appendCell('mns-group', 1, 23, 'MNS', 1, 4, 'MERGED_CELL');
    appendCell('p-group', 1, 27, 'P');
    appendCell('lutheran-group', 1, 28, 'LUTHERAN', 1, 2, 'MERGED_CELL');
    appendCell('additional-group', 1, 30, 'Additonal Antigens', 1, 3, 'MERGED_CELL');
    appendCell('result-group', 1, 33, 'TEST.');

    appendCell('rh-compact', 2, 3, 'DCEcefVC*', 1, 8, 'MERGED_CELL');
    appendCell('k-col', 2, 11, 'K');
    appendCell('little-k-col', 2, 12, 'k');
    appendCell('kp-compact', 2, 13, 'Kp', 1, 2, 'MERGED_CELL');
    appendCell('js-compact', 2, 15, 'Js', 1, 2, 'MERGED_CELL');
    appendCell('fy-compact', 2, 17, 'Fy', 1, 2, 'MERGED_CELL');
    appendCell('jk-compact', 2, 19, 'Jk', 1, 2, 'MERGED_CELL');
    appendCell('le-compact', 2, 21, 'Le', 1, 2, 'MERGED_CELL');
    appendCell('mns-compact', 2, 23, 'MNSs', 1, 4, 'MERGED_CELL');
    appendCell('p1-col', 2, 27, 'P1');
    appendCell('lu-compact', 2, 28, 'Lu', 1, 2, 'MERGED_CELL');
    appendCell('xga-col', 2, 30, 'Xg*');
    appendCell('wr-col', 2, 31, 'Wr');
    appendCell('special-types-col', 2, 32, 'Special Types');
    appendCell('result-col', 2, 33, 'IS');
    appendCell('cell-header-duplicate', 2, 34, 'Cell #');

    appendCell('row1-cell', 3, 1, '1');
    appendCell('row1-donor', 3, 2, '123456');

    const rowValues = [
      '+', '0', '+', '0', '+', '0', '+', '0',
      '+', '0', '+', '0', '+', '0', '+', '0',
      '+', '0', '+', '0', '+', '0', '+', '0',
      '+', '0', '+', '0', '+', '0',
    ];

    rowValues.forEach((value, index) => {
      appendCell(`row1-antigen-${index + 1}`, 3, 3 + index, value);
    });
    appendCell('row1-result', 3, 33, '+');

    blocks.unshift({
      BlockType: 'TABLE',
      Id: 'table-compact',
      Relationships: [{Type: 'CHILD', Ids: tableChildIds}],
    });

    const parser = new PanelTableParser('ALBA');
    const result = parser.parse(JSON.stringify({Blocks: blocks}));

    expect(result.parseErrors).toEqual([]);
    expect(result.panelData.antigens).toEqual([
      'D', 'C', 'E', 'c', 'e', 'f', 'V', 'Cw',
      'K', 'k', 'Kpa', 'Kpb', 'Jsa', 'Jsb',
      'Fya', 'Fyb', 'Jka', 'Jkb', 'Lea', 'Leb',
      'M', 'N', 'S', 's', 'P1', 'Lua', 'Lub', 'Xga', 'Wra',
    ]);
    expect(result.panelData.cells[0].results.Kpa).toBe('+');
    expect(result.panelData.cells[0].results.Kpb).toBe('0');
    expect(result.panelData.cells[0].results.Jsa).toBe('+');
    expect(result.panelData.cells[0].results.Fya).toBe('+');
    expect(result.panelData.cells[0].results.Lua).toBe('0');
    expect(result.panelData.cells[0].results.result).toBe('+');
    expect(result.metrics.completenessScore).toBe(100);
    expect(result.metrics.structureScore).toBeGreaterThanOrEqual(95);
    expect(result.overallConfidence).toBeGreaterThanOrEqual(95);
  });

  it('expands compact subgroup headers even when the parent group label is missing', () => {
    const blocks: Block[] = [];
    const tableChildIds: string[] = [];

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
    appendCell('donor-header', 1, 2, 'Donor Number');
    appendCell('kp-header', 1, 3, 'Kp', 1, 2, 'MERGED_CELL');
    appendCell('fy-header', 1, 5, 'Fy', 1, 2, 'MERGED_CELL');
    appendCell('jk-header', 1, 7, 'Jk', 1, 2, 'MERGED_CELL');
    appendCell('lu-header', 1, 9, 'Lu', 1, 2, 'MERGED_CELL');
    appendCell('result-header', 1, 11, 'IS');

    appendCell('row1-cell', 2, 1, '1');
    appendCell('row1-donor', 2, 2, '123456');
    appendCell('row1-kpa', 2, 3, '+');
    appendCell('row1-kpb', 2, 4, '0');
    appendCell('row1-fya', 2, 5, '+');
    appendCell('row1-fyb', 2, 6, '0');
    appendCell('row1-jka', 2, 7, '+');
    appendCell('row1-jkb', 2, 8, '0');
    appendCell('row1-lua', 2, 9, '+');
    appendCell('row1-lub', 2, 10, '0');
    appendCell('row1-is', 2, 11, '+');

    blocks.unshift({
      BlockType: 'TABLE',
      Id: 'table-compact-no-group',
      Relationships: [{Type: 'CHILD', Ids: tableChildIds}],
    });

    const parser = new PanelTableParser('ALBA');
    const result = parser.parse(JSON.stringify({Blocks: blocks}));

    expect(result.parseErrors.some(error => error.startsWith('Unmapped header column'))).toBe(false);
    expect(result.panelData.antigens).toEqual([
      'Kpa', 'Kpb', 'Fya', 'Fyb', 'Jka', 'Jkb', 'Lua', 'Lub',
    ]);
    expect(result.panelData.cells[0].results.Kpa).toBe('+');
    expect(result.panelData.cells[0].results.Kpb).toBe('0');
    expect(result.panelData.cells[0].results.Fya).toBe('+');
    expect(result.panelData.cells[0].results.Jkb).toBe('0');
    expect(result.panelData.cells[0].results.Lua).toBe('+');
    expect(result.panelData.cells[0].results.result).toBe('+');
  });

  it('uses the detected group span to resolve repeated compact child headers', () => {
    const blocks: Block[] = [];
    const tableChildIds: string[] = [];

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
    appendCell('donor-header', 1, 2, 'Donor Number');
    appendCell('rh-group', 1, 3, 'Rh-hr', 1, 8, 'MERGED_CELL');
    appendCell('kell-group', 1, 11, 'KELL', 1, 6, 'MERGED_CELL');
    appendCell('duffy-group', 1, 17, 'DUFFY', 1, 2, 'MERGED_CELL');
    appendCell('kidd-group', 1, 19, 'KIDD', 1, 2, 'MERGED_CELL');
    appendCell('lewis-group', 1, 21, 'LEWIS', 1, 2, 'MERGED_CELL');
    appendCell('mns-group', 1, 23, 'MNS', 1, 4, 'MERGED_CELL');
    appendCell('p-group', 1, 27, 'P');
    appendCell('lutheran-group', 1, 28, 'LUTHERAN', 1, 2, 'MERGED_CELL');
    appendCell('additional-group', 1, 30, 'Additonal Antigens', 1, 3, 'MERGED_CELL');
    appendCell('result-group', 1, 33, 'TEST RESULTS');

    appendCell('rh-d', 2, 3, 'D');
    appendCell('rh-c', 2, 4, 'C');
    appendCell('rh-e', 2, 5, 'E');
    appendCell('rh-lc', 2, 6, 'c');
    appendCell('rh-le', 2, 7, 'e');
    appendCell('rh-f', 2, 8, 'f');
    appendCell('rh-v', 2, 9, 'V');
    appendCell('rh-cw', 2, 10, 'Cw');
    appendCell('k-col', 2, 11, 'K');
    appendCell('little-k-col', 2, 12, 'k');
    appendCell('kp-a', 2, 13, 'Kp');
    appendCell('kp-b', 2, 14, 'Kp');
    appendCell('js-a', 2, 15, 'Js');
    appendCell('js-b', 2, 16, 'Js');
    appendCell('fy-a', 2, 17, 'Fy');
    appendCell('fy-b', 2, 18, 'Fy');
    appendCell('jk-a', 2, 19, 'Jk');
    appendCell('jk-b', 2, 20, 'Jk');
    appendCell('le-a', 2, 21, 'Le');
    appendCell('le-b', 2, 22, 'Le');
    appendCell('m-col', 2, 23, 'M');
    appendCell('n-col', 2, 24, 'N');
    appendCell('s-col', 2, 25, 'S');
    appendCell('small-s-col', 2, 26, 's');
    appendCell('p1-col', 2, 27, 'P1');
    appendCell('lu-a', 2, 28, 'Lu');
    appendCell('lu-b', 2, 29, 'Lu');
    appendCell('xga-col', 2, 30, 'Xg*');
    appendCell('wr-col', 2, 31, 'Wr');
    appendCell('special-types-col', 2, 32, 'Special Types');
    appendCell('is-col', 2, 33, 'IS');

    appendCell('row1-cell', 3, 1, '1');
    appendCell('row1-donor', 3, 2, '123456');

    const values = [
      '+', '0', '+', '0', '+', '0', '+', '0',
      '+', '0', '+', '0', '+', '0', '+', '0',
      '+', '0', '+', '0', '+', '0', '+', '0',
      '+', '0', '+', '0', '+', '0',
    ];

    values.forEach((value, index) => {
      appendCell(`row1-value-${index + 1}`, 3, 3 + index, value);
    });
    appendCell('row1-is', 3, 33, '+');

    blocks.unshift({
      BlockType: 'TABLE',
      Id: 'table-group-span-stabilized',
      Relationships: [{Type: 'CHILD', Ids: tableChildIds}],
    });

    const parser = new PanelTableParser('ALBA');
    const result = parser.parse(JSON.stringify({Blocks: blocks}));

    expect(result.parseErrors).toEqual([]);
    expect(result.panelData.antigens).toEqual([
      'D', 'C', 'E', 'c', 'e', 'f', 'V', 'Cw',
      'K', 'k', 'Kpa', 'Kpb', 'Jsa', 'Jsb',
      'Fya', 'Fyb', 'Jka', 'Jkb', 'Lea', 'Leb',
      'M', 'N', 'S', 's', 'P1', 'Lua', 'Lub', 'Xga', 'Wra',
    ]);
    expect(result.metrics.completenessScore).toBe(100);
    expect(result.metrics.structureScore).toBeGreaterThanOrEqual(95);
    expect(result.overallConfidence).toBeGreaterThanOrEqual(95);
  });

  it('projects the full schema across a stable header window when child headers are weak', () => {
    const blocks: Block[] = [];
    const tableChildIds: string[] = [];

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
    appendCell('donor-header', 1, 2, 'Donor Number');
    appendCell('result-group', 1, 33, 'TEST RESULTS');

    appendCell('d-col', 2, 3, 'D');
    appendCell('c-col', 2, 4, 'C');
    appendCell('e-col', 2, 5, '');
    appendCell('little-c-col', 2, 6, '');
    appendCell('little-e-col', 2, 7, '');
    appendCell('f-col', 2, 8, '');
    appendCell('v-col', 2, 9, 'V');
    appendCell('cw-col', 2, 10, 'Cw');
    appendCell('k-col', 2, 11, 'K');
    appendCell('little-k-col', 2, 12, 'k');
    appendCell('kp-a', 2, 13, 'Kp');
    appendCell('kp-b', 2, 14, 'Kp');
    appendCell('js-a', 2, 15, 'Js');
    appendCell('js-b', 2, 16, 'Js');
    appendCell('fy-a', 2, 17, 'Fy');
    appendCell('fy-b', 2, 18, 'Fy');
    appendCell('jk-a', 2, 19, 'Jk');
    appendCell('jk-b', 2, 20, 'Jk');
    appendCell('le-a', 2, 21, 'Le');
    appendCell('le-b', 2, 22, 'Le');
    appendCell('m-col', 2, 23, 'M');
    appendCell('n-col', 2, 24, 'N');
    appendCell('s-col', 2, 25, 'S');
    appendCell('small-s-col', 2, 26, 's');
    appendCell('p1-col', 2, 27, 'P1');
    appendCell('lu-a', 2, 28, 'Lu');
    appendCell('lu-b', 2, 29, 'Lu');
    appendCell('xga-col', 2, 30, 'Xg*');
    appendCell('wr-col', 2, 31, 'Wr');
    appendCell('special-types-col', 2, 32, 'Special Types');
    appendCell('is-col', 2, 33, 'IS');

    appendCell('row1-cell', 3, 1, '1');
    appendCell('row1-donor', 3, 2, '123456');

    const values = [
      '+', '0', '+', '0', '+', '0', '+', '0',
      '+', '0', '+', '0', '+', '0', '+', '0',
      '+', '0', '+', '0', '+', '0', '+', '0',
      '+', '0', '+', '0', '+', '0',
    ];

    values.forEach((value, index) => {
      appendCell(`row1-value-${index + 1}`, 3, 3 + index, value);
    });
    appendCell('row1-is', 3, 33, '+');

    blocks.unshift({
      BlockType: 'TABLE',
      Id: 'table-schema-projection',
      Relationships: [{Type: 'CHILD', Ids: tableChildIds}],
    });

    const parser = new PanelTableParser('ALBA');
    const result = parser.parse(JSON.stringify({Blocks: blocks}));

    expect(result.parseErrors).toEqual([]);
    expect(result.panelData.antigens).toEqual([
      'D', 'C', 'E', 'c', 'e', 'f', 'V', 'Cw',
      'K', 'k', 'Kpa', 'Kpb', 'Jsa', 'Jsb',
      'Fya', 'Fyb', 'Jka', 'Jkb', 'Lea', 'Leb',
      'M', 'N', 'S', 's', 'P1', 'Lua', 'Lub', 'Xga', 'Wra',
    ]);
    expect(result.panelData.metadata.columnLayout?.find(column => column.key === 'Special Types')).toBeTruthy();
    expect(result.metrics.completenessScore).toBe(100);
    expect(result.metrics.mappingScore).toBeGreaterThanOrEqual(92);
    expect(result.overallConfidence).toBeGreaterThanOrEqual(95);
  });

  it('treats blank-like noise as blank and recovers zero-like cell OCR', () => {
    const blocks: Block[] = [];
    const tableChildIds: string[] = [];

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
    appendCell('donor-header', 1, 2, 'Donor Number');
    appendCell('rh-group', 1, 3, 'Rh-hr', 1, 5, 'MERGED_CELL');
    appendCell('result-group', 1, 8, 'Test Results');
    appendCell('rh-columns', 2, 3, 'D C E c e', 1, 5, 'MERGED_CELL');
    appendCell('result-header', 2, 8, 'IS');

    appendCell('row1-cell', 3, 1, '1');
    appendCell('row1-donor', 3, 2, '123456');
    appendCell('row1-d', 3, 3, '.');
    appendCell('row1-c', 3, 4, 'O');
    appendCell('row1-e', 3, 5, '+');
    appendCell('row1-lc', 3, 6, '0');
    appendCell('row1-le', 3, 7, '+');
    appendCell('row1-is', 3, 8, '+');

    blocks.unshift({
      BlockType: 'TABLE',
      Id: 'table-cell-recovery',
      Relationships: [{Type: 'CHILD', Ids: tableChildIds}],
    });

    const parser = new PanelTableParser('ALBA');
    const result = parser.parse(JSON.stringify({Blocks: blocks}));

    expect(result.panelData.cells[0].results.D).toBe('');
    expect(result.panelData.cells[0].results.C).toBe('0');
    expect(result.lowConfidenceCells.some(cell => cell.columnKey === 'D' && cell.value === '?')).toBe(false);
    expect(result.metrics.cellValueScore).toBeGreaterThan(0);
  });

  it('reads slash and starred values as valid panel results', () => {
    const blocks: Block[] = [];
    const tableChildIds: string[] = [];
    const appendCell = (
      id: string,
      row: number,
      col: number,
      text: string,
    ) => {
      const cellBlocks = buildCell(id, row, col, text);
      tableChildIds.push(id);
      blocks.push(...cellBlocks);
    };

    appendCell('cell-header', 1, 1, 'Cell #');
    appendCell('d-header', 1, 2, 'D');
    appendCell('jsa-header', 1, 3, 'Jsa');
    appendCell('k-header', 1, 4, 'K');
    appendCell('row1-cell', 2, 1, '1');
    appendCell('row1-d', 2, 2, '+');
    appendCell('row1-jsa', 2, 3, '/');
    appendCell('row1-k', 2, 4, '*0');

    blocks.unshift({
      BlockType: 'TABLE',
      Id: 'table-slash-star',
      Relationships: [{Type: 'CHILD', Ids: tableChildIds}],
    });

    const parser = new PanelTableParser('ALBA');
    const result = parser.parse(JSON.stringify({Blocks: blocks}));

    expect(result.panelData.cells[0].results.D).toBe('+');
    expect(result.panelData.cells[0].results.Jsa).toBe('/');
    expect(result.panelData.cells[0].results.K).toBe('0');
  });

  it('skips non-result columns inside Rh-hr span even when phenotype is not classified', () => {
    const blocks: Block[] = [];
    const tableChildIds: string[] = [];

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
    appendCell('rh-sub', 2, 2, 'Rh-hr');
    appendCell('donor-sub', 2, 3, 'Donor');
    appendCell('rh-antigens', 2, 4, 'D C E c e f V Cw', 1, 8, 'MERGED_CELL');

    appendCell('row1-cell', 3, 1, '1');
    appendCell('row1-phenotype', 3, 2, 'R1R1');
    appendCell('row1-donor', 3, 3, '6110302318014');
    ['+', '0', '+', '0', '+', '0', '+', '0'].forEach((value, index) => {
      appendCell(`row1-rh-${index}`, 3, 4 + index, value);
    });

    blocks.unshift({
      BlockType: 'TABLE',
      Id: 'table-rhhr-inferred-metadata',
      Relationships: [{Type: 'CHILD', Ids: tableChildIds}],
    });

    const parser = new PanelTableParser('ALBA');
    const result = parser.parse(JSON.stringify({Blocks: blocks}));

    expect(result.panelData.cells[0].results.D).toBe('+');
    expect(result.panelData.cells[0].results.C).toBe('0');
    expect(result.panelData.cells[0].results.E).toBe('+');
    expect(result.panelData.cells[0].phenotype).toBe('R1R1');
    expect(result.panelData.cells[0].donorNumber).toBe('6110302318014');
  });

  it('maps Rh-hr antigens after phenotype and donor metadata columns inside the group span', () => {
    const blocks: Block[] = [];
    const tableChildIds: string[] = [];

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
    appendCell('result-group', 1, 14, 'TEST RESULTS');

    appendCell('rh-sub', 2, 2, 'Rh-hr');
    appendCell('donor-sub', 2, 3, 'Donor');
    appendCell('rh-antigens', 2, 4, 'D C E c e f V Cw', 1, 8, 'MERGED_CELL');
    appendCell('k-col', 2, 12, 'K');
    appendCell('little-k', 2, 13, 'k');
    appendCell('is-col', 2, 14, 'IS');

    const rhValues = ['+', '0', '+', '0', '+', '0', '+', '0'];
    appendCell('row1-cell', 3, 1, '1');
    appendCell('row1-phenotype', 3, 2, 'R1R1');
    appendCell('row1-donor', 3, 3, '6110302318014');
    rhValues.forEach((value, index) => {
      appendCell(`row1-rh-${index}`, 3, 4 + index, value);
    });
    appendCell('row1-k', 3, 12, '+');
    appendCell('row1-little-k', 3, 13, '0');
    appendCell('row1-is', 3, 14, '+');

    appendCell('row2-cell', 4, 1, '2');
    appendCell('row2-phenotype', 4, 2, 'rr');
    appendCell('row2-donor', 4, 3, '1787373');
    ['0', '+', '0', '+', '0', '+', '0', '+'].forEach((value, index) => {
      appendCell(`row2-rh-${index}`, 4, 4 + index, value);
    });
    appendCell('row2-k', 4, 12, '0');
    appendCell('row2-little-k', 4, 13, '+');
    appendCell('row2-is', 4, 14, '0');

    blocks.unshift({
      BlockType: 'TABLE',
      Id: 'table-alba-metadata',
      Relationships: [{Type: 'CHILD', Ids: tableChildIds}],
    });

    const parser = new PanelTableParser('ALBA');
    const result = parser.parse(JSON.stringify({Blocks: blocks}));

    expect(result.panelData.cells[0].results.D).toBe('+');
    expect(result.panelData.cells[0].results.C).toBe('0');
    expect(result.panelData.cells[0].results.E).toBe('+');
    expect(result.panelData.cells[0].results.c).toBe('0');
    expect(result.panelData.cells[0].results.f).toBe('0');
    expect(result.panelData.cells[0].results.V).toBe('+');
    expect(result.panelData.cells[1].results.D).toBe('0');
    expect(result.panelData.cells[1].results.C).toBe('+');
    expect(result.panelData.cells[0].results.K).toBe('+');
  });

  it('maps Kell columns by header labels when physical order differs from schema order', () => {
    const blocks: Block[] = [];
    const tableChildIds: string[] = [];

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
    appendCell('kell-group', 1, 2, 'KELL', 1, 6, 'MERGED_CELL');
    appendCell('k-header', 2, 2, 'K');
    appendCell('little-k', 2, 3, 'k');
    appendCell('jsa-header', 2, 4, 'Jsa');
    appendCell('kpa-header', 2, 5, 'Kpa');
    appendCell('jsb-header', 2, 6, 'Jsb');
    appendCell('kpb-header', 2, 7, 'Kpb');

    appendCell('row1-cell', 3, 1, '1');
    appendCell('row1-k', 3, 2, '+');
    appendCell('row1-little-k', 3, 3, '0');
    appendCell('row1-jsa', 3, 4, '+');
    appendCell('row1-kpa', 3, 5, '0');
    appendCell('row1-jsb', 3, 6, '+');
    appendCell('row1-kpb', 3, 7, '0');

    blocks.unshift({
      BlockType: 'TABLE',
      Id: 'table-kell-reorder',
      Relationships: [{Type: 'CHILD', Ids: tableChildIds}],
    });

    const parser = new PanelTableParser('ALBA');
    const result = parser.parse(JSON.stringify({Blocks: blocks}));

    expect(result.panelData.cells[0].results.K).toBe('+');
    expect(result.panelData.cells[0].results.k).toBe('0');
    expect(result.panelData.cells[0].results.Jsa).toBe('+');
    expect(result.panelData.cells[0].results.Kpa).toBe('0');
    expect(result.panelData.cells[0].results.Jsb).toBe('+');
    expect(result.panelData.cells[0].results.Kpb).toBe('0');
  });

  it('maps each Rh-hr antigen to a distinct data column after donor metadata', () => {
    const blocks: Block[] = [];
    const tableChildIds: string[] = [];

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
    appendCell('donor-header', 1, 2, 'Donor');
    appendCell('rh-group', 1, 3, 'Rh-hr', 1, 8, 'MERGED_CELL');
    appendCell('d-header', 2, 3, 'D');
    appendCell('c-header', 2, 4, 'C');
    appendCell('e-header', 2, 5, 'E');
    appendCell('little-c-header', 2, 6, 'c');
    appendCell('little-e-header', 2, 7, 'e');
    appendCell('f-header', 2, 8, 'f');
    appendCell('v-header', 2, 9, 'V');
    appendCell('cw-header', 2, 10, 'Cw');

    const rowPatterns = [
      ['+', '0', '0', '0', '+', '0', 'NT', '0'],
      ['+', '0', '+', '0', '+', '0', 'NT', '0'],
      ['+', '0', '+', '+', '0', '0', 'NT', '0'],
    ];

    rowPatterns.forEach((pattern, rowOffset) => {
      const row = 3 + rowOffset;
      appendCell(`row${row}-cell`, row, 1, String(rowOffset + 1));
      appendCell(`row${row}-donor`, row, 2, `611030231801${rowOffset}`);
      pattern.forEach((value, index) => {
        appendCell(`row${row}-rh-${index}`, row, 3 + index, value);
      });
    });

    blocks.unshift({
      BlockType: 'TABLE',
      Id: 'table-rhhr-distinct',
      Relationships: [{Type: 'CHILD', Ids: tableChildIds}],
    });

    const parser = new PanelTableParser('ALBA');
    const result = parser.parse(JSON.stringify({Blocks: blocks}));

    const layout = result.panelData.metadata.columnLayout ?? [];
    const sourceByKey = new Map(
      layout.filter(column => column.kind === 'analysis').map(column => [column.key, column.sourceColumn]),
    );
    const rhKeys = ['D', 'C', 'E', 'c', 'e', 'f', 'V', 'Cw'];
    const sourceCols = rhKeys.map(key => sourceByKey.get(key));
    expect(new Set(sourceCols).size).toBe(rhKeys.length);
    expect(result.panelData.cells[0].results.D).toBe('+');
    expect(result.panelData.cells[0].results.C).toBe('0');
    expect(result.panelData.cells[0].results.E).toBe('0');
    expect(result.panelData.cells[0].results.V).toBe('NT');
    expect(result.panelData.cells[1].results.E).toBe('+');
  });

  it('does not treat OCR noise N7 as NT', () => {
    const blocks: Block[] = [];
    const tableChildIds: string[] = [];
    const appendCell = (id: string, row: number, col: number, text: string) => {
      const cellBlocks = buildCell(id, row, col, text);
      tableChildIds.push(id);
      blocks.push(...cellBlocks);
    };

    appendCell('cell-header', 1, 1, 'Cell #');
    appendCell('e-header', 1, 2, 'E');
    appendCell('row1-cell', 2, 1, '1');
    appendCell('row1-e', 2, 2, 'N7');

    blocks.unshift({
      BlockType: 'TABLE',
      Id: 'table-n7-not-nt',
      Relationships: [{Type: 'CHILD', Ids: tableChildIds}],
    });

    const parser = new PanelTableParser('ALBA');
    const result = parser.parse(JSON.stringify({Blocks: blocks}));

    expect(result.panelData.cells[0].results.E).not.toBe('NT');
  });

  it('realigns Rh-hr columns when merged header has colSpan 1 and per-column labels are wrong', () => {
    const blocks: Block[] = [];
    const tableChildIds: string[] = [];
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
    appendCell('rh-antigens', 2, 2, 'D C E c e f V Cw', 1, 1, 'MERGED_CELL');
    appendCell('c-h', 2, 3, 'C');
    appendCell('e-h', 2, 4, 'E');
    appendCell('d-h', 2, 5, 'D');

    const pattern = ['+', '0', '0', '0', '+', '0', 'NT', '0'];
    appendCell('row1-cell', 3, 1, '1');
    pattern.forEach((value, index) => {
      appendCell(`row1-rh-${index}`, 3, 2 + index, value);
    });

    blocks.unshift({
      BlockType: 'TABLE',
      Id: 'table-scrambled-rhhr',
      Relationships: [{Type: 'CHILD', Ids: tableChildIds}],
    });

    const parser = new PanelTableParser('ALBA');
    const result = parser.parse(JSON.stringify({Blocks: blocks}));

    expect(result.panelData.cells[0].results.D).toBe('+');
    expect(result.panelData.cells[0].results.C).toBe('0');
    expect(result.panelData.cells[0].results.E).toBe('0');
    expect(result.panelData.cells[0].results.e).toBe('+');
    expect(result.panelData.cells[0].results.V).toBe('NT');
  });

  it('maps truncated OCR headers Fy and Le to Fya and Lea using group position', () => {
    const blocks: Block[] = [];
    const tableChildIds: string[] = [];
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
    appendCell('rh-group', 1, 2, 'Rh-hr', 1, 3, 'MERGED_CELL');
    appendCell('kell-group', 1, 5, 'KELL', 1, 2, 'MERGED_CELL');
    appendCell('duffy-group', 1, 7, 'DUFFY', 1, 2, 'MERGED_CELL');
    appendCell('kidd-group', 1, 9, 'KIDD', 1, 2, 'MERGED_CELL');
    appendCell('lewis-group', 1, 11, 'LEWIS', 1, 2, 'MERGED_CELL');

    appendCell('rh-cols', 2, 2, 'D C E', 1, 3, 'MERGED_CELL');
    appendCell('kell-cols', 2, 5, 'K k', 1, 2, 'MERGED_CELL');
    appendCell('fy-header', 2, 7, 'Fy');
    appendCell('fyb-header', 2, 8, 'Fyb');
    appendCell('jk-cols', 2, 9, 'Jka Jkb', 1, 2, 'MERGED_CELL');
    appendCell('le-header', 2, 11, 'Le');
    appendCell('leb-header', 2, 12, 'Leb');

    appendCell('row1-cell', 3, 1, '1');
    appendCell('row1-d', 3, 2, '+');
    appendCell('row1-c', 3, 3, '0');
    appendCell('row1-e', 3, 4, '0');
    appendCell('row1-k', 3, 5, '+');
    appendCell('row1-kk', 3, 6, '0');
    appendCell('row1-fya', 3, 7, '+');
    appendCell('row1-fyb', 3, 8, '0');
    appendCell('row1-jka', 3, 9, '0');
    appendCell('row1-jkb', 3, 10, '+');
    appendCell('row1-lea', 3, 11, '0');
    appendCell('row1-leb', 3, 12, '+');

    blocks.unshift({
      BlockType: 'TABLE',
      Id: 'table-truncated-headers',
      Relationships: [{Type: 'CHILD', Ids: tableChildIds}],
    });

    const parser = new PanelTableParser('ALBA');
    const result = parser.parse(JSON.stringify({Blocks: blocks}));

    expect(result.panelData.cells[0].results.Fya).toBe('+');
    expect(result.panelData.cells[0].results.Fyb).toBe('0');
    expect(result.panelData.cells[0].results.Lea).toBe('0');
    expect(result.panelData.cells[0].results.Leb).toBe('+');
    expect(result.parseErrors.some(error => error.includes('Unmapped header column 7'))).toBe(
      false,
    );
    expect(result.parseErrors.some(error => error.includes('Unmapped header column 11'))).toBe(
      false,
    );
  });

  it('maps Fy" with OCR quote inside a nested narrow DUFFY span', () => {
    const blocks: Block[] = [];
    const tableChildIds: string[] = [];
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
    appendCell('wide-antigens', 1, 7, 'Antigens', 1, 6, 'MERGED_CELL');
    appendCell('duffy-group', 1, 7, 'DUFFY', 1, 2, 'MERGED_CELL');
    appendCell('lewis-group', 1, 11, 'LEWIS', 1, 2, 'MERGED_CELL');
    appendCell('fy-header', 2, 7, 'Fy"');
    appendCell('fyb-header', 2, 8, 'Fyb');
    appendCell('le-header', 2, 11, 'Le');
    appendCell('leb-header', 2, 12, 'Leb');

    appendCell('row1-cell', 3, 1, '1');
    appendCell('row1-fya', 3, 7, '+');
    appendCell('row1-fyb', 3, 8, '0');
    appendCell('row1-lea', 3, 11, '0');
    appendCell('row1-leb', 3, 12, '+');

    blocks.unshift({
      BlockType: 'TABLE',
      Id: 'table-fy-quote-nested-span',
      Relationships: [{Type: 'CHILD', Ids: tableChildIds}],
    });

    const parser = new PanelTableParser('ALBA');
    const result = parser.parse(JSON.stringify({Blocks: blocks}));

    expect(result.panelData.cells[0].results.Fya).toBe('+');
    expect(result.panelData.cells[0].results.Fyb).toBe('0');
    expect(result.panelData.cells[0].results.Lea).toBe('0');
    expect(result.panelData.cells[0].results.Leb).toBe('+');
    expect(result.parseErrors.some(error => error.includes('Unmapped header column 7'))).toBe(
      false,
    );
    expect(result.parseErrors.some(error => error.includes('Unmapped header column 11'))).toBe(
      false,
    );
  });

  it('keeps analysis columns in ALBA schema order regardless of source column index', () => {
    const blocks: Block[] = [];
    const tableChildIds: string[] = [];
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
    appendCell('rh-group', 1, 2, 'Rh-hr', 1, 5, 'MERGED_CELL');
    appendCell('rh-cols', 2, 2, 'c D e f E', 1, 5, 'MERGED_CELL');
    appendCell('row1-cell', 3, 1, '1');
    appendCell('row1-c', 3, 2, '0');
    appendCell('row1-d', 3, 3, '+');
    appendCell('row1-e', 3, 4, '+');
    appendCell('row1-f', 3, 5, '0');
    appendCell('row1-E', 3, 6, '0');

    blocks.unshift({
      BlockType: 'TABLE',
      Id: 'table-scrambled-source-cols',
      Relationships: [{Type: 'CHILD', Ids: tableChildIds}],
    });

    const parser = new PanelTableParser('ALBA');
    const result = parser.parse(JSON.stringify({Blocks: blocks}));
    const analysisKeys =
      result.panelData.metadata.columnLayout
        ?.filter(column => column.kind === 'analysis')
        .map(column => column.key) ?? [];

    expect(analysisKeys).toEqual(['D', 'E', 'c', 'e', 'f']);
    expect(analysisKeys).not.toEqual(['c', 'D', 'e', 'f', 'E']);
  });

  it('maps ORTHO Panel B partial rows and skips footer rows', () => {
    const blocks: Block[] = [];
    const tableChildIds: string[] = [];

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
    appendCell('kell-group', 1, 12, 'KELL', 1, 6, 'MERGED_CELL');
    appendCell('duffy-group', 1, 18, 'DUFFY', 1, 2, 'MERGED_CELL');
    appendCell('kidd-group', 1, 20, 'KIDD', 1, 2, 'MERGED_CELL');
    appendCell('sex-group', 1, 22, 'Sex Linked');
    appendCell('lewis-group', 1, 23, 'LEWIS', 1, 2, 'MERGED_CELL');
    appendCell('mns-group', 1, 25, 'MNS', 1, 4, 'MERGED_CELL');
    appendCell('p-group', 1, 29, 'P');
    appendCell('luth-group', 1, 30, 'LUTHERAN', 1, 2, 'MERGED_CELL');
    appendCell('special-group', 1, 32, 'Special Antigen Typing');
    appendCell('result-group', 1, 33, 'Test Results');

    appendCell('rh-sub', 2, 2, 'Phenotype Donor D C E c e f C^w V', 1, 10, 'MERGED_CELL');
    appendCell('k-sub', 2, 12, 'K k Kp Js', 1, 6, 'MERGED_CELL');
    appendCell('fy-sub', 2, 18, 'Fy', 1, 2, 'MERGED_CELL');
    appendCell('jk-sub', 2, 20, 'Jk', 1, 2, 'MERGED_CELL');
    appendCell('xg-sub', 2, 22, 'Xg*');
    appendCell('le-sub', 2, 23, 'Le', 1, 2, 'MERGED_CELL');
    appendCell('mns-sub', 2, 25, 'S s M N', 1, 4, 'MERGED_CELL');
    appendCell('p1-sub', 2, 29, 'P1');
    appendCell('lu-sub', 2, 30, 'Lu', 1, 2, 'MERGED_CELL');
    appendCell('special-sub', 2, 32, 'HLA');
    appendCell('is-sub', 2, 33, 'IS');

    const panelRows: Array<{cell: string; values: string[]}> = [
      {cell: '12', values: ['R1R2', 'D12', '+', '0', '+', '0', '+', '0', '+', '0', '+', '0', '+', '0', '+', '0', '+', '0', '+', '0', '+', '0', '+', '0', '+', '0', '+', '0', '+', '0', '+', '0', '']},
      {cell: '13', values: ['R1R2', 'D13', '+', '+', '0', '+', '0', '+', '0', '+', '0', '+', '0', '+', '0', '+', '0', '+', '0', '+', '0', '+', '0', '+', '0', '+', '0', '+', '0', '+', '0', '+', '0', '']},
      {cell: '14', values: ['R1R2', 'D14', '0', '+', '+', '0', '+', '0', '+', '0', '+', '0', '+', '0', '+', '0', '+', '0', '+', '0', '+', '0', '+', '0', '+', '0', '+', '0', '+', '0', '+', '0', '+', '0', '']},
      {cell: '15', values: ['R1R2', 'D15', '+', '0', '0', '+', '0', '+', '0', '+', '0', '+', '0', '+', '0', '+', '0', '+', '0', '+', '0', '+', '0', '+', '0', '+', '0', '+', '0', '+', '0', '+', 'HLA+', '']},
      {cell: '16', values: ['R1R2', 'D16', '0', '0', '+', '+', '0', '+', '0', '+', '0', '+', '0', '+', '0', '+', '0', '+', '0', '+', '0', '+', '0', '+', '0', '+', '0', '+', '0', '+', '0', '+', 'HLA+', '']},
      {cell: '17', values: ['R1R2', 'D17', '+', '+', '+', '0', '+', '0', '+', '0', '+', '0', '+', '0', '+', '0', '+', '0', '+', '0', '+', '0', '+', '0', '+', '0', '+', '0', '+', '0', '+', 'HLA+', '']},
      {cell: '18', values: ['R1R2', 'D18', '0', '0', '0', '0', '+', '0', '+', '0', '+', '0', '+', '0', '+', '0', '+', '0', '+', '0', '+', '0', '+', '0', '+', '0', '+', '0', '+', '0', '+', '0', '+', '0', '']},
      {cell: '19', values: ['R1R2', 'D19', '+', '0', '+', '0', '+', '0', '+', '0', '+', '0', '+', '0', '+', '0', '+', '0', '+', '0', '+', '0', '+', '0', '+', '0', '+', '0', '+', '0', '+', '0', '+', 'HLA+', '']},
      {cell: '20', values: ['R1R2', 'D20', '0', '+', '0', '+', '0', '+', '0', '+', '0', '+', '0', '+', '0', '+', '0', '+', '0', '+', '0', '+', '0', '+', '0', '+', '0', '+', '0', '+', '0', '+', '0', '+', '0', '']},
      {cell: '21', values: ['R1R2', 'D21', '+', '0', '0', '0', '+', '0', '+', '0', '+', '0', '+', '0', '+', '0', '+', '0', '+', '0', '+', '0', '+', '0', '+', '0', '+', '0', '+', '0', '+', '0', '+', '0', '']},
      {cell: '22', values: ['R1R2', 'D22', '0', '0', '+', '+', '0', '+', '0', '+', '0', '+', '0', '+', '0', '+', '0', '+', '0', '+', '0', '+', '0', '+', '0', '+', '0', '+', '0', '+', '0', '+', '0', '+', '0', '']},
    ];

    panelRows.forEach((panelRow, rowOffset) => {
      const row = 3 + rowOffset;
      appendCell(`row${row}-cell`, row, 1, panelRow.cell);
      panelRow.values.forEach((value, index) => {
        appendCell(`row${row}-val-${index}`, row, 2 + index, value);
      });
    });

    appendCell('footer-row', 14, 1, 'Mode of Reactivity 37C/Antiglobulin Variable Cold Var.', 1, 10, 'MERGED_CELL');
    appendCell('additional-header', 15, 1, 'Additional Cells', 1, 5, 'MERGED_CELL');

    blocks.unshift({
      BlockType: 'TABLE',
      Id: 'table-ortho-panel-b',
      Relationships: [{Type: 'CHILD', Ids: tableChildIds}],
    });

    const parser = new PanelTableParser('ORTHO');
    const result = parser.parse(JSON.stringify({Blocks: blocks}));

    expect(result.panelData.cells).toHaveLength(11);
    expect(result.panelData.cells[0].cellId).toBe('12');
    expect(result.panelData.cells[10].cellId).toBe('22');
    expect(result.panelData.cells.some(cell => /mode|additional/i.test(cell.cellId))).toBe(false);
    expect(result.panelData.cells[0].results.D).toBe('+');
    expect(result.metrics.extractionAccuracy).toBeGreaterThanOrEqual(95);
  });

  it('maps ORTHO Panel A rows with MNS s column and real donor numbers', () => {
    const blocks: Block[] = [];
    const tableChildIds: string[] = [];

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
    appendCell('kell-group', 1, 12, 'KELL', 1, 6, 'MERGED_CELL');
    appendCell('duffy-group', 1, 18, 'DUFFY', 1, 2, 'MERGED_CELL');
    appendCell('kidd-group', 1, 20, 'KIDD', 1, 2, 'MERGED_CELL');
    appendCell('sex-group', 1, 22, 'Sex Linked');
    appendCell('lewis-group', 1, 23, 'LEWIS', 1, 2, 'MERGED_CELL');
    appendCell('mns-group', 1, 25, 'MNS', 1, 4, 'MERGED_CELL');
    appendCell('p-group', 1, 29, 'P');
    appendCell('luth-group', 1, 30, 'LUTHERAN', 1, 2, 'MERGED_CELL');
    appendCell('special-group', 1, 32, 'Special Antigen Typing');
    appendCell('result-group', 1, 33, 'Test Results');

    appendCell('rh-sub', 2, 2, 'Phenotype Donor D C E c e f C^w V', 1, 10, 'MERGED_CELL');
    appendCell('k-sub', 2, 12, 'K k Kp Js', 1, 6, 'MERGED_CELL');
    appendCell('fy-sub', 2, 18, 'Fy', 1, 2, 'MERGED_CELL');
    appendCell('jk-sub', 2, 20, 'Jk', 1, 2, 'MERGED_CELL');
    appendCell('xg-sub', 2, 22, 'Xg*');
    appendCell('le-sub', 2, 23, 'Le', 1, 2, 'MERGED_CELL');
    appendCell('mns-sub', 2, 25, 'S s M N', 1, 4, 'MERGED_CELL');
    appendCell('p1-sub', 2, 29, 'P1');
    appendCell('lu-sub', 2, 30, 'Lu', 1, 2, 'MERGED_CELL');
    appendCell('special-sub', 2, 32, 'HLA');
    appendCell('is-sub', 2, 33, 'IS');

    const panelRows = [
      {cell: '1', values: ['R1W11', '332682', '+', '0', '+', '0', '+', '0', '+', '0', '+', '0', '+', '0', '+', '0', '+', '0', '+', '0', '+', '0', '+', '0', '+', '0', '+', '0', '+', '0', '+', '0', '+', '0', '']},
      {cell: '10', values: ['rr', '334948', '+', '0', '+', '0', '+', '0', '+', '0', '+', '0', '+', '0', '+', '0', '+', '0', '+', '0', '+', '0', '+', '0', '+', '0', '+', '0', '+', '0', '+', '0', '+', '0', '']},
      {cell: '11', values: ['R1R1', '334982', '0', '+', '0', '+', '0', '+', '0', '+', '0', '+', '0', '+', '0', '+', '0', '+', '0', '+', '0', '+', '0', '+', '0', '0', '+', '0', '+', '0', '+', '0', '']},
    ];

    panelRows.forEach((panelRow, rowOffset) => {
      const row = 3 + rowOffset;
      appendCell(`row${row}-cell`, row, 1, panelRow.cell);
      panelRow.values.forEach((value, index) => {
        appendCell(`row${row}-val-${index}`, row, 2 + index, value);
      });
    });

    appendCell('phantom-row', 6, 1, '12');
    appendCell('phantom-donor', 6, 3, '12');

    blocks.unshift({
      BlockType: 'TABLE',
      Id: 'table-ortho-panel-a',
      Relationships: [{Type: 'CHILD', Ids: tableChildIds}],
    });

    const parser = new PanelTableParser('ORTHO');
    const result = parser.parse(JSON.stringify({Blocks: blocks}));

    expect(result.panelData.cells).toHaveLength(3);
    expect(result.panelData.cells[0].phenotype).toBe('R1W11');
    expect(result.panelData.cells[1].donorNumber).toBe('334948');
    expect(result.panelData.cells[1].donorNumber).not.toBe('10');
    expect(result.panelData.cells[2].results.S).toBe('+');
    expect(result.panelData.cells[2].results.s).toBe('0');
    expect(result.parseErrors.some(error => error.includes('expected MNS, detected KELL'))).toBe(false);
    expect(result.metrics.extractionAccuracy).toBeGreaterThanOrEqual(95);
  });

  it('does not map MNS s into KELL when OCR splits Js into s', () => {
    const blocks: Block[] = [];
    const tableChildIds: string[] = [];

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
    appendCell('rh-group', 1, 2, 'Rh-hr', 1, 4, 'MERGED_CELL');
    appendCell('kell-group', 1, 6, 'KELL', 1, 6, 'MERGED_CELL');
    appendCell('mns-group', 1, 12, 'MNS', 1, 4, 'MERGED_CELL');

    appendCell('rh-sub', 2, 2, 'Phenotype Donor D C', 1, 4, 'MERGED_CELL');
    appendCell('k-sub', 2, 6, 'K k Kp s', 1, 6, 'MERGED_CELL');
    appendCell('mns-sub', 2, 12, 'S s M N', 1, 4, 'MERGED_CELL');

    appendCell('row1-cell', 3, 1, '1');
    appendCell('row1-pheno', 3, 2, 'R1R1');
    appendCell('row1-donor', 3, 3, '332682');
    appendCell('row1-d', 3, 4, '+');
    appendCell('row1-k', 3, 6, '0');
    appendCell('row1-s-upper', 3, 12, '+');
    appendCell('row1-s-lower', 3, 13, '0');

    blocks.unshift({
      BlockType: 'TABLE',
      Id: 'table-ortho-mns-kell',
      Relationships: [{Type: 'CHILD', Ids: tableChildIds}],
    });

    const parser = new PanelTableParser('ORTHO');
    const result = parser.parse(JSON.stringify({Blocks: blocks}));

    expect(result.parseErrors.some(error => error.includes('expected MNS, detected KELL'))).toBe(false);
    expect(result.panelData.cells[0].results.s).toBe('0');
    expect(result.panelData.cells[0].results.S).toBe('+');
  });

  it('maps BIO-RAD ID-DiaPanel rows and ignores test-result side columns', () => {
    const blocks: Block[] = [];
    const tableChildIds: string[] = [];

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
    appendCell('rh-group', 1, 2, 'Rh-hr', 1, 8, 'MERGED_CELL');
    appendCell('kell-group', 1, 10, 'KELL', 1, 6, 'MERGED_CELL');
    appendCell('duffy-group', 1, 16, 'DUFFY', 1, 2, 'MERGED_CELL');
    appendCell('kidd-group', 1, 18, 'KIDD', 1, 2, 'MERGED_CELL');
    appendCell('lewis-group', 1, 20, 'LEWIS', 1, 2, 'MERGED_CELL');
    appendCell('p-group', 1, 22, 'P');
    appendCell('mns-group', 1, 23, 'MNS', 1, 4, 'MERGED_CELL');
    appendCell('luth-group', 1, 27, 'LUTHERAN', 1, 2, 'MERGED_CELL');
    appendCell('xg-group', 1, 29, 'Xg');
    appendCell('native-group', 1, 30, 'Nativ');
    appendCell('enzym-group', 1, 31, 'Enzym');
    appendCell('remarks-group', 1, 32, 'Bemerkungen');

    appendCell('rh-sub', 2, 2, 'Spezifität Donor D C E c e f', 1, 8, 'MERGED_CELL');
    appendCell('k-sub', 2, 10, 'K k Kp Js', 1, 6, 'MERGED_CELL');
    appendCell('fy-sub', 2, 16, 'Fy', 1, 2, 'MERGED_CELL');
    appendCell('jk-sub', 2, 18, 'Jk', 1, 2, 'MERGED_CELL');
    appendCell('le-sub', 2, 20, 'Le', 1, 2, 'MERGED_CELL');
    appendCell('p1-sub', 2, 22, 'P1');
    appendCell('mns-sub', 2, 23, 'M N S s', 1, 4, 'MERGED_CELL');
    appendCell('lu-sub', 2, 27, 'Lu', 1, 2, 'MERGED_CELL');
    appendCell('xg-sub', 2, 29, 'Xg*');
    appendCell('native-sub', 2, 30, 'Native');
    appendCell('enzym-sub', 2, 31, 'Enzym');
    appendCell('remarks-sub', 2, 32, 'Remarks');

    const panelRows = [
      {cell: '1', phenotype: 'C*CD.ee', donor: '367852', antigens: ['+', '0', '+', '0', '+', '0', '+', '0', '+', '0', '+', '0', '+', '0', '+', '0', '+', '0', '+', '0', '+', '0', '+', '0', '+', '0', '+', '0', '+', '0']},
      {cell: '2', phenotype: 'CC.D.ee', donor: '2863512', antigens: ['+', '+', '0', '+', '0', '+', '0', '+', '0', '+', '0', '+', '0', '+', '0', '+', '0', '+', '0', '+', '0', '+', '0', '+', '0', '+', '0', '+', '0', '+', '0']},
      {cell: '3', phenotype: 'ccd.EE', donor: '412509', antigens: ['0', '+', '+', '0', '+', '0', '+', '0', '+', '0', 'NT', '0', '+', '0', '+', '0', '+', '0', '+', '0', '+', '0', '+', '0', '+', '0', '+', '0', '+', '0']},
    ];

    panelRows.forEach((panelRow, rowOffset) => {
      const row = 3 + rowOffset;
      appendCell(`row${row}-cell`, row, 1, panelRow.cell);
      appendCell(`row${row}-phenotype`, row, 2, panelRow.phenotype);
      appendCell(`row${row}-donor`, row, 3, panelRow.donor);
      panelRow.antigens.forEach((value, index) => {
        appendCell(`row${row}-antigen-${index}`, row, 4 + index, value);
      });
    });

    appendCell('phantom-row', 6, 1, '12');
    appendCell('phantom-donor', 6, 3, '12');

    blocks.unshift({
      BlockType: 'TABLE',
      Id: 'table-biorad-diapanel',
      Relationships: [{Type: 'CHILD', Ids: tableChildIds}],
    });

    const parser = new PanelTableParser('BIO-RAD');
    const result = parser.parse(JSON.stringify({Blocks: blocks}));

    expect(result.panelData.cells).toHaveLength(3);
    expect(result.panelData.cells[0].phenotype).toBe('C*CD.ee');
    expect(result.panelData.cells[0].donorNumber).toBe('367852');
    expect(result.panelData.cells[0].results.D).toBe('+');
    expect(result.panelData.cells[2].results.Jsa).toBe('NT');
    expect(result.parseErrors.some(error => error.includes('Unmapped header column 30'))).toBe(false);
    expect(result.metrics.extractionAccuracy).toBeGreaterThanOrEqual(95);
  });

  it('maps BIO-RAD multilingual stacked headers with donor code and test results', () => {
    const blocks: Block[] = [];
    const tableChildIds: string[] = [];

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
    appendCell('rh-group', 1, 2, 'Rh-hr', 1, 9, 'MERGED_CELL');
    appendCell('kell-group', 1, 11, 'KELL', 1, 6, 'MERGED_CELL');
    appendCell('duffy-group', 1, 17, 'DUFFY', 1, 2, 'MERGED_CELL');
    appendCell('kidd-group', 1, 19, 'KIDD', 1, 2, 'MERGED_CELL');
    appendCell('lewis-group', 1, 21, 'LEWIS', 1, 2, 'MERGED_CELL');
    appendCell('p-group', 1, 23, 'P');
    appendCell('mns-group', 1, 24, 'MNS', 1, 4, 'MERGED_CELL');
    appendCell('luth-group', 1, 28, 'LUTHERAN', 1, 2, 'MERGED_CELL');
    appendCell('xg-group', 1, 30, 'Xg');
    appendCell('extra-group', 1, 31, 'Scianna, Dombrock', 1, 1, 'MERGED_CELL');
    appendCell('native-group', 1, 32, 'Nativ / Native / Immediate (Directo)', 1, 3, 'MERGED_CELL');
    appendCell('remarks-group', 1, 35, 'Bemerkungen / Remarks');

    appendCell('spez-header', 2, 2, 'Spezifität');
    appendCell('donor-header', 2, 3, 'Donor Donneur');
    appendCell('donor-lang-header', 2, 4, 'Donatore Donante Doña');
    appendCell('rh-antigens', 2, 5, 'D C E c e f', 1, 6, 'MERGED_CELL');
    appendCell('k-sub', 2, 11, 'K k Kp Js', 1, 6, 'MERGED_CELL');
    appendCell('fy-sub', 2, 17, 'Fy', 1, 2, 'MERGED_CELL');
    appendCell('jk-sub', 2, 19, 'Jk', 1, 2, 'MERGED_CELL');
    appendCell('le-sub', 2, 21, 'Le', 1, 2, 'MERGED_CELL');
    appendCell('p1-sub', 2, 23, 'P1');
    appendCell('mns-sub', 2, 24, 'M N S s', 1, 4, 'MERGED_CELL');
    appendCell('lu-sub', 2, 28, 'Lu', 1, 2, 'MERGED_CELL');
    appendCell('xg-sub', 2, 30, 'Xg*');
    appendCell('native-sub', 2, 32, 'Nativ');
    appendCell('enzym-sub', 2, 33, 'Easym');
    appendCell('temp-sub', 2, 34, 'PETC');
    appendCell('remarks-sub', 2, 35, 'Remarks');

    const panelRows = [
      {
        cell: '1',
        phenotype: 'C*CD.ee',
        donorCode: 'R1WR',
        donor: '367852',
        antigens: ['+', '0', '+', '0', '+', '0', '+', '0', '+', '0', '+', '0', '+', '0', '+', '0', '+', '0', '+', '0', '+', '0', '+', '0', '+', '0', '+', '0'].slice(0, 26),
        native: '0',
        enzym: '0',
      },
      {
        cell: '2',
        phenotype: 'CC.D.ee',
        donorCode: 'R2R2',
        donor: '2863512',
        antigens: ['+', '+', '0', '+', '0', '+', '0', '+', '0', '+', '0', '+', '0', '+', '0', '+', '0', '+', '0', '+', '0', '+', '0', '+', '0', '+', '0', '+', '0'].slice(0, 26),
        native: '3+',
        enzym: '4+fp',
      },
      {
        cell: '3',
        phenotype: 'ccd.EE',
        donorCode: 'R1R1',
        donor: '412509',
        antigens: ['0', '+', '+', '0', '+', '0', '+', '0', '+', '0', '+', '0', '+', '0', '+', '0', '+', '0', '+', '0', '+', '0', '+', '0', '+', '0', '+', '0'].slice(0, 26),
        native: '3+',
        enzym: '4+fp',
      },
    ];

    panelRows.forEach((panelRow, rowOffset) => {
      const row = 3 + rowOffset;
      appendCell(`row${row}-cell`, row, 1, panelRow.cell);
      appendCell(`row${row}-phenotype`, row, 2, panelRow.phenotype);
      appendCell(`row${row}-donor-code`, row, 3, panelRow.donorCode);
      appendCell(`row${row}-donor`, row, 4, panelRow.donor);
      panelRow.antigens.forEach((value, index) => {
        appendCell(`row${row}-antigen-${index}`, row, 5 + index, value);
      });
      appendCell(`row${row}-native`, row, 32, panelRow.native);
      appendCell(`row${row}-enzym`, row, 33, panelRow.enzym);
    });

    blocks.unshift({
      BlockType: 'TABLE',
      Id: 'table-biorad-real-ocr',
      Relationships: [{Type: 'CHILD', Ids: tableChildIds}],
    });

    const parser = new PanelTableParser('BIO-RAD');
    const result = parser.parse(JSON.stringify({Blocks: blocks}));

    expect(result.panelData.cells).toHaveLength(3);
    expect(result.panelData.cells[0].phenotype).toBe('C*CD.ee');
    expect(result.panelData.cells[0].donorNumber).toBe('367852');
    expect(result.panelData.cells[0].results.D).toBe('+');
    expect(result.panelData.cells[0].results.f).toBe('0');
    expect(result.panelData.cells[0].results.Native).toBe('0');
    expect(result.panelData.cells[1].results.Enzym).toBe('4+fp');
    expect(result.panelData.cells[1].results.Native).toBe('3+');
    expect(result.parseErrors.some(error => error.includes('Unmapped header column 4'))).toBe(false);
    expect(result.parseErrors.some(error => error.includes('expected Rh-hr, detected KELL'))).toBe(false);
    expect(result.metrics.extractionAccuracy).toBeGreaterThanOrEqual(95);
  });
});
