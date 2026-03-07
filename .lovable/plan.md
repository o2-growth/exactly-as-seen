

# Plan: Remove Entry Valuation Column & Fix Layout Overlap

## Problems
1. "Entry Valuation (R$ M)" column is not needed — remove it
2. Cap table content is hidden behind/overlapping with the donut chart

## Changes to `src/pages/Valuation.tsx`

### 1. Remove Entry Valuation column
- Remove the `<th>` for "Entry Valuation (R$ M)" from the header row
- Remove the `<td>` with the entry valuation input from each shareholder row
- Remove `entryValuation` from `addShareholder` default and the `Shareholder` interface
- Update the total row `colSpan` from 3 to 2

### 2. Fix layout overlap
The cap table uses `grid-cols-1 lg:grid-cols-3` with `lg:col-span-2` for the table and the donut chart taking the remaining column. The table content likely overflows behind the chart. Fix by ensuring the table wrapper doesn't overflow into the chart area — add `overflow-hidden` to the table container and ensure proper `min-w-0` on the grid children so they respect grid boundaries.

## Files Changed
| File | Change |
|------|--------|
| `src/pages/Valuation.tsx` | Remove Entry Valuation column, fix grid overflow |

