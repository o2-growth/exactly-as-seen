

# Fix: yearly target not syncing with monthly overrides

## Problem

The "Clientes por ano (target fim de ano)" box shows `subProductClients[key][2026] = 5`, but the monthly grid shows values growing from 5 to 15. This happens because:

- `handleApplyRow` (the "Aplicar" button) correctly updates both `monthlyClientOverrides` AND `subProductClients[key][year]` to the new Dec value
- But `handleClientChange` (individual month edits) only updates `monthlyClientOverrides` — it does NOT sync the Dec target back

So the yearly target box gets out of sync with the actual monthly values.

## Solution

### `src/pages/Assumptions.tsx` — `handleClientChange`

After setting the override, also update `subProductClients[key][year]` to reflect the December value (month index 11). If the edited month IS December, use the new value directly. Otherwise, compute December from the current overrides + geometric base.

```typescript
const handleClientChange = (key, year, monthIdx, newCount) => {
  // ... existing override logic ...
  
  // Sync Dec target: if month 11 was edited, use that value directly
  // Otherwise, get Dec value from overrides or keep existing
  const decValue = monthIdx === 11 
    ? newCount 
    : (yearArr[11] !== null ? yearArr[11] : prev.subProductClients[key][year]);
  
  setAssumptions(prev => ({
    ...prev,
    subProductClients: {
      ...prev.subProductClients,
      [key]: { ...prev.subProductClients[key], [year]: decValue },
    },
    monthlyClientOverrides: { ... },
  }));
};
```

This ensures the yearly target box always reflects the December value, whether set by individual edit or by "Aplicar".

### Files to change
- `src/pages/Assumptions.tsx` — update `handleClientChange` to sync Dec target

