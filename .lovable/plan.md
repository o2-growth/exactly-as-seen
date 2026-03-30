

# Replicar crescimento % do ticket até 2030

## Problema
`handleApplyTicketGrowth` aplica o crescimento apenas ao ano selecionado. Precisa propagar até 2030, igual ao que já funciona para número de clientes em `handleApplyRow`.

## Solução
Modificar `handleApplyTicketGrowth` para iterar de `year` até 2030, encadeando o valor do ticket de Dezembro como base de Janeiro do ano seguinte. Manter `prev` como float para precisão, arredondando apenas o valor salvo.

### Lógica
```text
Para cada ano Y de [year ... 2030]:
  - Se Y > year: baseTicket = prev (float do último mês do ano anterior)
  - Para cada mês M de 0..11:
    - Se histórico: prev = valor atual do mês
    - Senão: prev = prev * (1 + rate), yearArr[m] = round(prev)
  - Salva monthlyTickets[prodKey][Y] = yearArr
```

### Alteração
- `src/pages/Assumptions.tsx` — `handleApplyTicketGrowth` (~L630-671):
  - Adicionar loop `for (const y of YEARS.filter(y => y >= year))`
  - Manter `prev` (baseTicket) como float entre anos
  - Usar `prev = prev * (1 + rate)` e `yearArr[m] = Math.round(prev)` (sem reatribuir o arredondado ao prev)
  - Acumular todos os `monthlyTickets` overrides e aplicar no updater de uma vez

