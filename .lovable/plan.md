

# Plan: Fix % Ownership Display

## Problem
The `% Ownership` input shows raw numbers (e.g. `70` instead of `70.0`) and has no `%` symbol.

## Changes to `src/pages/Valuation.tsx`

### Line 209: Display value with 1 decimal
Change `value={s.ownershipPct || ''}` to `value={s.ownershipPct ? s.ownershipPct.toFixed(1) : ''}` so it always shows one decimal place (e.g. `70.0`, `30.0`).

### Add `%` suffix
Wrap the input in a relative container and add a `%` symbol as an absolutely-positioned span to the right of the number inside the cell. Adjust input padding-right to avoid overlap.

## Files Changed
| File | Change |
|------|--------|
| `src/pages/Valuation.tsx` | Format ownershipPct with `.toFixed(1)` and add `%` suffix indicator |

