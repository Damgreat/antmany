import {ocrDebugLog} from './ocrDebugLog';

export type TextractLogSource = 'async_poll' | 'direct_analyze' | 'plain_text';

export type TextractBlockSummary = {
  blockCount: number;
  tableCount: number;
  cellCount: number;
  mergedCellCount: number;
  wordCount: number;
  lineCount: number;
  columnHeaderCount: number;
  tableShapes: Array<{rows: number; cols: number; id?: string}>;
  sampleTexts: string[];
};

export type TextractCaptureMeta = {
  captureId: string;
  source: TextractLogSource;
  uploadedKey?: string;
  responseKey?: string;
  manufacturer?: string;
  jsonPath: string;
  summaryPath: string;
  latestPath: string;
  manifestPath: string;
  capturedAt: string;
  summary: TextractBlockSummary;
};

export type TextractParseLogMeta = {
  manufacturer: string;
  cellCount: number;
  extractionAccuracy: number;
  overallConfidence: number;
  phenotypeFilled: number;
  donorFilled: number;
  parseErrorCount: number;
  parseErrors: string[];
};

type TextractBlock = {
  BlockType?: string;
  Id?: string;
  Text?: string;
  RowIndex?: number;
  ColumnIndex?: number;
  EntityTypes?: string[];
};

type ManifestEntry = TextractCaptureMeta & {
  jsonBytes: number;
};

const MANIFEST_FILE = 'manifest.jsonl';
const LATEST_FILE = 'textract-latest.json';
const LATEST_SUMMARY_FILE = 'textract-latest-summary.json';

function getRNFS(): typeof import('react-native-fs') | null {
  try {
    return require('react-native-fs') as typeof import('react-native-fs');
  } catch {
    return null;
  }
}

export function getTextractCaptureDirectory(): string {
  const RNFS = getRNFS();
  if (!RNFS) {
    return '';
  }

  // App-private storage — no external storage permission required on Android.
  return `${RNFS.DocumentDirectoryPath}/textract-captures`;
}

export function buildTextractCaptureId(uploadedKey?: string): string {
  const stem = uploadedKey
    ? uploadedKey.replace(/\.[^.]+$/, '').replace(/[^\w.-]+/g, '_')
    : 'capture';
  return `${stem}-${Date.now()}`;
}

export function summarizeTextractJson(jsonText: string): TextractBlockSummary {
  const empty: TextractBlockSummary = {
    blockCount: 0,
    tableCount: 0,
    cellCount: 0,
    mergedCellCount: 0,
    wordCount: 0,
    lineCount: 0,
    columnHeaderCount: 0,
    tableShapes: [],
    sampleTexts: [],
  };

  if (!jsonText?.trim()) {
    return empty;
  }

  try {
    const payload = JSON.parse(jsonText) as {Blocks?: TextractBlock[]};
    const blocks = Array.isArray(payload.Blocks) ? payload.Blocks : [];
    const tableBlocks = blocks.filter(block => block.BlockType === 'TABLE');
    const sampleTexts = blocks
      .filter(block => block.BlockType === 'WORD' && typeof block.Text === 'string')
      .map(block => block.Text!.trim())
      .filter(Boolean)
      .slice(0, 12);

    return {
      blockCount: blocks.length,
      tableCount: tableBlocks.length,
      cellCount: blocks.filter(block => block.BlockType === 'CELL').length,
      mergedCellCount: blocks.filter(block => block.BlockType === 'MERGED_CELL').length,
      wordCount: blocks.filter(block => block.BlockType === 'WORD').length,
      lineCount: blocks.filter(block => block.BlockType === 'LINE').length,
      columnHeaderCount: blocks.filter(
        block =>
          block.BlockType === 'CELL' &&
          Array.isArray(block.EntityTypes) &&
          block.EntityTypes.includes('COLUMN_HEADER'),
      ).length,
      tableShapes: tableBlocks.map(table => {
        const cells = blocks.filter(
          block =>
            block.BlockType === 'CELL' &&
            typeof block.RowIndex === 'number' &&
            typeof block.ColumnIndex === 'number',
        );
        const rows = cells.reduce((max, cell) => Math.max(max, cell.RowIndex ?? 0), 0);
        const cols = cells.reduce((max, cell) => Math.max(max, cell.ColumnIndex ?? 0), 0);
        return {id: table.Id, rows, cols};
      }),
      sampleTexts,
    };
  } catch {
    return empty;
  }
}

async function ensureCaptureDirectory(directory: string): Promise<void> {
  const RNFS = getRNFS();
  if (!RNFS || !directory) {
    return;
  }

  const exists = await RNFS.exists(directory);
  if (!exists) {
    await RNFS.mkdir(directory);
  }
}

export async function persistTextractResponse(
  rawJson: string,
  options: {
    source: TextractLogSource;
    uploadedKey?: string;
    responseKey?: string;
    manufacturer?: string;
    captureId?: string;
  },
): Promise<TextractCaptureMeta | null> {
  const directory = getTextractCaptureDirectory();
  const RNFS = getRNFS();
  if (!RNFS || !directory || !rawJson?.trim()) {
    return null;
  }

  const captureId = options.captureId ?? buildTextractCaptureId(options.uploadedKey);
  const summary = summarizeTextractJson(rawJson);
  const capturedAt = new Date().toISOString();
  const jsonPath = `${directory}/${captureId}.json`;
  const summaryPath = `${directory}/${captureId}-summary.json`;
  const latestPath = `${directory}/${LATEST_FILE}`;
  const latestSummaryPath = `${directory}/${LATEST_SUMMARY_FILE}`;
  const manifestPath = `${directory}/${MANIFEST_FILE}`;

  const captureMeta: TextractCaptureMeta = {
    captureId,
    source: options.source,
    uploadedKey: options.uploadedKey,
    responseKey: options.responseKey,
    manufacturer: options.manufacturer,
    jsonPath,
    summaryPath,
    latestPath,
    manifestPath,
    capturedAt,
    summary,
  };

  try {
    await ensureCaptureDirectory(directory);
    await RNFS.writeFile(jsonPath, rawJson, 'utf8');
    await RNFS.writeFile(
      summaryPath,
      JSON.stringify(
        {
          ...captureMeta,
          jsonBytes: rawJson.length,
        },
        null,
        2,
      ),
      'utf8',
    );
    await RNFS.writeFile(latestPath, rawJson, 'utf8');
    await RNFS.writeFile(
      latestSummaryPath,
      JSON.stringify(
        {
          ...captureMeta,
          jsonBytes: rawJson.length,
        },
        null,
        2,
      ),
      'utf8',
    );

    const manifestEntry: ManifestEntry = {
      ...captureMeta,
      jsonBytes: rawJson.length,
    };
    await RNFS.appendFile(manifestPath, `${JSON.stringify(manifestEntry)}\n`, 'utf8');

    if (__DEV__) {
      console.log('[Textract Capture]', {
        captureId,
        source: options.source,
        uploadedKey: options.uploadedKey,
        jsonPath,
        summaryPath,
        latestPath,
        ...summary,
      });
    }

    ocrDebugLog(
      'textractResponseLog.ts:persistTextractResponse',
      'Textract JSON persisted',
      {
        captureId,
        source: options.source,
        uploadedKey: options.uploadedKey,
        responseKey: options.responseKey,
        jsonPath,
        summaryPath,
        latestPath,
        blockCount: summary.blockCount,
        tableCount: summary.tableCount,
        tableShapes: summary.tableShapes,
      },
      'H2',
    );

    return captureMeta;
  } catch (error) {
    console.warn('Failed to persist Textract capture:', error);
    ocrDebugLog(
      'textractResponseLog.ts:persistTextractResponse',
      'Textract JSON persist failed',
      {
        captureId,
        error: error instanceof Error ? error.message : String(error),
      },
      'H2',
    );
    return null;
  }
}

export async function logTextractParseOutcome(
  captureMeta: Pick<TextractCaptureMeta, 'captureId' | 'summaryPath' | 'jsonPath'>,
  parseMeta: TextractParseLogMeta,
): Promise<void> {
  const RNFS = getRNFS();
  if (!RNFS || !captureMeta.summaryPath) {
    return;
  }

  try {
    const existing = await RNFS.readFile(captureMeta.summaryPath, 'utf8');
    const payload = JSON.parse(existing) as Record<string, unknown>;
    const merged = {
      ...payload,
      parseOutcome: {
        ...parseMeta,
        loggedAt: new Date().toISOString(),
      },
    };
    await RNFS.writeFile(captureMeta.summaryPath, JSON.stringify(merged, null, 2), 'utf8');

    if (__DEV__) {
      console.log('[Textract Parse]', {
        captureId: captureMeta.captureId,
        ...parseMeta,
        summaryPath: captureMeta.summaryPath,
      });
    }

    ocrDebugLog(
      'textractResponseLog.ts:logTextractParseOutcome',
      'Textract parse outcome logged',
      {
        captureId: captureMeta.captureId,
        jsonPath: captureMeta.jsonPath,
        summaryPath: captureMeta.summaryPath,
        ...parseMeta,
      },
      'H2',
    );
  } catch (error) {
    console.warn('Failed to log Textract parse outcome:', error);
  }
}
