

# Plan: Debt Restructure + Valuation & Cap Table Page

## 1. Debt Page Restructure (`src/pages/DebtFinance.tsx`)

**Rewrite** into 3 categorized sections with summary KPIs:

**Summary card row (top):** 4 KPI cards — Total Debt, Weighted Avg Interest Rate, Total Monthly Debt Service, Debt/EBITDA ratio (using projections.ebitda from context).

**Category 1: Bank Debt (Dívida Bancária)** — Table with columns: Creditor | Amount | Monthly Payment | Final Date | Rate | Monthly Balance (computed: amount minus cumulative payments). Pre-filled with CEF PRONAMP, CEF FAMPE, Santander. Stacked bar amortization chart below (keep existing chart logic).

**Category 2: Tax Debt (Dívida Tributária)** — Same table structure, empty rows with "Add Row" button. Data stored in local state (useState).

**Category 3: Investor/Related Party Debt (Mútuos)** — Table: Investor Name | Amount | Rate | Term | Monthly Payment. Empty rows with "Add Row" button.

Keep the Finance Cycle Timeline at bottom.

## 2. New Valuation & Cap Table Page (`src/pages/Valuation.tsx`)

**New page** with two main sections:

### Section 1: Cap Table
- Editable table: Shareholder | Type (Founder/Investor/ESOP via Select) | Shares | % Ownership (auto-calc) | Entry Valuation | Entry Date
- "Add Shareholder" button
- Recharts PieChart (donut) for ownership split
- State stored in local useState with localStorage persistence

### Section 2: Valuation Scenarios
- Uses scenario from `useFinancialModel()` context
- Two tabs (Radix Tabs): "EBITDA Multiple" and "ARR Multiple"

**Tab A — EBITDA Multiple:**
- Editable number input for multiple (default 10x)
- Table: Year | EBITDA | Valuation (EBITDA × multiple) for 2025–2030
- Line chart showing valuation trajectory

**Tab B — ARR Multiple:**
- MRR computed from sub-product clients × tickets; ARR = MRR × 12
- Editable number input for ARR multiple (default 5x)
- Table + line chart same as above

**Output cards:** 3 cards showing Bear | Base | Bull valuation (apply scenario multipliers to the selected methodology's result)

**Implied valuation per share:** Total valuation / total shares from cap table

**Dilution Calculator (bottom):**
- Two inputs: "Raise amount (R$)" and "At valuation (R$)"
- Output: "Dilution %" = raise / (valuation + raise) × 100
- Post-money cap table preview: existing shareholders diluted proportionally + new investor row

## 3. Routing & Navigation Updates

**`src/components/layout/AppSidebar.tsx`:** Add Valuation item with `TrendingUp` icon between Debt and History.

**`src/App.tsx`:** Add `/valuation` route importing the new page.

## File Changes

| File | Action |
|------|--------|
| `src/pages/DebtFinance.tsx` | Rewrite — 3 categories + summary KPIs |
| `src/pages/Valuation.tsx` | New — Cap table + valuation scenarios + dilution calc |
| `src/components/layout/AppSidebar.tsx` | Edit — add Valuation nav item |
| `src/App.tsx` | Edit — add /valuation route |

## Implementation Order
1. Debt page restructure
2. Valuation page (cap table + scenarios + dilution)
3. Sidebar + routing updates

