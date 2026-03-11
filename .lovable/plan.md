

# Plan: Remove "Realizado vs Projetado" Page

Remove the Actuals page and all references to it.

## Changes

| File | Change |
|------|--------|
| `src/App.tsx` | Remove `Actuals` import and its `<Route>` |
| `src/components/layout/AppSidebar.tsx` | Remove the nav item for `/actuals` |
| `src/pages/Actuals.tsx` | Delete file |
| `src/hooks/useOxyData.ts` | Delete file (only used by Actuals) |
| `src/services/oxyApi.ts` | Delete file (only used by Actuals) |

