

# Plan: Fix Cap Table Column Visibility & Rename Entry Val.

## Problems
1. The "Type" column select dropdown gets squeezed/hidden because the table columns compete for space
2. "Entry Val." is unclear — should be renamed to something more descriptive

## Changes to `src/pages/Valuation.tsx`

### 1. Fix column visibility with minimum widths
Add `min-w-[...]` to each `<th>` and corresponding `<td>` to ensure no column collapses:
- Shareholder: `min-w-[140px]`
- Type: `min-w-[120px]` (this is the one being cut)
- % Ownership: `min-w-[110px]`
- Shares: `min-w-[100px]`
- Entry Val.: `min-w-[100px]`
- Entry Date: `min-w-[100px]`

Also ensure the select in the Type column has `min-w-[100px]` so the dropdown text is always visible.

### 2. Rename "Entry Val." to "Entry Valuation (R$ M)"
Makes it clear this is the company valuation in millions of reais at the time the shareholder entered.

## Files Changed
| File | Change |
|------|--------|
| `src/pages/Valuation.tsx` | Add min-widths to all columns, rename header |

