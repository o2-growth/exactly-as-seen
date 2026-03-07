

# Plan: Cap Table Improvements

## Changes to `src/pages/Valuation.tsx`

### 1. Shareholder Types
Update `ShareholderType` from `'Founder' | 'Investor' | 'ESOP'` to `'Founder' | 'Investor' | 'SOP C-Level' | 'SOP Team'` and update the `<select>` options accordingly.

### 2. Shares formatting with dots (pt-BR)
Shares are already displayed via `formatNumber()` which uses `toLocaleString('pt-BR')` — this produces dots. The issue is the **input field** shows raw numbers. Will replace the shares `<Input type="number">` with a text input that formats with dots on display and strips non-digits on change.

### 3. Input-driven % Ownership (% drives shares)
Currently shares are the input and % is computed. Reverse this: make **% Ownership an editable input** and compute shares from `% * totalShares`. Add a **"Total Shares" widget** at the top of the cap table where the user sets the total pool (default 1,000,000). Each shareholder row gets a `%` input, and `shares = Math.round(totalShares * pct / 100)`.

### 4. Total Shares widget
Add an editable field above the cap table: "Total Shares: [input]" stored in state + localStorage. Default: 1,000,000.

### 5. One decimal place on % Ownership
Already using `.toFixed(1)` — will ensure the input also constrains to one decimal.

### 6. First row formatting
Match the screenshot reference: consistent row styling with proper padding and alignment.

## Data Model Change
- Add `totalSharesPool` state (persisted to localStorage)
- Change shareholder model: store `ownershipPct` (number) instead of `shares`; compute `shares = Math.round(totalSharesPool * ownershipPct / 100)`
- Keep backward compat: on load, if old data has shares but no pct, derive pct from shares/total

## Default Data
```
Pedro Albite — Founder — 70.0% — Entry Val 8 — 2017-08
Tiago Pisoni — Founder — 30.0% — 2024-01
Rafael Fleck — Investor — 0.0%
```

## Files Changed
| File | Change |
|------|--------|
| `src/pages/Valuation.tsx` | All changes above |

