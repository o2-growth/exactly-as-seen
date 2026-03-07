

# Plan: Fix Cap Table Columns and % Input

## Problems
1. Column names get cut off due to fixed widths — need flexible/wider columns
2. Column headers should be centered
3. % Ownership input doesn't accept comma as decimal separator (pt-BR locale) and has formatting issues when typing

## Changes to `src/pages/Valuation.tsx`

### 1. Remove fixed column widths, allow flexible sizing
Remove all `w-28`, `w-24` constraints from `<th>` and `<td>` elements. Use `min-w-[...]` only where needed to prevent collapse, and let the table auto-size columns based on content. Add `whitespace-nowrap` to headers so they don't wrap.

### 2. Center column header text
Change all `<th>` from `text-left`/`text-right` to `text-center`.

### 3. Fix % input to accept comma as decimal separator
Replace the `onChange` handler to:
- Accept both `.` and `,` as decimal separators
- Replace `,` with `.` before parsing
- Allow the user to type freely (store raw text in local state while editing, commit parsed value on blur)
- On blur, format to 2 decimal places

This requires a small refactor: use a local `editingPct` state (keyed by shareholder id) to hold the raw text while the user types, and only update the model on blur.

### 4. Same fix for Shares input
Allow free typing, commit on blur.

## Files Changed
| File | Change |
|------|--------|
| `src/pages/Valuation.tsx` | Flexible columns, centered headers, locale-aware % input with comma support |

