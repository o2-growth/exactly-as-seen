

# Fix: edição de ticket mensal deve propagar para meses seguintes

## Problema
Ao editar o ticket médio de um mês (ex: Abril), apenas aquele mês muda. Os meses seguintes continuam com o valor flat original, então o MRR de Dezembro não reflete a mudança. O comportamento deveria ser igual ao de clientes: interpolar geometricamente do mês editado até Dezembro.

## Solução
Aplicar a mesma lógica de propagação geométrica usada em `handleClientChange` para os tickets mensais.

### `src/pages/Assumptions.tsx` — onCommit do ticket mensal (linhas ~839-856)

Após `yearArr[i] = v`, adicionar recálculo dos meses seguintes:

```
onCommit(v):
  1. yearArr[i] = v  (mês editado)
  2. Se i < 11:
     - decTicket = yearArr[11]  (ticket de Dezembro, já inicializado como ticketVal)
     - Para j de (i+1) até 10:
       - step = j - i
       - remainingSteps = 11 - i
       - Se v > 0 e decTicket > 0:
           yearArr[j] = v * (decTicket / v)^(step / remainingSteps)
       - Senão: yearArr[j] = decTicket (fallback linear)
     - yearArr[11] = decTicket (manter Dez inalterado)
  3. Se i === 11:
     - Apenas atualiza Dezembro, não recalcula anteriores
  4. Salvar yearArr nos assumptions.monthlyTickets
```

### Arquivo alterado
- `src/pages/Assumptions.tsx` — propagação geométrica no onCommit do ticket mensal

