# Product Enhancement PRD — O2 Inc Financial Dashboard

**Version:** 1.0
**Date:** 2026-04-03
**Author:** Morgan (PM Agent)
**Status:** Active
**Inputs:** Brownfield Assessment (Atlas), Architecture Review (Aria), Database Audit (Dara), Bug-fix session log

---

## Vision

Transform the O2 Inc Financial Dashboard from a functional prototype (maintainability score 6.5/10) into a production-grade, secure, and extensible financial modeling platform that CFOs and analysts can trust with sensitive data and depend on for accurate projections across 5 business units and 15+ sub-products.

---

## Current State Summary

### What Was Found

Three audits revealed a React/Vite/Supabase single-page application with solid domain coverage (multi-BU revenue modeling, P&L tree, valuation, scenario management) but significant gaps in security, type safety, test coverage, and component modularity. The Assumptions page alone is 2,425 lines / 137KB. TypeScript runs with `strictNullChecks: false` and `noImplicitAny: false`. A dev-only RLS policy grants anonymous users full read/write access to all snapshots. Two edge functions are vulnerable to SQL injection.

### What Was Fixed (This Session)

| Area | Issue | Resolution |
|------|-------|------------|
| Persistence | editState/assumptions dual-state caused data loss on save | Unified state; Supabase table created; race condition in debounce fixed; INSERT replaced with UPDATE |
| Auto-apply | Growth %, ticket growth %, churn growth % required manual "Aplicar" button | Now auto-apply on blur |
| Labels | Ambiguous labels (% vs % a.m.) | Clarified with proper suffixes |
| Churn base | Replicated to historical months incorrectly | Now respects `isHistorical()` |
| Manual edits | "Aplicar" overwrote manual cell edits | Now preserves `manualFlags` |
| Stale closures | `setAssumptions` captured stale state | All updaters converted to functional form |
| Edit mode | Separate edit button was confusing | Removed; always editable with auto-save |
| Annual totals | Table showed December target instead of annual sum | Corrected to annual sum |
| Flat clients | Missing "Clientes base (flat)" row | Added |
| Engine inputs | sgaGrowthRate, headcountGrowth, headcountRatios, salaryRanges disconnected | Engine now reads from assumptions |

### What Remains

Security vulnerabilities (RLS, SQL injection, hardcoded keys), low test coverage (~10%), monolithic components, loose TypeScript settings, no error boundaries, no offline resilience, and performance bottlenecks from full-model recalculation on every edit.

---

## Enhancement Epics

### E-001 — Persistence & Data Integrity Fixes

- **Priority:** P0 (critical)
- **Impact:** Eliminates data loss — users can trust that edits are saved
- **Effort:** M
- **Status:** Done

**Stories (completed):**
1. Unify editState and assumptions into single source of truth
2. Create `assumptions_snapshots` table in Supabase with proper schema
3. Fix race condition in debounce — ensure last write wins consistently
4. Replace INSERT with UPDATE (upsert) for existing snapshots
5. Convert all `setAssumptions` calls to functional updater pattern (stale closure fix)
6. Implement localStorage-first write with async Supabase sync

**Success Metrics:**
- Zero data-loss reports after save operations
- Supabase and localStorage remain in sync after 100 consecutive rapid edits

---

### E-002 — Engine Connectivity & Calculation Accuracy

- **Priority:** P0 (critical)
- **Impact:** Financial projections reflect user inputs instead of ignoring them
- **Effort:** M
- **Status:** Done

**Stories (completed):**
1. Connect `sgaGrowthRate` from assumptions to engine SG&A calculations
2. Connect `headcountGrowth`, `headcountRatios`, `salaryRanges` to engine headcount model
3. Fix annual totals row to show sum instead of December value
4. Add "Clientes base (flat)" row to client projections
5. Make churn base respect `isHistorical()` — no replication into historical months
6. Preserve `manualFlags` when "Aplicar" runs — never overwrite user cell edits

**Success Metrics:**
- Changing any assumption field produces a corresponding change in P&L output within 1 render cycle
- Annual row matches sum of 12 monthly values for all line items

---

### E-003 — UX: Auto-Apply & Edit Mode Simplification

- **Priority:** P1 (high)
- **Impact:** Reduces friction — users no longer lose context switching between view/edit modes
- **Effort:** S
- **Status:** Done

**Stories (completed):**
1. Remove edit/view toggle button — all cells always editable
2. Implement auto-save on blur with 2-second debounce to Supabase
3. Auto-apply growth %, ticket growth %, and churn growth % on blur (remove "Aplicar" button)
4. Clarify labels: distinguish "% a.m." (monthly rate) from "%" (absolute percentage)

**Success Metrics:**
- Time from edit to persisted save < 3 seconds
- Zero user-reported confusion about when data is saved

---

### E-004 — Security Hardening

- **Priority:** P0 (critical)
- **Impact:** Prevents unauthorized data access and SQL injection attacks in production
- **Effort:** M
- **Status:** Planned

**Stories:**
1. **Remove anon RLS policy** — Drop `"Anon can do everything (dev only)"` policy; create proper user-scoped policies: `SELECT/UPDATE/DELETE WHERE auth.uid() = user_id`, `INSERT WHERE auth.uid() = user_id`
2. **Fix SQL injection in edge functions** — Replace template literals with parameterized queries (`$1`, `$2`) in `fetch-dre-data` and `explore-dre-db`; validate table names against a whitelist
3. **Disable `explore-dre-db` in production** — Either gate behind admin role check or remove the function entirely from deployed environment
4. **Enable JWT verification on all edge functions** — Set `verify_jwt = true` in each function's `config.toml`
5. **Restrict CORS** — Replace `Access-Control-Allow-Origin: *` with the O2 application domain
6. **Remove hardcoded Supabase keys from source** — Delete fallback keys in `supabase-safe.ts`; require environment variables exclusively
7. **Migrate DRE database credentials** — Move from shared env vars to Supabase Secrets
8. **Sanitize custom labels** — Escape user-provided COA labels in PnL.tsx to prevent stored XSS
9. **Add session timeout** — Implement idle session expiration (e.g., 30 minutes)

**Success Metrics:**
- Zero CRITICAL or HIGH findings in a follow-up security audit
- All edge functions reject unauthenticated requests (401)
- Penetration test confirms no SQL injection vectors

---

### E-005 — TypeScript Strict Mode Upgrade

- **Priority:** P1 (high)
- **Impact:** Prevents entire classes of runtime bugs (null reference, implicit any); improves IDE support and refactoring confidence
- **Effort:** L
- **Status:** Planned

**Stories:**
1. Enable `strictNullChecks` in `tsconfig.json` and fix all resulting errors (estimate: 200-400 fixes)
2. Enable `noImplicitAny` and type all untyped parameters/variables
3. Enable `strictFunctionTypes` and `strictPropertyInitialization`
4. Add `strict: true` to tsconfig and verify zero regressions
5. Add `typescript-eslint/strict` ruleset to ESLint config
6. Document type conventions in a `CONTRIBUTING.md` section

**Success Metrics:**
- `npm run typecheck` passes with `strict: true`
- Zero `any` types in engine and context files
- CI blocks PRs that introduce new `any` types

---

### E-006 — Component Decomposition

- **Priority:** P1 (high)
- **Impact:** Enables parallel development, faster page loads, and testable units
- **Effort:** L
- **Status:** Planned

**Stories:**
1. Extract `RevenueAssumptionsSection` from Assumptions.tsx (client counts, tickets, growth rates per BU)
2. Extract `CostAssumptionsSection` (COGS, commissions, marketing)
3. Extract `HeadcountAssumptionsSection` (headcount ratios, salary ranges, growth)
4. Extract `SgaAssumptionsSection` (SG&A growth rate, admin costs)
5. Extract `MacroAssumptionsSection` (tax rates, Selic, inflation)
6. Extract `ScenarioSelector` as standalone component
7. Create shared `AssumptionRow` component for consistent row layout across sections
8. Reduce Assumptions.tsx to orchestrator role (< 400 lines)
9. Split `FinancialModelContext` into 3 contexts: `AssumptionsContext`, `ModelComputeContext`, `PersistenceContext`
10. Move migration logic out of context into `lib/migrations.ts`

**Success Metrics:**
- Assumptions.tsx < 400 lines
- No single component file > 500 lines
- Each extracted section has its own unit test file

---

### E-007 — Dead Fields Cleanup

- **Priority:** P2 (medium)
- **Impact:** Reduces user confusion and maintenance burden; eliminates fields that silently do nothing
- **Effort:** S
- **Status:** Planned

**Stories:**
1. Audit all assumption fields and map each to its engine consumer (or lack thereof)
2. Connect or remove `sgaPercent` — determine if engine should use it or if `sgaGrowthRate` supersedes it
3. Connect or remove `selicMonthly` — wire to debt/valuation calculations or remove from UI
4. Connect or remove `hcEmployees` — wire to headcount engine or remove
5. Add integration tests that verify every visible assumption field produces a measurable change in at least one output metric

**Success Metrics:**
- Every field shown in the Assumptions UI has a documented effect on at least one output
- Integration test suite validates all field-to-output connections

---

### E-008 — Error Boundaries & Resilience

- **Priority:** P2 (medium)
- **Impact:** Prevents full-app crashes from localized errors; improves user trust
- **Effort:** S
- **Status:** Planned

**Stories:**
1. Add React Error Boundary around each page section (charts, tables, KPI cards)
2. Add Error Boundary at route level with "retry" and "go home" options
3. Implement graceful fallback UI for chart rendering failures
4. Add global unhandled promise rejection handler with user-facing toast
5. Move Auth pages outside `FinancialModelProvider` (they do not need it)

**Success Metrics:**
- A crash in one chart does not take down the entire page
- Error boundaries log to console with component stack trace
- Auth flow works even if FinancialModelContext initialization fails

---

### E-009 — Performance Optimization

- **Priority:** P2 (medium)
- **Impact:** Faster UI response during rapid editing; reduced CPU usage on Overview/PnL pages
- **Effort:** L
- **Status:** Planned

**Stories:**
1. Wrap all Recharts components in `React.memo` with shallow comparison
2. Add `useCallback` to all Assumptions event handlers
3. Implement incremental engine calculation — cache per-year results, only recompute affected years
4. Memoize PnL tree traversal with `useMemo` keyed on `FullModelOutput` reference
5. Add `version` column to `assumptions_snapshots` for optimistic locking
6. Batch edge function queries (fetch-dre-data: 4 sequential queries to 1 batch)
7. Increase DRE database pool size from 1 to 5-10
8. Add TTL cache (1-6 hours) to edge function responses for DRE data

**Success Metrics:**
- Assumptions page re-render time < 16ms (60fps) during rapid editing
- Overview page initial render time reduced by 40%+
- Engine recalculation for single-year change < 5ms

---

### E-010 — Test Coverage

- **Priority:** P1 (high)
- **Impact:** Catches regressions before users do; enables confident refactoring
- **Effort:** XL
- **Status:** Planned

**Stories:**
1. Write unit tests for `calculationsEngine.ts` — cover all revenue formulas, P&L tree construction, and edge cases (zero clients, negative growth)
2. Write unit tests for `periodResolution.ts` — verify blending logic for 2025 (all historical), 2026 (mixed), 2027+ (all projected)
3. Write unit tests for `useAssumptionsPersistence` — mock localStorage and Supabase, test fallback chain
4. Write component tests for each extracted Assumptions section (post E-006)
5. Write integration test: change assumption -> verify P&L output changes correctly
6. Write integration test: save -> reload -> verify assumptions restored identically
7. Add CI pipeline step: `npm test` must pass before merge
8. Set coverage threshold: 60% (phase 1), 80% (phase 2)

**Success Metrics:**
- Test coverage > 80% for engine and context files
- Test coverage > 60% overall
- CI blocks merges on test failure
- Zero known regressions in 30-day window after reaching 80% coverage

---

### E-011 — UX Polish

- **Priority:** P3 (nice-to-have)
- **Impact:** Professional feel; user confidence in data operations
- **Effort:** M
- **Status:** Planned

**Stories:**
1. Add save confirmation toast — show "Saved" or "Saving..." indicator near header
2. Add loading skeleton states for all pages during initial data fetch
3. Add optimistic UI for assumption edits (show change immediately, revert on save failure)
4. Implement offline support — detect offline state, queue writes, sync on reconnect
5. Add cross-tab sync via `BroadcastChannel` or `storage` event listener
6. Add keyboard navigation in Assumptions table (Tab/Enter to move between cells)
7. Add undo/redo (Ctrl+Z/Ctrl+Y) for assumption edits

**Success Metrics:**
- Users always know if their last edit was saved (visible indicator)
- App remains functional for 10+ minutes offline, syncs all changes on reconnect
- NPS score improvement in user feedback surveys

---

### E-012 — Database & Infrastructure Improvements

- **Priority:** P2 (medium)
- **Impact:** Better query performance, data integrity, and operational visibility
- **Effort:** M
- **Status:** Planned

**Stories:**
1. Add missing indexes: `(scenario, user_id)`, `(created_at DESC)`, `(name)` on `assumptions_snapshots`
2. Add `version` column (integer, auto-increment on update) for optimistic locking
3. Wrap assumption save in atomic transaction (deactivate old + insert/update new)
4. Add retry queue for failed Supabase writes (with exponential backoff)
5. Extract frequently queried JSONB fields (scenario totals, last-modified BU) into dedicated columns
6. Add monitoring: error rates, pool exhaustion alerts, RLS violation logs

**Success Metrics:**
- Zero data corruption from concurrent save operations
- Average Supabase write latency < 500ms at p95
- Monitoring dashboard shows all key health metrics

---

## Epic Priority Matrix

| Epic | Priority | Effort | Status | Phase |
|------|----------|--------|--------|-------|
| E-001 Persistence Fixes | P0 | M | Done | -- |
| E-002 Engine Connectivity | P0 | M | Done | -- |
| E-003 UX Auto-Apply | P1 | S | Done | -- |
| E-004 Security Hardening | P0 | M | Planned | Phase 1 (Weeks 1-2) |
| E-005 TypeScript Strict | P1 | L | Planned | Phase 3 (Weeks 5-7) |
| E-006 Component Decomposition | P1 | L | Planned | Phase 2 (Weeks 3-4) |
| E-007 Dead Fields Cleanup | P2 | S | Planned | Phase 2 (Weeks 3-4) |
| E-008 Error Boundaries | P2 | S | Planned | Phase 1 (Weeks 1-2) |
| E-009 Performance | P2 | L | Planned | Phase 3 (Weeks 5-7) |
| E-010 Test Coverage | P1 | XL | Planned | Phase 2-4 (ongoing) |
| E-011 UX Polish | P3 | M | Planned | Phase 4 (Weeks 8-10) |
| E-012 Database Improvements | P2 | M | Planned | Phase 2 (Weeks 3-4) |

---

## Implementation Phases

### Phase 1: Security & Stability (Weeks 1-2)
- E-004 Security Hardening (all 9 stories)
- E-008 Error Boundaries (5 stories)
- E-010 stories 1-2 (engine + blending tests as safety net)

### Phase 2: Modularity & Data (Weeks 3-4)
- E-006 Component Decomposition (10 stories)
- E-007 Dead Fields Cleanup (5 stories)
- E-012 Database Improvements (6 stories)
- E-010 stories 3-4 (persistence + component tests)

### Phase 3: Quality & Performance (Weeks 5-7)
- E-005 TypeScript Strict Mode (6 stories)
- E-009 Performance Optimization (8 stories)
- E-010 stories 5-8 (integration tests, CI, coverage gates)

### Phase 4: Polish (Weeks 8-10)
- E-011 UX Polish (7 stories)
- Final coverage push to 80%+

---

## Success Metrics Summary

| Metric | Current | Target | Epic |
|--------|---------|--------|------|
| Security critical findings | 4 | 0 | E-004 |
| Data loss incidents | Frequent | 0 | E-001 (Done) |
| TypeScript strict mode | Off | On | E-005 |
| Assumptions.tsx lines | 2,425 | < 400 | E-006 |
| Test coverage (engine) | ~10% | > 80% | E-010 |
| Test coverage (overall) | ~10% | > 60% | E-010 |
| Assumptions re-render time | Unmetered | < 16ms | E-009 |
| Dead/disconnected fields | 3+ known | 0 | E-007 |
| Error boundaries | 0 | Per-section | E-008 |
| Maintainability score | 6.5/10 | 8.5/10 | All |

---

## Risks & Mitigations

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| Security breach before E-004 completes | Medium | Critical | Prioritize RLS fix and SQL injection as day-1 tasks |
| TypeScript strict mode breaks production | Low | High | Enable flags incrementally; run full test suite after each flag |
| Component decomposition introduces regressions | Medium | Medium | Write snapshot tests before refactoring; keep feature parity |
| Engine incremental caching produces stale results | Low | High | Maintain full-recalc path as fallback; add comparison assertions in dev mode |
| Offline sync causes data conflicts | Medium | Medium | Implement last-write-wins with server timestamp; show conflict resolution UI in Phase 4 |

---

## Appendix: Reference Documents

- [Brownfield Assessment](./brownfield-assessment.md) — Atlas (Analyst), 2026-03-31
- [Architecture Review](./architecture-review.md) — Aria (Architect), 2026-03-31
- [Database Audit](./database-audit.md) — Dara (Data Engineer), 2026-03-31
