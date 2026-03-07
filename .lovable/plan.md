

# Plan: Make Shares Column Editable (Bi-directional)

## Current Behavior
- **% Ownership** is an editable input, shares are computed as `totalSharesPool * pct / 100`
- **Shares** column is read-only display

## New Behavior
- **Shares** column becomes an editable input (formatted with pt-BR dots)
- When user edits shares, **% Ownership auto-calculates** as `shares / totalSharesPool * 100` (1 decimal)
- When user edits % Ownership (existing), shares still auto-calculate (no change)
- The total row always shows the sum; shares should max out at `totalSharesPool`

## Changes to `src/pages/Valuation.tsx`

1. **Replace the read-only shares cell** (line 219) with an `<Input>` that:
   - Displays formatted shares (dots via `formatNumber`)
   - On change, strips non-digits, clamps to `totalSharesPool`, and updates `ownershipPct = (shares / totalSharesPool) * 100`

2. **No model changes needed** — still store `ownershipPct` as source of truth; the shares input just reverse-computes the pct on edit.

## Files Changed
| File | Change |
|------|--------|
| `src/pages/Valuation.tsx` | Make shares cell an editable input with reverse pct calculation |

