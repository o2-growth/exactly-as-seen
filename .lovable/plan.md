

# Ajustar ticket por mês e corrigir edição travada

## Problemas

1. **Ticket por mês no card expandido**: Quando você expande um produto (ex: Serviços Especializados), o ticket exibido é um campo único flat. Você quer poder definir tickets diferentes por mês (ex: Abril = 1500, Maio = 2000). O toggle "Editar por mês" existe na seção separada de Ticket Médio (mais abaixo na página), mas não está integrado no card expandido do produto.

2. **Cadeado impede edição**: O card expandido mostra meses históricos com 🔒, mas os meses projetados (editáveis) também podem não estar respondendo porque o `handleClientChange` depende do estado `editing` via `updateModel` — se você não clicou em "Edit Assumptions" primeiro, o `updateModel` não faz nada visível porque atualiza `editState` em vez de `assumptions`.

## Solução

### A. Ticket mensal no card expandido do produto
No card expandido de cada produto (onde hoje tem um único input "Ticket R$/mês"):
- Substituir o input único por um grid de 12 meses (igual ao grid de clientes)
- Meses históricos ficam read-only com 🔒
- Meses projetados ficam editáveis
- Cada alteração atualiza `monthlyTickets` no assumptions, que o engine já lê via `getTicketForMonth()`
- O MRR Dez e resumo se recalculam automaticamente usando o ticket do mês correspondente

### B. Remover dependência do botão "Edit Assumptions" para edição inline
O card expandido do produto já usa `directUpdateClients` e `directUpdateTicket` que bypassam o edit mode. Mas o `handleClientChange` (chamado pelo `MonthlyClientInput`) usa `updateModel` que depende do `editing` flag.

**Correção**: Fazer `handleClientChange` usar `setAssumptions` diretamente (como `directUpdateClients` já faz), em vez de `updateModel`. Assim a edição mensal de clientes funciona sem precisar clicar "Edit Assumptions".

### C. Atualizar o MRR Dez para usar ticket mensal
O resumo "MRR Dez" hoje faz `monthly[11] * ticketVal` com ticket flat. Passar a usar o ticket de dezembro quando `monthlyTickets` estiver ativo.

## Arquivos a alterar

### `src/pages/Assumptions.tsx`
1. **`handleClientChange`** (linha ~437): trocar `updateModel(...)` por `setAssumptions(prev => ...)` direto
2. **Card expandido** (linhas ~810-825): substituir input flat de ticket por grid de 12 meses com inputs individuais, usando `monthlyTickets`
3. **Resumo MRR Dez**: usar ticket de dezembro (do monthlyTickets ou flat)
4. **`handleApplyRow` e `handleApplyAll`**: mesma correção — usar `setAssumptions` direto

## Resultado esperado
- Expandir produto → ver 12 inputs de ticket (meses projetados editáveis, históricos travados)
- Alterar ticket de um mês → MRR e receita daquele mês mudam
- Editar clientes mensais funciona sem precisar clicar "Edit Assumptions"
- Tudo reflete no engine automaticamente

