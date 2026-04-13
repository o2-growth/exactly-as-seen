# Impact Analysis — Seed Elimination & "API is Authoritative"

**Investigator:** Dex (Full Stack Developer agent, INVESTIGATION mode)
**Date:** 2026-04-11
**Status:** Discovery only — NO code changes made
**Empirical source:** `src/test/engine/impactAnalysis.test.ts` (mocks `clientsBase2025` to all-zero arrays and re-runs `getMonthlyClients` + `computeFullModel` side-by-side).

---

## TL;DR

**Risk level: HIGH.**

Removing the seed without implementing the proposed replacement (real historical from API + interpolation) will:

1. **Wipe all 2025 numbers to zero.** Gross Revenue 2025 collapses from R$44.1M to R$0 in `computeFullModel`. The engine reads `clientsBase2025[bu][product][month]` directly for year 2025 — there is currently no API fallback in the engine.
2. **Cut 2026 Gross Revenue by ~32%** (R$120.0M → R$81.7M) because the engine derives the 2026 starting point (`getDecClients2025`) from the seed; with the seed zeroed it linearly interpolates from 0 to user target.
3. **Leave 2027–2030 IDENTICAL** because those years interpolate from `assumptions.subProductClients[prevYear]` which is user-controlled, not from the seed.

The validation system (`validateOutputs`) still emits 22 baseline deviation warnings (these are pre-existing — the user already noted them).

The proposed fix (use real API historical for 2025/2026, interpolate for 2027+) is the correct path. But it requires changes in the **engine** (not just `monthlyData.ts` and `Assumptions.tsx`), because the engine entirely bypasses `getMonthlyClients` and reads `clientsBase2025` directly via `getMonthlyClientCount` at `src/engine/calculationsEngine.ts:139-142` and `getDecClients2025` at `src/engine/calculationsEngine.ts:113-117`.

---

## 1. Code surface area — exact scope of changes

### Impact point 1 — `src/data/modelData.ts:7-36`
**Current code:**
```ts
export const clientsBase2025 = {
  caas: { assessoria: [0,0,0,6.37,9,...,58], enterprise: [...], ... },
  saas: { oxy: [...], oxyGenio: [...], setup: [...], parceiros: [...] },
  ...
};
```
**Proposed code:** delete the export entirely, OR keep but emptied to zeros (still need to update consumers).

**Downstream consumers:**
- `src/engine/calculationsEngine.ts:10` (import)
- `src/lib/monthlyData.ts:7` (import)
- `src/test/data/modelData.test.ts:7` (test)
- `src/test/engine/assumptionsPnlVerification.test.ts:25` (comment reference only)

---

### Impact point 2 — `src/engine/calculationsEngine.ts:113-117`
**Current code:**
```ts
function getDecClients2025(bu: string, product: string): number {
  const buData = (clientsBase2025 as any)[bu];
  if (!buData || !buData[product]) return 0;
  return buData[product][11] || 0;
}
```
**Proposed code:**
```ts
function getDecClients2025(subKey: SubProductKey, ticket: number): number {
  // Resolve from real historical revenue / ticket for 2025-12 (or last available)
  const mapping = HISTORICAL_REVENUE_MAP[subKey];
  if (!mapping) return 0;
  const rev = historicalRevenueItems[mapping.group]?.[mapping.item]?.['2025-12'] ?? 0;
  return ticket > 0 ? Math.round(rev / ticket) : 0;
}
```

**Downstream consumers:** `getMonthlyClientCount` at line 150 — drives ALL revenue calculation for years 2026+ (start point of YoY interpolation).

---

### Impact point 3 — `src/engine/calculationsEngine.ts:139-142`
**Current code:**
```ts
if (year === 2025) {
  const arr = (clientsBase2025 as any)[bu]?.[product];
  return arr ? arr[month] : 0;
}
```
**Proposed code:**
```ts
if (year === 2025 || year === 2026) {
  // Use real historical data from API for any month in HISTORICAL_PERIODS;
  // for projected months in 2026, interpolate from last historical month to user target.
  return getHistoricalOrProjected(subKey!, year, month, assumptions);
}
```

**Downstream consumers:** This is the heart of every revenue line in `calcMonthlyRevenue` (lines 177-208). Affects all P&L lines for 2025 and 2026.

---

### Impact point 4 — `src/engine/calculationsEngine.ts:10` (import)
**Current code:** `import { clientsBase2025, ... } from '@/data/modelData';`
**Proposed code:** drop `clientsBase2025` from the import list. Add `import { historicalRevenueItems } from '@/data/historicalData';` if not already.

**Downstream:** N/A (just an import).

---

### Impact point 5 — `src/lib/monthlyData.ts:64-87` (`SUB_PRODUCT_2025_DATA`)
**Current code:**
```ts
const SUB_PRODUCT_2025_DATA: Record<SubProductKey, number[]> = {
  caasAssessoria:   clientsBase2025.caas.assessoria,
  caasEnterprise:   clientsBase2025.caas.enterprise,
  ...
};
```
**Proposed code:** delete the entire constant.

**Downstream consumers:** lines 162-164 (year===2025 branch) and line 175 (`prevDec` fallback when no historical month found).

---

### Impact point 6 — `src/lib/monthlyData.ts:162-165`
**Current code:**
```ts
if (year === 2025) {
  // Use actual client base data for 2025 — never derive from ticket
  return applyOverrides([...SUB_PRODUCT_2025_DATA[key]]);
}
```
**Proposed code:**
```ts
if (year === 2025) {
  // Use real historical data from API. Months not in HISTORICAL_PERIODS → 0.
  const hist = getHistoricalClients(key, 2025, ticket);
  return applyOverrides(hist.map(v => v ?? 0));
}
```

**Downstream consumers:** All `getMonthlyClients(...)` callers — 22 call sites in `Assumptions.tsx` (lines 263, 287, 315, 340, 349, 356, 773, 875, 893, 911, 996, 1061, 1108, 1389, 1463, 1520, 1543, 1621, 1646, 1693, 1714, 1782, 2271, 2834, 2880).

---

### Impact point 7 — `src/lib/monthlyData.ts:175`
**Current code:**
```ts
const prevDec = lastHistIdx >= 0 ? (hist[lastHistIdx] ?? 0) : SUB_PRODUCT_2025_DATA[key][11];
```
**Proposed code:**
```ts
const prevDec = lastHistIdx >= 0 ? (hist[lastHistIdx] ?? 0) : 0;
```
(With seed gone, the fallback should be 0 — there is no historical data, so the only honest answer is "we don't know, start from zero".)

**Downstream:** changes the projection of 2026 Apr-Dec for products with no historical data (e.g. baas, education sub-products). Effect: starts the ramp from 0 instead of from the seed value.

---

### Impact point 8 — `src/lib/monthlyData.ts:7` (import)
**Current code:** `import { clientsBase2025, headcountRatios, namedEmployees2025, salaryRanges } from '@/data/modelData';`
**Proposed code:** drop `clientsBase2025` from the imports.

---

### Impact point 9 — `src/pages/Assumptions.tsx` — guard `decApi.client_count > 0` (8 places)

The user mentioned 7; I found **8** instances of the buggy guard:

| # | Line | Context |
|---|------|---------|
| 1 | 284 | `getActiveClientsArray` (caasParceiros branch — prevApi prev clients) |
| 2 | 312 | `getActiveClientsArray` (general month rollover) |
| 3 | 337 | `getActiveClientsArray` (year start active) |
| 4 | 772 | `getPrevDecActive` (the explicit dedicated helper) |
| 5 | 1517 | growth-table inline calc |
| 6 | 1618 | another growth-table inline calc |
| 7 | 1692 | drill-down "active clients" preview |
| 8 | 1713 | drill-down "active clients" projected preview |

**Current code (representative):**
```ts
if (decApi && decApi.client_count > 0) return decApi.client_count;
// fallback to engine seed
```
**Proposed code:**
```ts
if (decApi && isHistorical(prevYr, 11)) return decApi.client_count;
// API is authoritative — respect zero
```

**Downstream consumers:** the entire client-count display, growth-table, churn-table, and drill-down on the Assumptions page. None of these affect P&L (the engine never reads from these UI helpers).

---

## 2. Behavioral impact per PRODUCT × YEAR

### Method
- **Before:** `getMonthlyClients(key, year, DEFAULT_ASSUMPTIONS.subProductClients, DEFAULT_ASSUMPTIONS.tickets, {})[11]` (Dec value).
- **After:** Same call, with `clientsBase2025` mocked to all-zero arrays via `vi.doMock('@/data/modelData', ...)` and `vi.resetModules()`.

Numbers come from `IMPACT_BEFORE_JSON` and `IMPACT_AFTER_JSON` console output of `src/test/engine/impactAnalysis.test.ts`.

### Per-product Dec(year) — Before vs. After (sorted by absolute delta, top movers)

| Sub-product       | Year | Before (Dec) | After (Dec) | Delta    | % change |
|-------------------|------|--------------|-------------|----------|----------|
| saasSetup         | 2025 | 334          | 0           | -334     | -100%    |
| saasOxyGenio      | 2025 | 125.79       | 0           | -125.79  | -100%    |
| saasOxy           | 2025 | 99.99        | 0           | -99.99   | -100%    |
| caasEnterprise    | 2025 | 97.13        | 0           | -97.13   | -100%    |
| caasAssessoria    | 2025 | 58           | 0           | -58      | -100%    |
| educationDonoCFO  | 2025 | 49.17        | 0           | -49.17   | -100%    |
| caasSetup         | 2025 | 20           | 0           | -20      | -100%    |
| caasCorporate     | 2025 | 11.49        | 0           | -11.49   | -100%    |
| taxAT             | 2025 | 5            | 0           | -5       | -100%    |
| taxRCT            | 2025 | 3            | 0           | -3       | -100%    |
| taxGPT            | 2025 | 2            | 0           | -2       | -100%    |
| taxRT             | 2025 | 1            | 0           | -1       | -100%    |
| All other products| 2025 | 0            | 0           | 0        | 0%       |
| **All products**  | **2026–2030** | (same) | (same) | **0** | **0%** |

**Critical observation:** in `getMonthlyClients`, the only year that materially changes is **2025**. For 2026+, since the function geometrically interpolates Apr-Dec to the `currentDec` target (which is `subProductClients[key][year]` from `DEFAULT_ASSUMPTIONS`), the December value is fixed at the user target regardless of the seed. Mid-year months change subtly because the `prevDec` (seed) shifts from a positive value to 0, but Dec is identical.

So the `getMonthlyClients` impact is: **2025 only** (12 products affected).

### Engine `getMonthlyClientCount` × `calcMonthlyRevenue` → Annual revenue impact

This is the **real** P&L impact, because pages consume `computeFullModel` via context:

| Sub-product (annual revenue, R$ thousands) | Year | Before | After | Delta | % |
|-------------------------------------------|------|-------:|------:|------:|---:|
| saasSetup                                  | 2025 | (in saasRev) 33,055 total → ~5,010 of it | 0 | ~−5,010 | −100% |
| (See KPI table below — products are aggregated by BU in computeFullModel output; section 3 has the verifiable totals.) | | | | | |

The engine's `getMonthlyClientCount` does **not** call `getMonthlyClients`. It reads `clientsBase2025[bu][product][month]` directly for year 2025 (line 140-141) and uses `getDecClients2025` (line 150) for 2026 start. So the engine impact is concentrated in 2025 (full collapse) and 2026 (~32% drop). See section 3 for the dollar-level numbers.

---

## 3. KPI impact (P&L line items)

### Method
- **Before:** `computeFullModel(DEFAULT_ASSUMPTIONS, 'BASE')` with the unmocked `clientsBase2025`.
- **After:** Same call, with `clientsBase2025` mocked to all-zero arrays (via `vi.doMock` + `vi.resetModules` between describe blocks).

All values in **R$ thousands**, sourced from `IMPACT_BEFORE_JSON` / `IMPACT_AFTER_JSON`.

### 2025

| Line item    | Before  | After   | Delta    | % change |
|--------------|--------:|--------:|---------:|---------:|
| Gross Revenue| 44,119  | 0       | -44,119  | -100.0%  |
| Deductions   | -1,912  | 0       | +1,912   | -100.0%  |
| Net Revenue  | 42,207  | 0       | -42,207  | -100.0%  |
| COGS         | -4,116  | -696    | +3,420   | -83.1%   |
| Gross Profit | 38,091  | -696    | -38,787  | -101.8%  |
| EBITDA       | 26,329  | -4,295  | -30,624  | -116.3%  |
| Net Income   | 24,442  | -4,376  | -28,818  | -117.9%  |
| Total clients| 473     | 0       | -473     | -100.0%  |

### 2026

| Line item    | Before  | After   | Delta    | % change |
|--------------|--------:|--------:|---------:|---------:|
| Gross Revenue| 119,958 | 81,719  | -38,239  | -31.9%   |
| Deductions   | -5,079  | -3,447  | +1,632   | -32.1%   |
| Net Revenue  | 114,879 | 78,272  | -36,607  | -31.9%   |
| COGS         | -8,263  | -5,782  | +2,481   | -30.0%   |
| Gross Profit | 106,615 | 72,490  | -34,125  | -32.0%   |
| EBITDA       | 87,077  | 53,325  | -33,752  | -38.8%   |
| Net Income   | 82,314  | 50,107  | -32,207  | -39.1%   |
| Total clients| 889     | 889     | 0        | 0%       |

### 2027

| Line item    | Before  | After   | Delta | % change |
|--------------|--------:|--------:|------:|---------:|
| Gross Revenue| 314,733 | 314,733 | 0     | 0%       |
| Deductions   | -13,325 | -13,325 | 0     | 0%       |
| Net Revenue  | 301,407 | 301,407 | 0     | 0%       |
| COGS         | -17,648 | -17,648 | 0     | 0%       |
| Gross Profit | 283,760 | 283,760 | 0     | 0%       |
| EBITDA       | 225,860 | 225,860 | 0     | 0%       |
| Net Income   | 213,316 | 213,316 | 0     | 0%       |

### 2028

| Line item    | Before    | After     | Delta | % change |
|--------------|----------:|----------:|------:|---------:|
| Gross Revenue| 1,013,473 | 1,013,473 | 0     | 0%       |
| Net Revenue  | 971,127   | 971,127   | 0     | 0%       |
| Gross Profit | 921,217   | 921,217   | 0     | 0%       |
| EBITDA       | 719,075   | 719,075   | 0     | 0%       |
| Net Income   | 679,473   | 679,473   | 0     | 0%       |

### 2029

| Line item    | Before    | After     | Delta | % change |
|--------------|----------:|----------:|------:|---------:|
| Gross Revenue| 2,505,882 | 2,505,882 | 0     | 0%       |
| EBITDA       | 1,797,808 | 1,797,808 | 0     | 0%       |
| Net Income   | 1,702,423 | 1,702,423 | 0     | 0%       |

### 2030

| Line item    | Before    | After     | Delta | % change |
|--------------|----------:|----------:|------:|---------:|
| Gross Revenue| 4,915,544 | 4,915,544 | 0     | 0%       |
| EBITDA       | 3,558,613 | 3,558,613 | 0     | 0%       |
| Net Income   | 3,375,995 | 3,375,995 | 0     | 0%       |

### Aggregate impact 2025–2030

| Metric                        | Before (R$ thousand) | After (R$ thousand) | Delta       | % change |
|-------------------------------|---------------------:|--------------------:|------------:|---------:|
| **Σ Gross Revenue 2025–2030** | 8,913,709            | 8,831,371           | -82,358     | -0.92%   |
| **Σ EBITDA 2025–2030**        | 6,414,762            | 6,350,386           | -64,376     | -1.00%   |
| **Σ Net Income 2025–2030**    | 6,077,963            | 6,020,938           | -57,025     | -0.94%   |

The **total** impact across the 6-year window is small (~1%) because 2027–2030 dominate the totals and they are **unaffected**. The local impact on 2025–2026 is severe (100% loss for 2025, ~32% loss for 2026).

### What if the proposed full fix is applied (real historical from API)?

Using the historical API revenue (from `IMPACT_HIST_JSON`) gives the **realistic** "after" numbers for 2025 and 2026 once the full proposal is implemented (engine reads API):

| BU    | 2025 historical revenue (R$) | 2026 historical revenue (Q1 only — Jan-Mar) |
|-------|-----------------------------:|-------------------------------------------:|
| CaaS  | 7,000,533                    | 2,178,357                                  |
| SaaS  | 2,101,492                    | 719,604                                    |
| Education | 66,334                   | 0                                          |
| Expansão | 529,000                  | 158,000                                    |
| Tax | 108,247                    | 130,608                                    |
| **TOTAL 2025** | **R$9.81M** | (Q1 2026: R$3.19M) |

So a "fully implemented proposal" 2025 Gross Revenue would land around **R$9.8M** (very close to the legacy `expectedOutputs.grossRevenue[2025] = R$13.78M`, which itself is from Excel and assumes a more optimistic ramp). The current (seeded) value of R$44.1M is **4.5× higher than reality**. The user has a legitimate complaint.

---

## 4. Downstream consumer check

All pages below consume `useFinancialModel()` → `computeFullModel(...)` (memoized in `src/contexts/FinancialModelContext.tsx:216`). When the engine changes, **all** pages see the new numbers automatically.

| Page | File | Impact | Notes |
|------|------|--------|-------|
| Overview | `src/pages/Overview.tsx` | ✅ Will show changed values | KPI cards (Receita Bruta, EBITDA, Net Income), revenue chart. 2025 shows R$0 → looks broken until fix lands. Reads `assumptions.subProductClients.baas` directly at line 139 — unaffected by seed. |
| Assumptions | `src/pages/Assumptions.tsx` | ⚠️ Mixed: KPI strip ✅; client-count cells ⚠️ until guards fixed | The 22 `getMonthlyClients(...)` call sites all flow through `monthlyData.ts`. KPI strip uses `useFinancialModel()` (engine). The buggy `decApi.client_count > 0` guards (8 places) will keep falling back to seed UNTIL fixed — meaning Assumptions UI may show DIFFERENT numbers from Overview/PnL during the transition. |
| PnL | `src/pages/PnL.tsx` | ✅ Will show changed values | Full DRE (4-line revenue chain incl. Faturamento Base, Incremento, Churn). 2025 row will collapse to zeros. |
| CashFlow | `src/pages/CashFlow.tsx` | ✅ Will show changed values | Receivables change, operating cash flow — all derive from engine's `netIncome`. 2025 = R$0 → cash flow looks empty. |
| Valuation | `src/pages/Valuation.tsx` | ✅ Will show changed values | ARR, EBITDA multiples — uses `years[year].ebitda` and `revenueDetail`. 2025 EBITDA flips negative (-R$4,295k). Multiples collapse. |
| ClientsGrowth | `src/pages/ClientsGrowth.tsx` | ⚠️ Visual concern | If it reads `assumptions.subProductClients` directly → unaffected. If it goes through `getMonthlyClients` → 2025 row flatlines. Verify. |
| DebtFinance | `src/pages/DebtFinance.tsx` | ✅ Indirect | Debt schedule itself is hardcoded; only the "% of net income" or coverage ratios change (because net income changes). |
| VersionHistory | `src/pages/VersionHistory.tsx` | ⚠️ Cached snapshots | Existing saved versions may have been computed with seeds — viewing them post-fix may show inconsistent numbers vs. live recompute. |

### Components

- `src/components/overview/RuleOf40.tsx` — uses engine output. ✅ recalculates.
- `src/components/simulator/PlanejamentoTributario.tsx` — uses engine. ✅ recalculates.
- `src/components/layout/PeriodFilter.tsx` — display only.

### Critical: ❌ functional break

**None.** The engine returns valid (zero) numbers; nothing throws. But UI/UX-wise, the entire 2025 column going to zero is a "looks broken" event.

---

## 5. Risk assessment & hidden dependencies

### Tests that WILL break

The test file `src/test/data/modelData.test.ts` has 4 specific tests on `clientsBase2025`:

```ts
src/test/data/modelData.test.ts:14  CaaS has 4 product lines with 12 months each
src/test/data/modelData.test.ts:21  SaaS has product lines with 12 months
src/test/data/modelData.test.ts:26  client counts are non-negative
src/test/data/modelData.test.ts:32  enterprise clients grow through 2025
```

If `clientsBase2025` is **deleted**, these 4 tests will fail to compile (import error). If `clientsBase2025` is kept but emptied, tests 14/21 still pass (length 12), test 26 still passes (zeros are non-negative), test 32 will **fail** (`ent[11] > ent[0]` becomes `0 > 0` → false).

### Tests with hardcoded expected values that would now be wrong

`src/data/modelData.ts:417-425` — the `expectedOutputs` object:
```ts
grossRevenue: { 2025: 13777, 2026: 34250, 2027: 103707, 2028: 337072, 2029: 785967, 2030: 1460172 },
ebitda:       { 2025: 1360,  2026: 7136,  2027: 6605,   2028: 18606,  2029: 41855,  2030: 118380 },
totalClients: { 2025: 442,   2026: 1048,  2027: 5439,   2028: 23634,  2029: 66172,  2030: 143059 },
```
These are loaded by the engine at `validateOutputs` (lines 1061-1082) and emit warnings (already 22 baseline warnings). They will continue to be wrong but are NOT used in any test assertion that fails — only `console.warn`.

The validation tests in `src/test/engine/calculationsEngine.test.ts` use `expectedOutputs` with **15% tolerance** at line 43:
```ts
expectClose(model.years[year].grossRevenue, expectedOutputs.grossRevenue[year], 15);
```
After full fix, 2025 revenue (engine) drops from R$44.1M to ~R$9.8M (real historical). `expectedOutputs.grossRevenue[2025] = R$13.78M`. Deviation = (13.78 − 9.8)/13.78 ≈ 28.9% → **this test will fail**.

Similarly: `Vanilla scenario` test at line 64 uses 12% tolerance → also fails for 2025.

If the full fix lands without updating `expectedOutputs`, expect approximately **6 additional failures** in `calculationsEngine.test.ts` (one per YEAR for the 15% tolerance test, the 12% vanilla test, and possibly the gross-margin band test).

### `src/test/engine/assumptionsPnlVerification.test.ts:25`
Contains the comment `// 2025 uses clientsBase2025, not assumptions` — not load-bearing, just a comment that becomes outdated.

### `BASE_ANNUAL_DATA` in `src/lib/financialData.ts:727-734`
Hardcoded historical values (same as `expectedOutputs`). Used by `calculateProjections` (legacy projection function, line 787) — still referenced in some scenario displays. Not directly broken by seed removal, but shows the same legacy values.

### Export/import chain
- `clientsBase2025` is imported in 5 files (per Grep). Removing it requires updating all 5 imports.
- `SUB_PRODUCT_2025_DATA` is referenced in 3 places inside `monthlyData.ts` (definition + 2 uses). Trivial.
- `getDecClients2025` (engine line 113) is only called once (line 150). Refactor is contained.

### "Scary" / unexpected findings

1. **The engine bypasses `getMonthlyClients` entirely.** All previous mental models that "fixing `monthlyData.ts` will fix the dashboard" are wrong. The engine has its own duplicate logic in `getMonthlyClientCount` (line 119-160) and `getDecClients2025` (line 113-117). The proposed fix MUST touch the engine, not just `monthlyData.ts`.

2. **Two parallel client-count code paths exist:**
   - `monthlyData.ts::getMonthlyClients` (uses geometric interpolation from `getHistoricalClients`)
   - `calculationsEngine.ts::getMonthlyClientCount` (uses linear interpolation from seed Dec)
   These produce **different** numbers for the same product/month/year. After the fix they should be unified, otherwise Assumptions page will show different numbers from PnL/Overview.

3. **The 2026 starting point in the engine is the seed Dec value** (`getDecClients2025` line 150). Even if you replace the 2025 branch with API data, you still need to fix `getDecClients2025` separately or 2026 will start interpolating from R$0.

4. **`expectedOutputs.grossRevenue[2025] = R$13.78M`** — the legacy "expected" itself looks like a Lovable.dev chute. Real 2025 historical revenue (summed from API per BU) is ~**R$9.81M**. The expected output is ~40% higher than reality. If the user wants "every number traces to API or user input", `expectedOutputs` itself should be re-derived from the API and `BASE_ANNUAL_DATA` should follow.

5. **Saved version snapshots in `VersionHistory`** — if the user has saved versions before the fix, they'll show old (seeded) numbers. There's no migration path. Mention to user.

---

## Recommended fix order (NOT executing — for caller's reference)

1. **Engine first** — refactor `getDecClients2025` and `getMonthlyClientCount` to read from `historicalRevenueItems` for 2025 and historical months of 2026.
2. **Update `monthlyData.ts`** — drop `SUB_PRODUCT_2025_DATA`, route 2025 through `getHistoricalClients`.
3. **Fix the 8 buggy guards in `Assumptions.tsx`** — replace `decApi.client_count > 0` with `decApi && isHistorical(...)`.
4. **Drop `clientsBase2025`** from `modelData.ts` and clean up imports in 5 files.
5. **Update `src/test/data/modelData.test.ts`** — delete the 4 tests that target `clientsBase2025`.
6. **Update `expectedOutputs` and `BASE_ANNUAL_DATA`** to reflect new (real-API-derived) numbers — or accept the test warnings as informational.
7. **Communicate to user** about saved Version History snapshots being inconsistent.
