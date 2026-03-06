

# Plan: Full Spreadsheet Fidelity — Engine Detail & Fake Data Removal

## Problem Analysis

After reviewing all files, I identified these gaps between the Excel model and the current platform:

**1. Engine produces summary-level P&L tree, not full chart of accounts**
The hardcoded `PNL_TREE` in `pnlData.ts` has ~80 line items (4.01–4.26 SGA, 5.01–5.11 Headcount, 6.01–6.09 Commercial, 8.01–8.10 Financial, 11.01–11.04 Debt, 12.01–12.06 Capex). But the engine's `buildPnlTree` only outputs ~30 items with no sub-item breakdown for SGA, Commercial, or Financial Result.

**2. Monthly view uses hardcoded data**
`PnL.tsx` imports `MONTHLY_TOTALS_2025` from `pnlData.ts` for the monthly view instead of using the engine's `monthlyData` array.

**3. Fake/placeholder data in several places**
- `CAC_BY_SECTOR` in `financialData.ts` has only 4 sectors; `modelData.ts` has 7
- `HEADCOUNT` array has fabricated scaling numbers (e.g., 3200 CFOs by 2030)
- `ClientsGrowth.tsx` uses these fake headcount/CAC values
- Lead Volume & Conversion section has placeholder inputs with no backing data

**4. No BU-level P&L breakdown**
The user needs per-BU analysis (CaaS, SaaS, Education, BaaS) which the engine computes but doesn't surface.

## Implementation Plan

### Phase 1: Expand Engine Output Types

**File: `src/engine/calculationsEngine.ts`**

Add per-line-item detail to `AnnualOutput`:
- `sgaDetail`: object with all 26 SGA line items (4.01–4.26), each computed individually
- `commercialDetail`: object with all 8 commercial items (6.01–6.09)
- `financialDetail`: object with all 10 financial items (8.01–8.10)
- `debtDetail` expanded: 11.01–11.04
- `capexDetail` expanded: 12.01–12.06
- `headcountDetail` expanded: 5.01–5.11

Modify `calcMonthlySGA` to return per-item breakdown (not a single number). Same for `calcMonthlyCommercial`, financial result, etc.

Update `computeYear` to accumulate all detail items.

### Phase 2: Full Chart of Accounts in buildPnlTree

**File: `src/engine/calculationsEngine.ts`**

Rewrite `buildPnlTree` to output the complete chart of accounts matching `pnlData.ts` structure:
- SGA (code 4): children 4.01–4.26
- Headcount (code 5): children 5.01–5.11
- Commercial (code 6): children 6.01–6.09
- Financial (code 8): children 8.01–8.10
- Debt (code 11): children 11.01–11.04
- Capex (code 12): children 12.01–12.06

All values formula-driven from engine calculations. Items that are zero stay zero (not fabricated).

### Phase 3: Monthly Data from Engine

**File: `src/engine/calculationsEngine.ts`**

Add `monthly` field to `PnlNode` interface:
```
monthly?: Record<Year, number[]>  // 12 values per year
```

Populate monthly arrays during `buildPnlTree` using the `monthlyData` array already computed per year.

**File: `src/lib/pnlData.ts`**

Add `monthly` field to `PnlNode` interface definition.

**File: `src/pages/PnL.tsx`**

Replace `MONTHLY_TOTALS_2025` import with engine's monthly data from the pnlTree nodes. The `getValue` function for monthly view will read `node.monthly[selectedYear][monthIdx]` directly.

### Phase 4: Remove Fake Data

**File: `src/lib/financialData.ts`**
- Replace `CAC_BY_SECTOR` with import from `modelData.ts` (7 sectors)
- Replace `HEADCOUNT` with engine-computed headcount (using `headcountRatios` + `namedEmployees2025`)
- Remove `PNL_TREE` reference (no longer used once engine tree is authoritative)

**File: `src/pages/ClientsGrowth.tsx`**
- CAC by Sector: use `cacBySector` from `modelData.ts` (7 real sectors)
- Headcount table: compute from named employees + ratio-based hires per year (from engine), not fabricated array
- Remove Lead Volume placeholder inputs (or label them clearly as "manual input — not from model")

**File: `src/pages/DebtFinance.tsx`**
- Pre-populate tax debt table with `taxDebtItems` from `modelData.ts` (8 real items) instead of empty
- Pre-populate investor debt with "Negociação Debentures" from `debtSchedule`

### Phase 5: BU-Level Analysis Support

**File: `src/engine/calculationsEngine.ts`**

Add `buBreakdown` to `AnnualOutput`:
```
buBreakdown: {
  caas: { revenue, cogs, commissions, marketing, contributionMargin },
  saas: { ... },
  education: { ... },
  baas: { ... },
}
```

These values are already computed per-month in the engine; just need to be accumulated and exposed.

**File: `src/pages/ClientsGrowth.tsx`**

Add a "BU Analysis" section showing per-BU revenue, margin, and client metrics using the engine's `buBreakdown`.

## File Changes Summary

| File | Action |
|------|--------|
| `src/lib/pnlData.ts` | Edit — add `monthly` to PnlNode, keep as interface-only file |
| `src/engine/calculationsEngine.ts` | Major edit — detailed line items, monthly arrays, BU breakdown |
| `src/pages/PnL.tsx` | Edit — use engine monthly data, remove MONTHLY_TOTALS import |
| `src/lib/financialData.ts` | Edit — replace fake CAC/HEADCOUNT with real data |
| `src/pages/ClientsGrowth.tsx` | Edit — real CAC sectors, engine-based headcount |
| `src/pages/DebtFinance.tsx` | Edit — pre-populate tax/investor debt from modelData |
| `src/pages/CashFlow.tsx` | Minor edit — ensure it reads from detailed engine tree |

## Implementation Order

1. Expand engine types + detailed calculations
2. Full chart of accounts in buildPnlTree + monthly arrays
3. Update PnL page to use engine monthly data
4. Clean up financialData.ts (remove fake data)
5. Update ClientsGrowth with real data
6. Update DebtFinance with real data
7. Add BU breakdown

