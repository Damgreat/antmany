const DEBUG_ENDPOINT =
  'http://127.0.0.1:7688/ingest/ebb73518-3c0c-42c1-be25-247dc55e48e3';
const SESSION_ID = '93ac18';
const DEVICE_LOG_PATH = '/sdcard/Download/debug-93ac18.log';

export function ocrDebugLog(
  location: string,
  message: string,
  data: Record<string, unknown>,
  hypothesisId: string,
  runId = 'pre-fix',
): void {
  const payload = {
    sessionId: SESSION_ID,
    runId,
    hypothesisId,
    location,
    message,
    data,
    timestamp: Date.now(),
  };

  // #region agent log
  fetch(DEBUG_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Debug-Session-Id': SESSION_ID,
    },
    body: JSON.stringify(payload),
  }).catch(() => {});

  try {
    const RNFS = require('react-native-fs') as typeof import('react-native-fs');
    RNFS.appendFile(DEVICE_LOG_PATH, `${JSON.stringify(payload)}\n`, 'utf8').catch(
      () => {},
    );
  } catch {
    // ignore when RNFS unavailable (e.g. Jest)
  }
  // #endregion
}
