/** S3 keys to poll for Textract JSON after uploading an image object key. */
export function buildTextractResponseKeys(uploadedKey: string): string[] {
  const trimmed = uploadedKey.trim();
  const stem = trimmed.replace(/\.[^/.]+$/, '');
  const candidates = [`resps/${stem}.json`, `resps/${trimmed}.json`];
  return [...new Set(candidates)];
}

export function isTextractNotReadyError(message: string): boolean {
  return /file not found|does not exist|not ready|404/i.test(message);
}
