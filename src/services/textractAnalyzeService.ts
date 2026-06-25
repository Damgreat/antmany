import {
  AnalyzeDocumentCommand,
  TextractClient,
} from '@aws-sdk/client-textract';
import {FetchHttpHandler} from '@smithy/fetch-http-handler';
import {ocrDebugLog} from '../utils/ocrDebugLog';

export type TextractAnalyzeConfig = {
  bucket: string;
  key: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  maxAttempts?: number;
};

const DEFAULT_MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 1500;

function formatTextractError(error: unknown, config: TextractAnalyzeConfig): Error {
  const name =
    error && typeof error === 'object' && 'name' in error
      ? String((error as {name: string}).name)
      : '';
  const message = error instanceof Error ? error.message : String(error);
  const lower = `${name} ${message}`.toLowerCase();

  if (
    /network request failed|failed to fetch|network error|econnreset|etimedout|timeout|socket/i.test(
      lower,
    )
  ) {
    return new Error(
      `Direct Textract network error (${config.region}, s3://${config.bucket}/${config.key}): ${message}. Check device internet and that AWS Textract endpoints are reachable.`,
    );
  }

  if (/accessdenied|not authorized|unauthorized|403/i.test(lower)) {
    return new Error(
      `Direct Textract access denied. IAM user needs textract:AnalyzeDocument and s3:GetObject on s3://${config.bucket}/${config.key}.`,
    );
  }

  if (/invalids3object|nosuchkey|404|does not exist/i.test(lower)) {
    return new Error(
      `Direct Textract could not read s3://${config.bucket}/${config.key}. Confirm the upload completed in ${config.region}.`,
    );
  }

  if (/documenttoolarge|limit exceeded|too large/i.test(lower)) {
    return new Error(
      `Direct Textract rejected the image as too large. Try a closer photo or lower JPEG size.`,
    );
  }

  return new Error(`Direct Textract failed (${name || 'Error'}): ${message}`);
}

export function isRetriableTextractError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  const lower = message.toLowerCase();
  return (
    /network request failed|failed to fetch|network error|econnreset|etimedout|timeout|socket|503|429|throttl/i.test(
      lower,
    ) && !/accessdenied|not authorized|invalids3object|documenttoolarge/i.test(lower)
  );
}

function createTextractClient(config: TextractAnalyzeConfig): TextractClient {
  return new TextractClient({
    region: config.region,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
    requestHandler: new FetchHttpHandler({
      requestTimeout: 120_000,
    }),
  });
}

/** Run synchronous Textract TABLE analysis on an object already in S3. */
export async function analyzeDocumentFromS3(
  config: TextractAnalyzeConfig,
): Promise<string> {
  const maxAttempts = config.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    ocrDebugLog(
      'textractAnalyzeService.ts:analyzeDocumentFromS3',
      attempt === 1 ? 'Direct Textract preflight' : 'Direct Textract retry',
      {
        attempt,
        maxAttempts,
        hasTextDecoder: typeof global.TextDecoder !== 'undefined',
        hasTextEncoder: typeof global.TextEncoder !== 'undefined',
        bucket: config.bucket,
        key: config.key,
        region: config.region,
      },
      'H1',
    );

    const client = createTextractClient(config);

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

      ocrDebugLog(
        'textractAnalyzeService.ts:analyzeDocumentFromS3',
        'Direct Textract success',
        {blockCount, attempt},
        'H1',
      );

      if (blockCount === 0) {
        throw new Error(
          'Direct Textract analysis returned no table blocks for the uploaded image.',
        );
      }

      return JSON.stringify(response);
    } catch (error) {
      const formatted = formatTextractError(error, config);
      lastError = formatted;

      ocrDebugLog(
        'textractAnalyzeService.ts:analyzeDocumentFromS3',
        'Direct Textract failed',
        {
          attempt,
          errorName: error instanceof Error ? error.name : 'unknown',
          errorMessage: formatted.message,
        },
        'H1',
      );

      if (attempt < maxAttempts && isRetriableTextractError(error)) {
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS * attempt));
        continue;
      }

      throw formatted;
    }
  }

  throw lastError ?? new Error('Direct Textract failed after retries.');
}
