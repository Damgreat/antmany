import {
  getTextractKeysForAttempt,
  getTextractPollDelayMs,
  isTextractResponseNotReady,
} from '../src/utils/textractPolling';

describe('textractPolling', () => {
  it('uses exponential backoff capped at 5s', () => {
    expect(getTextractPollDelayMs(1)).toBe(1000);
    expect(getTextractPollDelayMs(5)).toBeLessThanOrEqual(5000);
    expect(getTextractPollDelayMs(20)).toBe(5000);
  });

  it('detects not-ready API errors', () => {
    expect(isTextractResponseNotReady(404, 'File not found')).toBe(true);
    expect(isTextractResponseNotReady(500, 'Internal error')).toBe(false);
  });

  it('polls primary key only for first attempts', () => {
    const keys = [
      'resps/pix-1.json',
      'resps/pix-1.jpg.json',
    ];
    expect(getTextractKeysForAttempt(keys, 1)).toEqual([keys[0]]);
    expect(getTextractKeysForAttempt(keys, 4)).toEqual(keys);
  });
});
