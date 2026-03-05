

# O2 Inc Financial Dashboard — Upgrade Plan

This is a large set of changes across three major areas. Here is the implementation plan broken into clear steps.

---

## 1. Expand the Data Layer (`src/lib/financialData.ts`)

The current data layer only stores 4 top-level aggregates (grossRevenue, netRevenue, grossProfit, ebitda). The P&L drill-down and Overview improvements require a much richer dataset extracted from the Excel.

**New data to add:**
- **Detailed P&L line items** as a hierarchical structure with annual values (2025-2030) from Page 1 of the Excel:
  - Revenue by sub-BU: CaaS (Enterprise, Assessoria, Corporate, Setup), SaaS (Oxy, Oxy+Genio), Education (Dono CFO), BaaS
  - Sales Deductions (total by year)
  - COGS (total by year)
  - Sales Commissions, Marketing Expenses
  - Contribution Margin
  - Administrative Expenses (26 sub-items: 4.01-4.26, annual totals from Excel Page 3)
  - Headcount Expenses (5.01-5.11, annual totals)
  - Commercial Expenses (6.01-6.09, annual totals)
  - Other Expenses, D&A
  - Financial Result (8.01-8.10)
  - Taxes (IRPJ, CSLL)
  - Net Income
  - Debt Payments (11.01-11.04)
  - Capex (12.01-12.06)
  - Final Cash Result

- **Net Income and Net Margin** data for Overview KPI
- **Operating Cash Flow** data for the Margin Evolution chart
- **Monthly breakdown data** per year from Page 2 (for monthly P&L view)

All values will be hardcoded from the Excel (R$ thousands) in a structured `PNL_DATA` object, organized as a tree of `{ label, code, annual: Record<Year, number>, children?: [...] }`.

**New file: `src/lib/pnlData.ts`** — Contains the full P&L hierarchy extracted from the spreadsheet. This keeps `financialData.ts` manageable.

**Updates to `financialData.ts`:**
- Add `netIncome` and `netMargin` to `BASE_ANNUAL_DATA`
- Add `operatingCashFlow` to `BASE_ANNUAL_DATA`
- Extend `ProjectionData` interface with `netIncome`, `netMargin`, `operatingCashFlow`
- Update `calculateProjections` to compute these new fields

---

## 2. Overview Page Improvements (`src/pages/Overview.tsx`)

- **5th KPI card**: Add "Net Margin %" using the new `netMargin` data from projections
- **Assumptions Summary section**: A new card below KPIs showing:
  - YoY Revenue Growth % as a small horizontal bar chart (computed from grossRevenue data)
  - Key highlights: avg ticket per BU (from assumptions.tickets), churn rates, total headcount (summed from HEADCOUNT data)
- **Client Growth chart**: Add a secondary right Y-axis with YoY growth % as a Line overlay
- **Revenue Growth chart tooltip**: Increase font size to 13px, add color-coded dots via custom tooltip component
- **Margin Evolution chart**: Add two new `<Line>` elements for Net Margin % and Cash Generation (operating cash flow as % of revenue)

---

## 3. P&L Page — Full Drill-Down (`src/pages/PnL.tsx`)

Complete rewrite using the hierarchical data structure.

**Implementation approach:**
- Create a recursive `<ExpandableRow>` component that renders a row with a chevron toggle. When expanded, it renders its children rows indented.
- Summary/total rows (Net Revenue, Gross Profit, EBITDA, etc.) rendered as bold, non-expandable rows with background highlight
- Each row shows the label + values for all 6 years (annual view) or 12 months (monthly view)
- Margin % rows shown as badges (green >70%, yellow otherwise)

**View toggle**: Annual | Monthly | 5-Year Summary
- Annual: full table with 2025-2030 columns
- Monthly: 12-month columns for the selected year, values derived from monthly data
- 5-Year: condensed view with totals

**"Update Chart of Accounts" button**: Opens a Dialog/modal with a list of all line items. Each item has:
- Editable label (text input)
- Visibility toggle (eye icon)
- Add new item button at bottom of each group
- State stored in React context or local state (persisted via localStorage)

**Chart of Accounts customization state**: Store in a new `useLocalStorage` hook or within the financial model context as `customLabels: Record<string, string>` and `hiddenItems: string[]`.

---

## 4. Version History System

**New context/state: `src/contexts/VersionHistoryContext.tsx`**
- Stores an array of version snapshots: `{ id, version: string, timestamp: Date, note: string, assumptions: Assumptions, scenario: Scenario }`
- Version 1.0 = initial `DEFAULT_ASSUMPTIONS` with note "Base model (March 5, 2025)"
- When assumptions change and user clicks "Save Version" (or auto-save on assumption page), prompt for a note, then push a new snapshot
- Diff computation: compare current assumptions object vs previous version's assumptions, produce list of `{ field, oldValue, newValue }`

**Sidebar addition (`AppSidebar.tsx`):**
- New "History" nav item with a Clock icon linking to a `/history` page or a slide-out panel

**History Panel/Page (`src/pages/VersionHistory.tsx`):**
- List of all versions with timestamp, version number, and note
- Click a version to enter read-only preview mode (set context to that version's assumptions)
- "Restore this version" button that replaces current assumptions
- Side-by-side diff table showing changed fields

**Header badge (`AppHeader.tsx`):**
- Display current version badge (e.g., "v1.2") next to the scenario switcher

**Storage**: All versions stored in localStorage via a custom hook for persistence across sessions.

---

## File Changes Summary

| File | Action |
|------|--------|
| `src/lib/pnlData.ts` | **New** — Full P&L hierarchy data from Excel |
| `src/lib/financialData.ts` | **Edit** — Add netIncome, netMargin, operatingCashFlow |
| `src/contexts/FinancialModelContext.tsx` | **Edit** — Add chart-of-accounts customization state |
| `src/contexts/VersionHistoryContext.tsx` | **New** — Version snapshot management |
| `src/pages/Overview.tsx` | **Edit** — 5th KPI, assumptions summary, chart improvements |
| `src/pages/PnL.tsx` | **Rewrite** — Full expandable income statement |
| `src/components/layout/AppSidebar.tsx` | **Edit** — Add History nav item |
| `src/components/layout/AppHeader.tsx` | **Edit** — Add version badge |
| `src/pages/VersionHistory.tsx` | **New** — Version history panel |
| `src/App.tsx` | **Edit** — Add /history route, wrap with VersionHistoryProvider |

---

## Implementation Order

1. Data layer expansion (pnlData.ts + financialData.ts updates)
2. P&L page rewrite with expandable rows and Chart of Accounts modal
3. Overview page improvements (KPI, charts, assumptions summary)
4. Version History system (context, page, sidebar/header integration)

