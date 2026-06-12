jest.mock('react-native', () => ({
  Platform: {OS: 'android'},
}));

jest.mock('../src/utils/ocrDebugLog', () => ({
  ocrDebugLog: jest.fn(),
}));

import {
  buildTextractCaptureId,
  summarizeTextractJson,
} from '../src/utils/textractResponseLog';

describe('textractResponseLog', () => {
  it('summarizes table block counts from Textract JSON', () => {
    const json = JSON.stringify({
      Blocks: [
        {BlockType: 'TABLE', Id: 'table-1'},
        {BlockType: 'CELL', RowIndex: 1, ColumnIndex: 1, EntityTypes: ['COLUMN_HEADER']},
        {BlockType: 'CELL', RowIndex: 2, ColumnIndex: 1},
        {BlockType: 'MERGED_CELL', RowIndex: 1, ColumnIndex: 2},
        {BlockType: 'WORD', Text: 'Rh-hr'},
        {BlockType: 'WORD', Text: 'Donor'},
        {BlockType: 'LINE', Text: 'Cell #'},
      ],
    });

    const summary = summarizeTextractJson(json);

    expect(summary.blockCount).toBe(7);
    expect(summary.tableCount).toBe(1);
    expect(summary.cellCount).toBe(2);
    expect(summary.mergedCellCount).toBe(1);
    expect(summary.wordCount).toBe(2);
    expect(summary.columnHeaderCount).toBe(1);
    expect(summary.sampleTexts).toEqual(['Rh-hr', 'Donor']);
  });

  it('returns empty summary for invalid JSON', () => {
    const summary = summarizeTextractJson('not-json');
    expect(summary.blockCount).toBe(0);
    expect(summary.tableCount).toBe(0);
  });

  it('builds capture ids from uploaded key stem', () => {
    const captureId = buildTextractCaptureId('pix-123-panel.jpg');
    expect(captureId.startsWith('pix-123-panel-')).toBe(true);
  });
});
