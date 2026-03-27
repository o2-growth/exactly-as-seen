

# Fix: edição de um mês deve recalcular meses seguintes

## Problema

Quando o usuário edita Abril (ex: muda para 6), apenas Abril muda. Mas o modelo financeiro usa interpolação geométrica — cada mês depende do anterior. Então editar Abril deveria recalcular Mai-Dez mantendo a mesma curva de crescimento até o target de Dezembro.

Atualmente, `handleClientChange` salva apenas o override do mês editado (`yearArr[monthIdx] = newCount`) e deixa os outros como `null`. Os meses `null` voltam ao valor base (interpolação geométrica original), ignorando o novo valor de Abril.

## Solução

Quando o usuário edita um mês projetado (não histórico), recalcular todos os meses **após** o editado usando interpolação geométrica do novo valor até o target de Dezembro, e salvar tudo como overrides.

### `src/pages/Assumptions.tsx` — `handleClientChange`

```
handleClientChange(key, year, monthIdx, newCount):
  1. Pegar o array atual de overrides (ou null × 12)
  2. Setar yearArr[monthIdx] = newCount
  3. Se monthIdx < 11:
     - decTarget = yearArr[11] ?? subProductClients[key][year]
     - Para cada mês j de (monthIdx+1) até 10:
       - Interpolar geometricamente de newCount (mês editado) até decTarget (mês 11)
       - yearArr[j] = interpolatedValue
     - yearArr[11] = decTarget (manter Dec inalterado)
  4. Se monthIdx === 11:
     - decTarget = newCount
     - Não recalcular meses anteriores
  5. Salvar yearArr completo nos overrides + sync decTarget
```

A interpolação: `newCount * (decTarget / newCount)^(step / remainingSteps)` onde `step` vai de 1 a `remainingSteps` (distância do mês editado até Dezembro).

### Meses históricos (bloqueados)
Meses históricos já são bloqueados na UI (🔒), então esta lógica só se aplica a meses editáveis.

### Arquivos alterados
- `src/pages/Assumptions.tsx` — `handleClientChange` recalcula meses subsequentes

