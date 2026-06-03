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
});
