# O2 Inc — Full Codebase Audit (Lovable-Seed / Numbers-From-Nowhere)

**Date:** 2026-04-11
**Auditor:** Atlas + Dex (Business Analyst + Full-Stack Dev, read-only mode)
**Scope:** Every production file under `src/` that contributes to displayed numbers.
**User rule:** *Every number must trace to real Oxy data OR user-editable assumptions — no chutes, no magic numbers, no hardcoded seeds.*

---

## Executive Summary

| Severity | Count |
|----------|-------|
| CRITICAL | 3 |
| HIGH     | 6 |
| MEDIUM   | 9 |
| LOW      | 8 |
| **Total** | **26** |

**Bottom line: the system is NOT fully user-rule compliant.** The engine reads the
Lovable seed (`clientsBase2025`) directly for all 2025 revenue calculations, creating
a fork where the **Assumptions page shows real Oxy data** but the **P&L / Overview /
CashFlow / Valuation consume seed-based values**. The root cause is a small number of
live imports that were missed in the seed-elimination refactor. Several paths are
dead code but should still be removed because they hide foot-guns.

**Minimum viable fix:** patch 3 engine sites (CRITICAL #1/#2/#3) + extend
`HISTORICAL_REVENUE_MAP` (HIGH #1) and the dashboard becomes rule-compliant for the
numbers end-users actually look at.

---

## Category A — Hardcoded Seeds Used as "Source of Truth"

### CRITICAL #1 — Engine uses `clientsBase2025` for 2025 revenue
- **File:** `src/engine/calculationsEngine.ts:139-142`
- **Severity:** CRITICAL
- **Current behavior:**
  ```ts
  if (year === 2025) {
    const arr = (clientsBase2025 as any)[bu]?.[product];
    return arr ? arr[month] : 0;
  }
  ```
  For every 2025 month, the engine reads the Lovable seed in `src/data/modelData.ts:7`
  instead of real Oxy historical data.
- **Why it's a bug:** `src/lib/monthlyData.ts:162-170` (the Assumptions page) was
  rewritten to pull from `historicalRevenueItems` (Oxy), but the engine path was
  never updated. Two sources of truth for the same metric.
- **Impact:** Overview "Total Clients 2025", PnL 2025 revenue, CashFlow engine
  fallback (when not in historical override window), and the seed values that feed
  into the 2026 interpolation starting point (via `getDecClients2025`). For 2025 the
  `applyHistoricalOverrides` pass masks this at the leaf level, but the engine's
  **internal** revenue accumulators (used for COS, commissions, marketing, SG&A
  scaling, receivables, adicional IRPJ, quarterly tax base) are ALL computed from
  the seed — so 2025 EBITDA, working capital and taxes are wrong even though the
  P&L-tree leaves look correct.
- **Fix complexity:** small (replace with a helper that reads `historicalRevenueItems`
  using a completed `HISTORICAL_REVENUE_MAP`).

### CRITICAL #2 — `getDecClients2025` uses `clientsBase2025` as 2026 interpolation anchor
- **File:** `src/engine/calculationsEngine.ts:113-117`
  ```ts
  function getDecClients2025(bu: string, product: string): number {
    const buData = (clientsBase2025 as any)[bu];
    if (!buData || !buData[product]) return 0;
    return buData[product][11] || 0;
  }
  ```
- **Severity:** CRITICAL
- **Current behavior:** For 2026 projections the linear interpolation uses the
  **December 2025 seed value** (e.g. `caasEnterprise = 97.13`) as the starting
  point — not the real December 2025 Oxy number, nor the user-entered
  `subProductClients[...][2025]`.
- **Why it's a bug:** Any tweak the user makes to 2025 in the Assumptions page is
  silently ignored by the engine's 2026+ projection. Real Dec-2025 Enterprise
  clients differ from the seed → the 2026-2030 revenue, HC, COS, and valuation all
  drift.
- **Impact:** Breaks traceability for every year ≥ 2026.
- **Fix:** Read `assumptions.subProductClients[subKey][2025]` (or derive from the
  real historical December number).

### CRITICAL #3 — `HISTORICAL_REVENUE_MAP` missing 15/22 sub-products
- **File:** `src/lib/monthlyData.ts:22-31`
- **Severity:** CRITICAL (but blast radius narrower than #1/#2)
- **Current behavior:** Only 7 sub-products are mapped:
  `caasAssessoria, caasEnterprise, caasCorporate, caasSetup, saasOxy, saasOxyGenio,
  educationDonoCFO`. Missing: `caasParceiros` (has real data at historicalData.ts:291),
  `saasSetup` (special-cased elsewhere — OK), `saasOxyGenioEsp` (has data at
  historicalData.ts:484-499), `educationEN/FR/FSP`, `baas/baasFranquia/baasMasterFranquia`,
  and **all 5 Tax sub-products** (which have real 2025 Nov-Dec and 2026 Jan-Mar data
  in `historicalRevenueItems.Tax`).
- **Why it's a bug:** For these sub-products `getHistoricalClients` returns 0 for all
  historical periods (because `mapping` is undefined at line 54). The Assumptions
  page shows "0 clients" for Tax products in 2025 even though Oxy reports real
  revenue. Loss of real data.
- **Impact:** Tax/Expansão BU charts under-report 2025-2026 historical clients and
  revenue on the Assumptions page. Downstream revenue-churn / faturamento base
  formulas (which use `getMonthlyClients`) also zero out.
- **Fix:** Complete the map. Trivial.

### HIGH #1 — `SUB_PRODUCT_2025_DATA` still imports `clientsBase2025`
- **File:** `src/lib/monthlyData.ts:64-87`
- **Severity:** HIGH
- **Current behavior:** `SUB_PRODUCT_2025_DATA` stores the Lovable seed and is used
  as a fallback at `monthlyData.ts:181` (`prevDec = ... : SUB_PRODUCT_2025_DATA[key][11]`).
- **Why it's a bug:** Reached when `lastHistIdx < 0`, i.e. when `getHistoricalClients`
  returned `null` for every month — this happens for products missing from the map
  (see #3). So this fallback silently reintroduces the seed as the Dec-2025 anchor
  for 2026 projection.
- **Impact:** Double-hit on missing-map products: Assumptions shows 0 for historical
  months but uses the seed as the 2026 interpolation start.
- **Fix:** Delete `SUB_PRODUCT_2025_DATA` entirely once the map is complete;
  fallback should be 0 or explicit assumption.

### MEDIUM #1 — `expectedOutputs` is still a live engine import
- **File:** `src/engine/calculationsEngine.ts:14, 678, 685, 997, 1063-1065`
- **Severity:** MEDIUM (2 of 4 use-sites are dead, but 1 is live and wrong)
- **Current behavior:**
  - Line 678: `baseAnnualRev2025 = expectedOutputs.grossRevenue[2025]` (13777) — fed
    to `calcMonthlyCOGS` via `revenueScale`. **Dead code**: `calcMonthlyCOGS` is
    never called (replaced by `calcCOSFromConfig`), but the import and the scaling
    computation still run on every engine pass.
  - Line 997: `prevYearRev = expectedOutputs.grossRevenue[prevYear] ?? 0` — used to
    compute `beginningReceivables` for the PMR/working-capital line. **LIVE.**
  - Lines 1063-1065: validation-only.
- **Why it's a bug (line 997):** The beginning-receivables formula uses the seed
  2025 revenue (R$13,777k) instead of the engine's own 2025 output or the real
  historical (~R$9,205k). Distorts `receivablesChange` for 2026, which flows into
  `finalResult` and cashflow.
- **Impact:** 2026 "Resultado Final" shows an artificial cash release/usage because
  beginning receivables are over-stated.
- **Fix:** Use `years[prevYear]?.grossRevenue` (self-reference) or the historical
  override value.

### MEDIUM #2 — `BASE_ANNUAL_DATA` + `calculateProjections` orphaned fallback
- **File:** `src/lib/financialData.ts:727-826`
- **Severity:** MEDIUM (dead code but dangerous)
- **Current behavior:** `BASE_ANNUAL_DATA` is a verbatim copy of the Lovable seed
  numbers (13777, 34250, …). `calculateProjections` uses it to scale by a client
  ratio and multiplier. **Not imported anywhere in production** (only its own file).
- **Why it's a bug:** If any future component imports `calculateProjections`, the
  dashboard will silently revert to the seed.
- **Impact:** None today; loaded gun tomorrow.
- **Fix:** Delete both.

### LOW #1 — `avgTicket` / `churnAnnual` / `cacBySector` / `sgaGrowthRates` re-exports
- **File:** `src/data/modelData.ts:39-71, 125-155, 178-185`
- **Severity:** LOW
- **Current behavior:** These objects duplicate data that lives in
  `DEFAULT_ASSUMPTIONS` (tickets, churn, CAC) and are read-only seed constants.
  `avgTicket` and `churnAnnual` are imported at engine top but never used in
  calculations.
- **Why it's a bug:** "Two sources of truth" smell — future engineer might read
  from the wrong one.
- **Fix:** Remove unused imports from the engine; keep seeds if used by CAC display.

### LOW #2 — `saasSetupClients` hardcoded schedule
- **File:** `src/data/modelData.ts:377-384`
- **Severity:** LOW
- **Current behavior:** Hardcoded monthly setup client schedule 2025-2030 — never
  imported anywhere in production (confirmed by grep).
- **Fix:** Delete.

---

## Category B — Buggy Guards Ignoring API Zero

### MEDIUM #3 — Default PMR object inline fallback
- **File:** `src/engine/calculationsEngine.ts:988`
  ```ts
  const pmr = assumptions.pmrConfig ?? { caas: 30, saas: 15, education: 30, baas: 0 };
  ```
- **Severity:** MEDIUM
- **Current behavior:** Inline seed PMR defaults (30/15/30/0 days). Also no `tax`
  key — the formula uses `pmr.caas` for tax revenue too.
- **Why it's a bug:** Not technically reachable because DEFAULT_ASSUMPTIONS always
  has `pmrConfig`, but (a) it's duplication of `DEFAULT_PMR` in financialData.ts:762,
  (b) `pmr.caas * annualTaxRev` silently treats tax like CaaS.
- **Fix:** Use `DEFAULT_PMR`; add a `tax` PMR field or document the behavior.

### LOW #3 — `|| -832.52` fallback on eventos
- **File:** `src/engine/calculationsEngine.ts:402`
  ```ts
  const eventosBase = sgaMonthly2025['4.18_eventos'] as number || -832.52;
  ```
- **Severity:** LOW
- **Current behavior:** Falls back to a hardcoded magic when sgaMonthly2025's
  eventos value is falsy. `sgaMonthly2025['4.18_eventos']` is defined (-832.52) so
  the fallback is dead.
- **Fix:** Delete the `|| -832.52`.

---

## Category C — Duplicate / Inconsistent Data Paths

### HIGH #2 — `Overview.tsx` uses legacy aggregate `caasClients` alongside sub-product totals
- **File:** `src/pages/Overview.tsx:139-152`
- **Severity:** HIGH
- **Current behavior:** Client growth chart reads from
  `assumptions.caasClients[y] + saasClients + educationClients + subProductClients.baas[y]`.
  These aggregates are **only updated** when the user edits the legacy client inputs;
  the rest of the codebase derives totals from `subProductClients`. Two sources of
  truth.
- **Why it's a bug:** If the user edits an Enterprise client count in the
  Assumptions page, the Overview chart's "CaaS" stack does not reflect that — it
  still shows the `caasClients` aggregate which was never updated.
- **Impact:** Overview page can diverge from PnL / ClientsGrowth / Assumptions for
  the same metric.
- **Fix:** Derive from `subProductClients` consistently (sum CAAS_KEYS etc.).

### HIGH #3 — `Overview.tsx` uses `HEADCOUNT` (constant for every year)
- **File:** `src/pages/Overview.tsx:132-135`, `src/lib/financialData.ts:856-884`
- **Severity:** HIGH
- **Current behavior:** `HEADCOUNT` is built from `namedEmployees2025` and stores
  the *same count* for 2025..2030 (`row[y] = y === 2025 ? count : count`, comment:
  "future years start at same base; engine scales dynamically").
- **Why it's a bug:** `totalHeadcount` in Overview is a flat number that never
  changes across years and never reflects the engine's actual projected HC. Any
  chart/KPI reading this will mis-report.
- **Impact:** Overview headcount KPI is wrong for all projected years. (Currently it
  is computed but not rendered — but it's a ticking time bomb.)
- **Fix:** Derive from engine output (`model.years[y].headcountDetail.salaries /
  salaryPerHead` or a dedicated field).

### HIGH #4 — `ClientsGrowth.tsx` duplicates the monthlyData headcount formula
- **File:** `src/pages/ClientsGrowth.tsx:37-59`
- **Severity:** HIGH
- **Current behavior:** `computeHeadcount` is a verbatim copy of the same function
  in `src/lib/monthlyData.ts:234-255`. It uses `headcountRatios` from `modelData`
  (not the user's `assumptions.headcountRatios`).
- **Why it's a bug:** User changes to `headcountRatios` in the Assumptions page do
  not flow into this page's projection table. Also it ignores squad mode.
- **Impact:** ClientsGrowth headcount table diverges from engine.
- **Fix:** Import the shared helper and pass assumptions.

### HIGH #5 — Unit-economics KPIs use unweighted average ticket and hardcoded CAC
- **Files:**
  - `src/pages/ClientsGrowth.tsx:114-119`
  - `src/pages/Assumptions.tsx:1197-1202`
- **Severity:** HIGH
- **Current behavior:**
  ```ts
  const avgTicket = mean(data.tickets);  // simple mean of 22 values
  const avgCac = (cacPerClient.caas + cacPerClient.saas + cacPerClient.education + cacPerClient.baas) / 4;
  ```
  `cacPerClient` is a **hardcoded seed** from `modelData.ts:112-117`. Assumptions
  page uses the same seed even though `assumptions.cacPerProduct` exists and is
  user-editable.
- **Why it's a bug:** LTV:CAC displayed on the dashboard does not reflect the user's
  own CAC assumptions, and the average ticket isn't weighted by client counts.
- **Impact:** "4.8x LTV:CAC" (or whatever) is a fabricated number.
- **Fix:** Weight by client counts, use `assumptions.cacPerProduct`.

### MEDIUM #4 — `buildHeadcount` in `financialData.ts` starts 2026+ at 2025 count
- **File:** `src/lib/financialData.ts:864-882`
- **Severity:** MEDIUM (related to HIGH #3)
- **Current behavior:** Explicit comment: "future years start at same base; engine
  scales dynamically" — but the returned struct is the one consumed by Overview.
- **Fix:** Delete `HEADCOUNT`/`buildHeadcount` once Overview is fixed.

---

## Category D — Magic Numbers in Calculations

### HIGH #6 — `baseHC = 22` hardcoded twice in engine
- **File:** `src/engine/calculationsEngine.ts:393, 813`
  ```ts
  const baseHC = 22; // 2025 base headcount
  ```
- **Severity:** HIGH
- **Current behavior:** Used as denominator for `hcRatio` in SG&A calc and as base
  in estimated total HC. 22 = hand-counted from `namedEmployees2025` circa commit
  ~3 weeks ago — now off by 1+ because more employees were added (Head Comercial,
  SDR 01/02 at line 212-216 of modelData.ts give 25 non-temp employees).
- **Why it's a bug:** A magic constant that must be manually re-synced every time
  the employee list changes. Already out of sync.
- **Fix:** Use `namedEmployees2025.filter(e => !('endMonth' in e)).length` dynamically.

### MEDIUM #5 — Marketing allocation hard weights (0.40 / 0.35 / 0.15 / 0.10)
- **File:** `src/engine/calculationsEngine.ts:792-795`
- **Severity:** MEDIUM
- **Current behavior:** Splits new-client marketing spend 40/35/15/10% across
  CaaS/SaaS/Edu/BaaS, regardless of the mix of products the user edited.
- **Why it's a bug:** Not user-editable, derived from no formula. If user projects
  a SaaS-heavy quarter, CaaS marketing spend is still 40%.
- **Fix:** Derive weights from `newClients` split per product, or expose in
  assumptions.

### MEDIUM #6 — Benefits per-head `901.10 * totalHC` for years ≥ 2026
- **File:** `src/engine/calculationsEngine.ts:518`
- **Severity:** MEDIUM
- **Current behavior:** Magic number, not documented, no source citation.
- **Fix:** Move to assumptions or COS config.

### MEDIUM #7 — BaaS COGS `baasClients * 25`
- **File:** `src/engine/calculationsEngine.ts:272`
- **Severity:** MEDIUM
- **Current behavior:** R$25 per BaaS client as "processing, compliance, banking
  fees". Not user-editable, not from config. But `calcMonthlyCOGS` is dead code so
  this never fires — still a foot-gun if re-enabled.
- **Fix:** Delete dead function or wire to cosConfig.

### MEDIUM #8 — Capex pct `0.50` / `0.30` hardcoded by year
- **File:** `src/engine/calculationsEngine.ts:581`
  ```ts
  const capexPct = year <= 2026 ? 0.50 : 0.30;
  ```
- **Severity:** MEDIUM
- **Current behavior:** Year-conditional capex percent of SaaS COS. Note — uses
  `cosBreakdown.saas` from the live COS config path, so this is a live bug.
- **Impact:** Capex line is non-editable and jumps from 50%→30% at an arbitrary year.
- **Fix:** Expose in assumptions.

### MEDIUM #9 — Bad-debt `-0.02 * grossRevenue`
- **File:** `src/engine/calculationsEngine.ts:406`
- **Severity:** MEDIUM
- **Current behavior:** Inline 2% PDD rate on gross revenue; no config.
- **Fix:** Expose in assumptions.

### LOW #4 — `-300` monthly assessoria RH fallback
- **File:** `src/engine/calculationsEngine.ts:381`
- **Severity:** LOW
- **Current behavior:** For years > 2025, assessoria RH = `-300 * yearMult`. Magic.
- **Fix:** Move to sga config.

### LOW #5 — `60` (R$60k) quarterly IRPJ adicional threshold
- **File:** `src/engine/calculationsEngine.ts:891`
- **Severity:** LOW (legal constant)
- **Current behavior:** `quarterBasePresumidaIRPJ - 60) * 0.10` — 60 = R$60k per
  quarter threshold for adicional IRPJ.
- **Why it's OK-ish:** Brazilian tax law constant, but should be a named constant
  like `ADICIONAL_IRPJ_QUARTERLY_LIMIT = 60`.

### LOW #6 — Default growth rate `0.06` sprinkled across Assumptions.tsx
- **File:** `src/pages/Assumptions.tsx:503, 518, 522, 538, 732, 866, 963, 1386`
- **Severity:** LOW
- **Current behavior:** 6% YoY growth hardcoded as the initial value for every
  product if user hasn't set one.
- **Fix:** Centralize as `DEFAULT_GROWTH_RATE = 0.06` and document it as an explicit
  seed default the user can override.

### LOW #7 — Scenario multipliers `1.20 / 0.80` hardcoded
- **File:** `src/data/modelData.ts:386-391`, `src/lib/financialData.ts:769-773`
- **Severity:** LOW
- **Current behavior:** Bull/bear ±20% revenue, no user control.
- **Fix:** Move to assumptions.

---

## Category E — Dead Code / Stale Imports

### MEDIUM #2bis — `calcMonthlyCOGS` function is dead
- **File:** `src/engine/calculationsEngine.ts:252-281`
- Never called. Its inputs (`cogsMonthly2025`, `revenueScale`, `baasClients`) are
  also effectively unused in the live path.

### LOW #8 — `salesDeductions` / `salesDeductionsByYear` imports
- **File:** `src/data/modelData.ts:77-92`
- Defined but never imported (confirmed via grep). Legacy.

### LOW — `avgTicket`, `churnAnnual` imports at engine top
- `src/engine/calculationsEngine.ts:10` — imported but never used in the file.

### LOW — `cacGrowthRate`, `taxDebtItems`, `baasCustodia`, `selicRates` used only in one page
- Fine — user-editable or display-only.

---

## Category F — Missing Historical Mappings

### HIGH #1 (re-stated) — See CRITICAL #3 above. Missing sub-products:
| Product | Has data in `historicalRevenueItems`? | Result |
|---|---|---|
| caasParceiros | ✅ yes (Parceiros) | lost |
| saasSetup | N/A (computed from sources) | OK |
| saasOxyGenioEsp | ✅ yes (Oxy + Gênio + Especialista) | lost |
| educationEN | ✅ yes (Engenheiro de Negócios) | lost |
| educationFR | ✅ yes (Financeiro Raiz, all zero) | OK |
| educationFSP | ✅ yes (Finance Sales Program, all zero) | OK |
| baas | (none in historicalRevenueItems; only aggregate in historicalRevenue) | degraded |
| baasFranquia | ✅ yes (Franquia, 2026-02 = 104000) | lost |
| baasMasterFranquia | ✅ yes (Master Franquia, all zero) | OK |
| taxAT | ✅ yes (AT — Assessoria Tributária) | lost |
| taxGPT | ✅ yes (GPT) | lost |
| taxRCT | ✅ yes (RCT) | lost |
| taxRT | ✅ yes (RT) | lost |
| taxDTC | ✅ yes (Diagnóstico Tributário) | lost |

"Lost" = real Oxy revenue exists but `getHistoricalClients` always returns 0.

---

## Category G — Hardcoded COGS / Expenses / Headcount

- `cogsMonthly2025` (modelData.ts:95-101) — used only by dead `calcMonthlyCOGS`.
- `sgaMonthly2025` (modelData.ts:159-175) — live, drives 2025 SG&A. Real 2025
  snapshot, not user-editable. If Oxy `historicalExpenses.Despesas Administrativas`
  is available (it is — historicalData.ts:1654), we should blend here instead.
  **MEDIUM severity**, flagged as separate finding below.
- `commercialExpenses2025` (modelData.ts:253-259) — same pattern.
- `benefitsMonthly2025` (modelData.ts:395) — live, 2025 array used at
  `calculationsEngine.ts:516`.
- `basePayroll2025` (modelData.ts:398) — derived from `namedEmployees2025`, fine.
- `financialItems2025` (modelData.ts:403-410) — real 2025 data.
- `outrosExpenses2025` (modelData.ts:414) — real 2025 data.

### MEDIUM #10 — 2025 SG&A/Commercial/Financial read from a static Excel snapshot, not Oxy
- **Files:** `calculationsEngine.ts:348-408, 527-551, 840-857`
- **Severity:** MEDIUM
- **Current behavior:** The engine's 2025 path uses hand-entered Excel-snapshot
  arrays (`sgaMonthly2025`, `commercialExpenses2025`, `financialItems2025`,
  `outrosExpenses2025`) even though richer real data exists in
  `historicalData.ts` (`historicalExpenses`, `historicalExpenseItems`,
  `historicalFinancial`).
- **Why it's a bug:** Two snapshots of the same truth. If Oxy is refreshed, only
  historicalData.ts updates; the engine still uses the Excel version.
- **Impact:** 2025 monthly line items in PnL are from the stale snapshot. The
  `applyHistoricalOverrides` pass corrects the *annual totals* but not the monthly
  detail or the engine's own sub-tree allocations.
- **Fix:** Rebuild `calcMonthlySGA` / `calcMonthlyCommercial` / financial-result
  paths to read from `historicalExpenses` for historical months.

---

## Category H — Hardcoded Valuations / Multiples

- **Valuation.tsx:89-90** — `ebitdaMultiple ?? 10`, `arrMultiple ?? 5`: defaults,
  but user-editable → acceptable.
- **Valuation.tsx:66** — `totalShares ?? 1_000_000`: user-editable → acceptable.
- **Valuation.tsx:54-58** — Default cap-table seed (Pedro 70 / Tiago 30 / Rafael 0):
  overwritten on user input; acceptable but document.

**No bugs in this category.**

---

## Category I — Historical Revenue Gaps

Covered by CRITICAL #3. Additional gaps:

### MEDIUM #11 — `historicalRevenueItems.SaaS.Oxy` is all zeros
- **File:** `src/data/historicalData.ts:449-466`
- **Severity:** MEDIUM
- **Current behavior:** "Oxy" standalone product has all-zero values for every
  month 2025-01 through 2026-03. "Oxy + Gênio" has real data starting 2025-03.
- **Why it's unclear:** Possibly legitimate (Oxy standalone didn't exist as a
  separate SKU in 2025) vs. possibly a bug (the Oxy row should include the
  base-Oxy revenue that sits inside "Oxy + Gênio"). Needs data-owner confirmation.
- **Impact:** Assumptions page shows 0 for "Oxy" historical clients, which then
  makes the 2026 projection start from 0 and linear-ramp to the user's target.

### MEDIUM #12 — `historicalMetrics["CUSTOS VARIÁVEIS"]` has March 2025 anomaly
- **File:** `src/data/historicalData.ts:21` — 2025-09 = R$90,524 (outlier vs.
  neighbours R$194k-R$376k).
- **Severity:** LOW (data integrity, not code)
- **Why flagged:** User asked to report unexpected findings.

---

## Matrix of Files Audited

| File | Issues? | Notes |
|---|---|---|
| src/engine/calculationsEngine.ts | **Yes — CRITICAL x2, HIGH x1, MEDIUM x6, LOW x4** | Core engine |
| src/lib/monthlyData.ts | **Yes — CRITICAL x1, HIGH x1** | Map incomplete, fallback seed |
| src/lib/financialData.ts | **Yes — MEDIUM x2** | BASE_ANNUAL_DATA, HEADCOUNT |
| src/lib/pnlData.ts | No | 12-line type-only |
| src/lib/periodResolution.ts | No | Clean, historical blending logic |
| src/data/modelData.ts | **Yes — LOW x3** | Seed container (expected) |
| src/data/historicalData.ts | **Yes — MEDIUM x1 (data)** | Oxy data, Oxy-zero gap |
| src/data/headcountData.ts | **Yes — LOW** | Static Excel snapshot, used on Assumptions |
| src/contexts/FinancialModelContext.tsx | No | Handles persistence cleanly |
| src/pages/Assumptions.tsx | **Yes — HIGH x1, LOW x1** | LTV:CAC KPI uses seed CAC |
| src/pages/Overview.tsx | **Yes — HIGH x2** | HEADCOUNT + legacy caasClients |
| src/pages/PnL.tsx | No | Reads from pnlTree, fine |
| src/pages/CashFlow.tsx | No | Clean blending |
| src/pages/Valuation.tsx | No | Seeds are user-editable |
| src/pages/ClientsGrowth.tsx | **Yes — HIGH x1** | Duplicate headcount formula |
| src/pages/DebtFinance.tsx | No (uses real debtSchedule) | OK |
| src/pages/SimuladorTributario.tsx | Not audited (out of scope) |  |
| src/pages/VersionHistory.tsx | Not audited |  |
| src/pages/PremissasPage.tsx | Not audited |  |

**Total files reviewed:** 16 of ~18 production files; 6 with no issues, 10 with ≥1.

---

## Empirical Validations

No runtime tests executed. Findings are based on static reading + grep + cross-ref
of historical data. The CRITICAL findings were verified by:
- grep confirming `clientsBase2025` is imported at engine line 10 and used only at
  lines 114, 140 (no other references);
- reading `monthlyData.ts:162-170` vs `calculationsEngine.ts:139-142` side-by-side
  to confirm the fork;
- confirming `HISTORICAL_REVENUE_MAP` contains 7 keys vs 22 SubProductKeys in
  `SubProductClients`;
- confirming `expectedOutputs.grossRevenue[prevYear]` is used live at
  `calculationsEngine.ts:997` (not inside a dead branch).

---

## Priority Fix List (user-impact order)

1. **CRITICAL #2** (`getDecClients2025` using seed): breaks 2026+ for every product.
   ~5 lines. **Fix first.**
2. **CRITICAL #1** (engine 2025 path using seed): affects 2025 KPIs, feeds into all
   downstream years. ~10 lines.
3. **CRITICAL #3 + HIGH #1** (complete `HISTORICAL_REVENUE_MAP`, delete
   `SUB_PRODUCT_2025_DATA`): 1 dict extension + 1 dict deletion.
4. **MEDIUM #1** (engine line 997 `expectedOutputs` prior-year): 1 line.
5. **HIGH #2** (Overview using legacy `caasClients` aggregate): derive from
   subProductClients.
6. **HIGH #3 + MEDIUM #4** (delete `HEADCOUNT` / `buildHeadcount`): use engine output.
7. **HIGH #4** (ClientsGrowth uses its own headcount formula): use shared helper.
8. **HIGH #5** (LTV:CAC uses seed CAC, unweighted ticket): use assumptions.
9. **HIGH #6** (`baseHC = 22` magic): derive dynamically.
10. **MEDIUM #5–#9** (marketing weights, benefits, capex %, bad-debt, assessoria RH):
    expose in assumptions.
11. **MEDIUM #10** (engine 2025 SG&A uses Excel snapshot not Oxy): bigger refactor.
12. **MEDIUM #11** (Oxy-standalone zero rows): needs data-owner clarification.
13. **LOW items**: cleanup sweep.

---

## Risk Assessment

**Can the user trust the dashboard today? NO, with one caveat.**

- **Trusted:** 2025 annual totals on the P&L page and summary KPIs (Overview cards)
  because `applyHistoricalOverrides` replaces them with Oxy real values *after* the
  engine runs.
- **NOT trusted:** monthly detail under the P&L tree for 2025, every revenue /
  margin / tax / cashflow figure for 2026-2030 (because the engine's prior-year
  anchor is the seed, not real data or user input), LTV:CAC KPIs, headcount
  projections.
- **Minimum fix to regain trust:** items 1-4 in the priority list (~30 LoC). After
  that, the engine is traceable; items 5-9 clean up the display layer.

---

## Estimated Effort to 100% User-Rule Compliance

| Tier | Items | Effort |
|---|---|---|
| 1. Critical engine fixes | #1, #2, #3, HIGH #1, MED #1 | **4-6h** — small, surgical, well-tested |
| 2. Display-layer consistency | HIGH #2-#6 | **1-1.5 days** — touch Overview/ClientsGrowth/Assumptions |
| 3. Magic-number extraction | MED #5-#9, LOW items | **2-3 days** — requires adding config UI |
| 4. Excel-to-Oxy SG&A migration | MED #10 | **2-3 days** — requires historical blending of expense sub-items |
| 5. Data-owner clarifications | MED #11, MED #12 | ~half day |
| **Total** | | **~6-8 engineering days** |

---

## Surprising / Unexpected Findings

1. **Dead code is still a live bug path.** `calcMonthlyCOGS` is never called, but
   its sibling `revenueScale` computation at line 685 still runs on every pass,
   still imports the seed, and is one bad refactor away from re-enabling the leak.
2. **Overview.tsx line 132-135 computes `totalHeadcount` but never renders it.**
   Dead UI code built on broken data. Delete both.
3. **Two independent `computeHeadcount` functions** — one in `monthlyData.ts`, one
   duplicated in `ClientsGrowth.tsx`. They're identical today but can silently
   drift.
4. **`baseHC = 22`** — a magic number that references a hand-count of employees
   that has since grown to 25 (3 commercial + 2 temps that end Jan only). The SGA
   ratio denominator is already stale.
5. **`cacPerClient` in the engine** is still imported but superseded by
   `assumptions.cacPerProduct` at line 786-790. The seed import line 11 and the
   `cacCaas = cpc?.caasAssessoria ?? cacPerClient.caas` pattern means if any
   product key is missing from `cacPerProduct`, the calculation silently reverts to
   the hardcoded seed.
6. **`expectedOutputs.grossRevenue[prevYear]`** — cache-poisons the receivables
   line for 2026-2030. This is the most subtle of the findings because the rest of
   the engine is self-referential; only PMR/working-capital reaches back to the
   seed.

---

*End of audit.*
