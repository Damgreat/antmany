import {
  AnalyzeDocumentCommand,
  TextractClient,
} from '@aws-sdk/client-textract';
import {ocrDebugLog} from '../utils/ocrDebugLog';

export type TextractAnalyzeConfig = {
  bucket: string;
  key: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
};

/** Run synchronous Textract TABLE analysis on an object already in S3. */
export async function analyzeDocumentFromS3(
  config: TextractAnalyzeConfig,
): Promise<string> {
  // #region agent log
  ocrDebugLog(
    'textractAnalyzeService.ts:analyzeDocumentFromS3',
    'Direct Textract preflight',
    {
      hasTextDecoder: typeof global.TextDecoder !== 'undefined',
      hasTextEncoder: typeof global.TextEncoder !== 'undefined',
      bucket: config.bucket,
      key: config.key,
      region: config.region,
    },
    'H1',
  );
  // #endregion

  const client = new TextractClient({
    region: config.region,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });

  try {
    const response = await client.send(
      new AnalyzeDocumentCommand({
        Document: {
          S3Object: {
            Bucket: config.bucket,
            Name: config.key,
          },
        },
        FeatureTypes: ['TABLES'],
      }),
    );

    const blockCount = Array.isArray(response.Blocks) ? response.Blocks.length : 0;

    // #region agent log
    ocrDebugLog(
      'textractAnalyzeService.ts:analyzeDocumentFromS3',
      'Direct Textract success',
      {blockCount, hasTableBlocks: blockCount > 0},
      'H1',
    );
    // #endregion

    if (blockCount === 0) {
      throw new Error(
        'Direct Textract analysis returned no table blocks for the uploaded image.',
      );
    }

    return JSON.stringify(response);
  } catch (error) {
    // #region agent log
    ocrDebugLog(
      'textractAnalyzeService.ts:analyzeDocumentFromS3',
      'Direct Textract failed',
      {
        errorName: error instanceof Error ? error.name : 'unknown',
        errorMessage: error instanceof Error ? error.message : String(error),
        hasTextDecoder: typeof global.TextDecoder !== 'undefined',
      },
      'H1',
    );
    // #endregion
    throw error;
  }
}
