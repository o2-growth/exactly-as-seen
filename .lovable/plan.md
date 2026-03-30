
Objetivo: manter “Crescimento de churn” acima, como você pediu, e corrigir a lógica para que qualquer mudança de churn reflita imediatamente no mês a mês.

Diagnóstico
- O problema não é mais de layout.
- Hoje o churn altera `monthlyChurnRates`, mas a grade mensal exibida vem de `monthlyClientOverrides`/`subProductClients`.
- Como essa projeção de clientes não é recalculada quando o churn muda, o valor do churn muda internamente, porém o mês a mês continua igual.

Implementação proposta

1. Centralizar a reprojeção de clientes quando churn mudar
- Arquivo: `src/pages/Assumptions.tsx`
- Criar um helper local para um subproduto:
  - ler a base do ano anterior
  - ler overrides manuais existentes
  - aplicar crescimento mensal já salvo em `growthRates`
  - aplicar o churn atualizado
  - regenerar `monthlyClientOverrides[prodKey][year]`
  - atualizar também `subProductClients[prodKey][year]` com o valor de dezembro
- Rodar isso de `selectedYear` até 2030, encadeando dezembro de um ano no próximo.

2. Fazer o “Churn base (flat)” disparar essa reprojeção
- Manter o campo acima dos meses.
- Ao editar o valor:
  - continuar salvando em `monthlyChurnRates`
  - em seguida recalcular as projeções mensais do subproduto do ano selecionado até 2030
- Isso fará a grade mensal mudar na hora.

3. Fazer “Aplicar” do crescimento de churn também reprojetar
- O botão continuará atualizando `monthlyChurnRates` com crescimento anual composto.
- Depois disso, aplicar a mesma reprojeção mensal para todos os anos afetados.
- Percentuais negativos continuam permitidos.

4. Preservar entradas manuais do usuário
- A reprojeção deve seguir o mesmo padrão já usado em `handleApplyRow`:
  - respeitar `manualMonthlyClientOverrideFlags`
  - manter meses editados manualmente como seed
  - recalcular só os meses automáticos à frente
- Assim o churn passa a influenciar o modelo sem apagar ajustes manuais.

5. Ajustar os pontos que hoje leem apenas o valor derivado
- Garantir que:
  - a grade de churn continue lendo `getChurnMonthly(prodKey, data, selectedYear)`
  - a grade de clientes use os overrides recém-recalculados
  - o total anual de churn também reflita a nova base mensal imediatamente

Resultado esperado
- “Crescimento de churn” permanece acima.
- Alterar “Churn base (flat)” muda o mês a mês de clientes.
- Clicar em “Aplicar” no churn reprojeta do ano selecionado até 2030.
- Funciona para todas as categorias e subcategorias já renderizadas na aba Revenue.

Detalhe técnico
- Hoje existem dois fluxos separados:
  - churn: altera `monthlyChurnRates`
  - clientes mensais: exibidos a partir de `monthlyClientOverrides` + `subProductClients`
- A correção é ligar esses dois fluxos, reutilizando a mesma fórmula já existente em `handleApplyRow`:
```text
prev = prev * (1 + growth - churnRate)
```
- Só que agora essa reprojeção também será chamada quando o churn mudar, e não apenas quando o crescimento de clientes for aplicado.
