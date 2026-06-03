# OCR Extraction Accuracy — Test Plan

## Formula

```
extractionAccuracy = round((slotCount − invalidCount) / slotCount × 100)
```

- **slotCount** = number of data rows × number of analysis columns (excludes result/side/supplemental columns).
- **invalidCount** = slots that are empty, `?`, or below confidence threshold (52) when confidence is available.

## Automated tests

Run:

```bash
cd antmany-main
npm test -- ocrExtractionValidation.test.ts
```

| # | Scenario | Input | Expected `accuracyPercent` |
|---|----------|--------|---------------------------|
| 1 | All cells populated | 100 valid slots (`+`, `0`, etc.) | **100%** |
| 2 | Partial empties | 5 invalid / 100 slots | **95%** |
| 3 | Many empties | 20 invalid / 100 slots | **80%** |
| 4 | Empty string | `''` | Invalid (counts toward missing) |
| 5 | Null | `null` | Invalid |
| 6 | Undefined | `undefined` | Invalid |
| 7 | Whitespace only | `'   '`, `'\t\n'` | Invalid |

## Manual / device verification

### Prerequisites

- Run a **debug** build (`__DEV__ === true`) so accuracy logs appear in Metro / Logcat / Xcode console.

### Inspect logs

After OCR parse or after editing cells on **Verify Panel**, look for:

```
[OCR Accuracy] PanelTableParser (n×X)
[OCR Accuracy] VerifyPanel recompute (n×X)
[OCR Accuracy] PlainTextPanelParser (n×X)
```

Each log includes:

| Field | Meaning |
|-------|---------|
| `formula` | Human-readable calculation, e.g. `(100 - 5) / 100 * 100 = 95%` |
| `slotCount` | Total analysis slots |
| `invalidCount` | Missing / unreadable / low-confidence slots |
| `accuracyPercent` | Numeric value used by the app |
| `displayedAccuracy` | Same value as shown in UI (`NN%`) |
| `passAt95Threshold` | Whether PASS chip would show |
| `invalidSamples` | Up to 25 example invalid cells (row, column, reason) |

### UI cross-check

1. Scan a panel or load test Textract JSON.
2. Note **Extraction Accuracy: X%** on Verify Panel.
3. Compare **X** to `accuracyPercent` / `displayedAccuracy` in the log for the same screen state.
4. They must match exactly.

### Manual spot-check matrix

| Step | Action | Expected UI | Expected log |
|------|--------|-------------|--------------|
| A | Panel with all antigen cells filled | 100% PASS | `invalidCount: 0` |
| B | Clear 5 analysis cells (blank) on a 100-slot grid | 95% PASS | `invalidCount: 5`, formula shows 95% |
| C | Clear 20 cells on a 100-slot grid | 80% FAIL | `invalidCount: 20`, `passAt95Threshold: false` |
| D | Set one cell to whitespace only (if editable) | Counts as invalid | `reason: 'empty'` in sample |
| E | Fill cleared cells | Accuracy increases | `invalidCount` decreases |

### Regression checks

- [ ] Empty cells are **not** reported as 100% when 15–20 slots are blank.
- [ ] Editing a blank cell to `+` increases accuracy in UI and in `VerifyPanel recompute` log.
- [ ] `?` cells reduce accuracy (`reason: 'unreadable'`).
- [ ] PASS/FAIL chip at 95% aligns with `passAt95Threshold` in logs.

## Files under test

| File | Role |
|------|------|
| `src/utils/ocrExtractionValidation.ts` | Formula, validation, logging |
| `src/services/PanelTableParser.ts` | Initial accuracy after Textract |
| `src/screens/VerifyPanelScreen.tsx` | Accuracy after user edits |
| `src/services/PlainTextPanelParser.ts` | Fallback parser accuracy |
