/** Delay after a failed Textract poll round (exponential backoff, capped). */
export function getTextractPollDelayMs(attempt: number): number {
  const baseMs = 1000;
  return Math.min(5000, Math.round(baseMs * Math.pow(1.35, Math.max(0, attempt - 1))));
}

export const TEXTRACT_INITIAL_WAIT_MS = 2000;
export const TEXTRACT_POLL_MAX_ATTEMPTS = 30;

export function isTextractResponseNotReady(
  status: number,
  errorMessage?: string,
): boolean {
  if (status === 404) {
    return true;
  }
  if (!errorMessage) {
    return false;
  }
  return /file not found|does not exist|not ready/i.test(errorMessage);
}

/** Primary key only for early polls; try legacy key after a few rounds. */
export function getTextractKeysForAttempt(
  fileKeys: string[],
  attempt: number,
): string[] {
  if (fileKeys.length <= 1 || attempt >= 4) {
    return fileKeys;
  }
  return [fileKeys[0]];
}
