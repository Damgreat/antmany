import { Image } from 'react-native';
import { Camera } from 'react-native-vision-camera';
import RNFS from 'react-native-fs';
import { ResultValue, ScanResult, PanelData, DualScanResult } from '../types';
import { PanelTableParser, ParseResult } from './PanelTableParser';
import { PlainTextPanelParser } from './PlainTextPanelParser';
import { enhanceForOCR, validateImageDimensions } from '../utils/imageEnhancement';
import * as AntigenData from './AntigenData';

// ─── Error types ──────────────────────────────────────────────────────────────

export enum ScannerErrorCode {
  CAMERA_UNAVAILABLE = 'CAMERA_UNAVAILABLE',
  INVALID_IMAGE = 'INVALID_IMAGE',
  FILE_TOO_LARGE = 'FILE_TOO_LARGE',
  PARSE_FAILED = 'PARSE_FAILED',
  LOW_CONFIDENCE = 'LOW_CONFIDENCE',
  UPLOAD_FAILED = 'UPLOAD_FAILED',
}

export class ScannerError extends Error {
  constructor(
    public code: ScannerErrorCode,
    message: string,
    public originalError?: unknown
  ) {
    super(message);
    this.name = 'ScannerError';
  }
}

// ─── Service ─────────────────────────────────────────────────────────────────

export class ScannerService {
  private readonly maxFileSize = 50 * 1024 * 1024; // 50 MB
  private camera?: Camera;
  private readonly autoDetectManufacturer = 'Create New';
  private readonly manufacturerHints: Array<{manufacturer: string; patterns: RegExp[]}> = [
    {
      manufacturer: 'ALBA',
      patterns: [/albacyte/i, /\balba\b/i],
    },
    {
      manufacturer: 'ORTHO',
      patterns: [/ortho clinical diagnostics/i, /resolve\s*panel/i, /antigram/i, /\bortho\b/i],
    },
    {
      manufacturer: 'BIOTEST',
      patterns: [/biotest/i],
    },
    {
      manufacturer: 'IMMUCOR',
      patterns: [/immucor/i],
    },
    {
      manufacturer: 'MEDION',
      patterns: [/medion/i],
    },
    {
      manufacturer: 'GRIFOLS',
      patterns: [/grifols/i],
    },
    {
      manufacturer: 'QUOTIENT',
      patterns: [/quotient/i],
    },
    {
      manufacturer: 'BIO-RAD',
      patterns: [/bio[\s-]?rad/i],
    },
  ];

  // ── Image validation ──────────────────────────────────────────────────────

  private async validateFile(fileUri: string): Promise<void> {
    let stat: { size: number };
    try {
      stat = await RNFS.stat(fileUri);
    } catch (err) {
      throw new ScannerError(
        ScannerErrorCode.INVALID_IMAGE,
        `Cannot read file: ${fileUri}`,
        err
      );
    }

    if (stat.size > this.maxFileSize) {
      throw new ScannerError(
        ScannerErrorCode.FILE_TOO_LARGE,
        `File size ${Math.round(stat.size / 1024 / 1024)} MB exceeds the 50 MB limit`
      );
    }
  }

  // ── Public: process raw image URI (camera / gallery) ─────────────────────

  public async processFile(
    fileUri: string,
    manufacturer: string,
    _isFirstPanel: boolean
  ): Promise<ScanResult | null> {
    await this.validateFile(fileUri);

    // Validate image dimensions
    const dims = await this.getImageDimensions(fileUri);
    const dimCheck = validateImageDimensions(dims.width, dims.height);
    if (!dimCheck.valid) {
      throw new ScannerError(
        ScannerErrorCode.INVALID_IMAGE,
        dimCheck.reason ?? 'Invalid image dimensions'
      );
    }

    // Enhance for OCR
    const enhanced = await enhanceForOCR(fileUri);

    return {
      original: fileUri,
      processed: enhanced.uri,
      confidence: 0,  // filled after parse
      results: this.makeEmptyPanel(manufacturer),
    };
  }

  // ── Public: process Textract JSON string ──────────────────────────────────

  public async processFile2(
    jsonData: string,
    manufacturer: string,
    _isFirstPanel: boolean
  ): Promise<ScanResult | null> {
    if (!jsonData || jsonData.trim() === '') {
      throw new ScannerError(
        ScannerErrorCode.PARSE_FAILED,
        'Empty Textract JSON received'
      );
    }

    const parseResult = this.runParser(jsonData, manufacturer);

    return {
      original: '',
      processed: '',
      confidence: parseResult.overallConfidence,
      results: parseResult.panelData,
    };
  }

  // ── Public: parse Textract JSON and return full ParseResult ──────────────

  public parseTextractJson(
    jsonData: string,
    manufacturer: string
  ): ParseResult {
    return this.runParser(jsonData, manufacturer);
  }

  // ── Public: dual-panel processing ────────────────────────────────────────

  public async processFiles(
    files: { first: string; second: string },
    manufacturer: string
  ): Promise<DualScanResult | null> {
    const [first, second] = await Promise.all([
      this.processFile2(files.first, manufacturer, true),
      this.processFile2(files.second, manufacturer, false),
    ]);

    if (!first || !second) return null;

    return { first, second };
  }

  // ── Public: calculate overall confidence for a PanelData ─────────────────

  public calculateConfidence(data: PanelData): number {
    if (typeof data.metadata.ocrMetrics?.overallScore === 'number') {
      return data.metadata.ocrMetrics.overallScore;
    }

    if (!data.cells.length || !data.antigens.length) return 0;

    let total = 0;
    let count = 0;

    for (const cell of data.cells) {
      for (const antigen of data.antigens) {
        const v = cell.results[antigen];
        // Any '?' means an unresolved cell — penalise
        if (v === '?') {
          total += 0;
        } else if (v !== undefined && v !== null && v !== '') {
          total += 100;
        }
        count++;
      }
    }

    return count > 0 ? Math.round(total / count) : 0;
  }

  // ── Public: verify panel compatibility ───────────────────────────────────

  public verifyPanelCompatibility(firstPanel: PanelData, secondPanel: PanelData): boolean {
    if (!firstPanel || !secondPanel) return false;
    // At least some antigens should overlap
    const overlap = firstPanel.antigens.filter(a =>
      secondPanel.antigens.includes(a)
    );
    return overlap.length > 0;
  }

  // ── Public: combine panel results ────────────────────────────────────────

  public combinePanelResults(
    first: PanelData,
    second: PanelData
  ): {
    combinedAntigens: string[];
    commonCells: string[];
    conflictingResults: Array<{
      antigen: string;
      firstResult: ResultValue;
      secondResult: ResultValue;
      cellIds: string[];
    }>;
  } {
    const combinedAntigens = Array.from(
      new Set([...first.antigens, ...second.antigens])
    ).sort();

    const commonCells = first.cells
      .filter(c1 => second.cells.some(c2 => c1.donorNumber === c2.donorNumber))
      .map(c => c.donorNumber);

    const conflictingResults: ReturnType<typeof this.combinePanelResults>['conflictingResults'] = [];

    for (const antigen of combinedAntigens) {
      for (const firstCell of first.cells) {
        const secondCell = second.cells.find(
          c => c.donorNumber === firstCell.donorNumber
        );
        if (
          secondCell &&
          firstCell.results[antigen] !== secondCell.results[antigen] &&
          firstCell.results[antigen] != null &&
          secondCell.results[antigen] != null
        ) {
          conflictingResults.push({
            antigen,
            firstResult: firstCell.results[antigen],
            secondResult: secondCell.results[antigen],
            cellIds: [firstCell.cellId, secondCell.cellId],
          });
        }
      }
    }

    return { combinedAntigens, commonCells, conflictingResults };
  }

  // ── Public: image dimension helper ───────────────────────────────────────

  public getImageDimensions(uri: string): Promise<{ width: number; height: number }> {
    return new Promise((resolve, reject) => {
      Image.getSize(
        uri,
        (width, height) => resolve({ width, height }),
        (err) => reject(new ScannerError(
          ScannerErrorCode.INVALID_IMAGE,
          'Failed to read image dimensions',
          err
        ))
      );
    });
  }

  public setCamera(camera: Camera): void {
    this.camera = camera;
  }

  public async scanPanels(): Promise<DualScanResult | null> {
    return null;
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private runParser(jsonData: string, manufacturer: string): ParseResult {
    try {
      const resolvedManufacturer = this.resolveManufacturer(jsonData, manufacturer);

      // Primary path: full Textract JSON with TABLE blocks
      const parser = new PanelTableParser(resolvedManufacturer);
      const result = parser.parse(jsonData);

      // Fallback: if no TABLE blocks were found, try plain-text CSV parser
      if (result.panelData.cells.length === 0 && result.parseErrors.length > 0) {
        console.warn('[ScannerService] TABLE parse failed, trying PlainTextPanelParser');
        const plainParser = new PlainTextPanelParser(resolvedManufacturer);
        const plainResult = plainParser.parse(jsonData);
        if (plainResult.panelData.cells.length > 0) return plainResult;
      }

      if (result.parseErrors.length > 0) {
        console.warn('[ScannerService] Parse warnings:', result.parseErrors);
      }

      return result;
    } catch (err) {
      throw new ScannerError(
        ScannerErrorCode.PARSE_FAILED,
        `Failed to parse Textract output: ${err instanceof Error ? err.message : String(err)}`,
        err
      );
    }
  }

  private resolveManufacturer(jsonData: string, requestedManufacturer: string): string {
    const normalizedRequested = requestedManufacturer?.trim().toUpperCase();
    const knownManufacturers = new Set(
      AntigenData.ANTIGEN_MANUFACTURERS.map(manufacturer => manufacturer.toUpperCase()),
    );

    if (
      normalizedRequested &&
      normalizedRequested !== 'CUSTOM' &&
      normalizedRequested !== this.autoDetectManufacturer.toUpperCase() &&
      knownManufacturers.has(normalizedRequested)
    ) {
      return requestedManufacturer;
    }

    const textCorpus = this.extractTextCorpus(jsonData);
    for (const hint of this.manufacturerHints) {
      if (hint.patterns.some(pattern => pattern.test(textCorpus))) {
        return hint.manufacturer;
      }
    }

    return this.autoDetectManufacturer;
  }

  private extractTextCorpus(jsonData: string): string {
    try {
      const payload = JSON.parse(jsonData) as {Blocks?: Array<{Text?: string}>; data?: string};
      const blockTexts = Array.isArray(payload.Blocks)
        ? payload.Blocks
            .map(block => (typeof block?.Text === 'string' ? block.Text : ''))
            .filter(Boolean)
        : [];
      const extractedText = typeof payload.data === 'string' ? payload.data : '';
      return `${blockTexts.join(' ')} ${extractedText}`.trim();
    } catch {
      return jsonData;
    }
  }

  private makeEmptyPanel(manufacturer: string): PanelData {
    return {
      cells: [],
      antigens: [],
      metadata: {
        manufacturer,
        lotNumber: '',
        expirationDate: '',
        panelType: 'Panel A',
        testName: '',
      },
      antigenGroups: {} as any,
    };
  }
}

export default ScannerService;
