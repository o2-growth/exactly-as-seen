

# Implementation Plan — Cash Flow, Assumptions, Clients & Growth Upgrades

## 1. Cash Flow Page — Full Restructure (`src/pages/CashFlow.tsx`)

**Rewrite** to use the same expandable-row pattern as P&L:

- **Data structure**: Build a cash flow tree from existing `pnlData.ts` values:
  - Opening Balance (derived: previous period's closing balance, starting at 0 for 2025)
  - Inflows group (expandable): CaaS Revenue, SaaS Revenue, Education, BaaS, Financial Income — values from `PNL_TREE` code `1.1`–`1.4`
  - Outflows group (expandable): COGS (code `3`), SG&A (code `4`), Headcount (code `5`), Marketing (code `7`), Debt Repayments (code `11`), Capex (code `12`), Taxes (code `TAX`), Commissions (code `3.1`), Commercial (code `6`)
  - Closing Balance = Opening + Inflows + Outflows (outflows are negative)

- **Expandable table**: Reuse the `ExpandableRow` recursive component approach from P&L. Annual view (2025–2030 columns). Summary rows (Opening, Total Inflows, Total Outflows, Closing) highlighted bold.

- **Waterfall chart**: Below the table. One bar per year showing Opening → +Inflows → −Outflows → Closing. Use stacked bars with green (inflows), red (outflows), blue (net). Professional styling: larger axis fonts (13px), R$ formatted Y-axis via `tickFormatter`, subtle gridlines (`strokeDasharray="3 3"`, lighter stroke), institutional palette (`#0f766e` teal for inflows, `#dc2626` for outflows, `#1e40af` for net).

- **Remove**: All debt detail table (the creditor table at the bottom). Debt lives only in DebtFinance page.

- **Remove**: Cash Runway KPI, Monthly Cumulative chart (replaced by the new structure).

## 2. Assumptions Page — Full Redesign (`src/pages/Assumptions.tsx`)

**Rewrite** from slider-based to spreadsheet-style editable grid:

- **Edit mode toggle**: "Edit Assumptions" button (top right, Lock icon). When locked, all cells are read-only with a muted background. When unlocked, cells become editable inputs with a subtle border highlight.

- **Save flow**: When user clicks "Save", show a Dialog modal requiring a mandatory note ("Why are you changing this assumption?") + Confirm button. On confirm: call `saveVersion()` from VersionHistoryContext, then re-lock cells. "Cancel" discards all changes (reset to last saved state).

- **State management**: Use local `editState` (clone of assumptions) that only commits to context on save. `isDirty` flag tracks unsaved changes.

- **Sections as card-based grids**:

  1. **Client Growth** — Table with rows = sub-products (CaaS Assessoria, Enterprise, Corporate, Setup, SaaS Oxy, Oxy+Gênio, Education Dono CFO, BaaS), columns = 2025–2030. Values from assumptions context. Editable number inputs.

  2. **Average Ticket (BRL/month)** — Simple 2-column grid: Product | Monthly Ticket (R$). 8 rows matching `assumptions.tickets`.

  3. **Churn Rate** — Small table: BU | Annual Churn %. Two rows (CaaS, SaaS).

  4. **Headcount & Salaries** — Table: Role | BU | Headcount per year (2025–2030) | Monthly Salary | Total Monthly Cost. Data from `HEADCOUNT` array. Add a `salary` field per role to the data (editable). Monthly cost = headcount × salary.

  5. **Cost Assumptions** — SG&A items with annual growth rate %. Marketing budget by BU. Read from existing data, growth rate editable.

- **Remove**: All slider components, live preview sidebar chart.

- **Expand `Assumptions` interface** in `financialData.ts` to add:
  - `headcountSalaries: Record<string, number>` — salary per role
  - `sgaGrowthRate: number` — annual SG&A growth %
  - Sub-product client breakdowns per year (currently only top-level CaaS/SaaS/Education)

- **Update `DEFAULT_ASSUMPTIONS`** with new fields and default values.

## 3. Clients & Growth Page — Expand (`src/pages/ClientsGrowth.tsx`)

**Major edits**:

- **Sub-product segmentation**: Replace 3-series bar chart (CaaS/SaaS/Education) with 7+ series: CaaS Enterprise, CaaS Assessoria, CaaS Corporate, SaaS Oxy, SaaS Oxy+Gênio, Education Dono CFO, BaaS. Data derived from new sub-product client assumptions.

- **Planned vs. Actual toggle**: Add a toggle switch at the top. "Planned" = model values (default). "Actual" = editable input table (initially empty/placeholder) for future Meta Ads integration. Store actual data in local state. When "Actual" selected, show editable cells alongside charts.

- **Marketing KPIs section** (new card):
  - CAC by channel/sector: table from `CAC_BY_SECTOR` data
  - LTV:CAC ratio: LTV = Avg Ticket / Monthly Churn (computed)
  - MRR = total clients × avg ticket for selected year; ARR = MRR × 12
  - Lead volume + conversion rate: placeholder input fields

- **Headcount table**: Expand `HEADCOUNT` data with more roles (Customer Service, Operations, etc.) and add salary column. Link to Assumptions page data via context.

## 4. Data Layer Updates (`src/lib/financialData.ts`)

- Extend `Assumptions` interface with: `subProductClients` (per sub-product per year), `headcountSalaries`, `sgaGrowthRate`
- Extend `DEFAULT_ASSUMPTIONS` with sub-product client defaults derived from current totals
- Add `HEADCOUNT_SALARIES` defaults

## File Changes Summary

| File | Action |
|------|--------|
| `src/lib/financialData.ts` | Edit — expand Assumptions with sub-product clients, salaries, SG&A growth |
| `src/pages/CashFlow.tsx` | Rewrite — expandable cash flow table + waterfall chart |
| `src/pages/Assumptions.tsx` | Rewrite — spreadsheet grid with edit/lock, save modal |
| `src/pages/ClientsGrowth.tsx` | Rewrite — sub-product charts, planned/actual, marketing KPIs |

## Implementation Order

1. Data layer (financialData.ts — new assumption fields)
2. Cash Flow page rewrite
3. Assumptions page rewrite
4. Clients & Growth page expansion

