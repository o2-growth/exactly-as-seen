
# Corrigir de vez a lógica de clientes mensais e ticket no Assumptions

## O problema real
O comportamento da sua captura está errado por 3 motivos combinados:

1. **2025 está sendo tratado como histórico**, mas a UI ainda deixa digitar nos cards mensais. Então você coloca `5` em março e a tela recalcula tudo a partir do histórico, gerando números incoerentes.
2. **Os clientes históricos estão sendo derivados de `receita / ticket`**. Isso faz o passado mudar quando você altera o ticket, o que não pode acontecer.
3. **A tela e o motor usam lógicas diferentes**:
   - a tela usa `computeProjectedClients` com crescimento/churn
   - o motor usa interpolação linear em `calculationsEngine.ts`
   
Resultado: o que você vê no grid não bate com o que impacta receita, MRR e KPIs.

## Ajuste proposto

### 1. Travar meses históricos de verdade
Em `src/pages/Assumptions.tsx`:
- tornar **somente leitura** os meses históricos:
  - todo 2025
  - jan-fev-mar de 2026
- mostrar visual de bloqueado e remover edição nesses meses
- impedir o caso da sua captura: março/2025 não poderá mais “aceitar” valor e bagunçar a projeção

### 2. Parar de recalcular histórico com base no ticket
Em `src/lib/monthlyData.ts`:
- separar claramente:
  - **histórico real** = vem dos dados históricos
  - **projeção editável** = vem das premissas
- o ticket continuará afetando **receita**, mas **não** mudará contagem histórica de clientes

### 3. Unificar a lógica mensal entre tela e engine
Criar/centralizar uma única função de cálculo mensal e usá-la em:
- `src/pages/Assumptions.tsx`
- `src/engine/calculationsEngine.ts`

Assim:
- editar mês projetado altera o mês
- isso altera a curva do ano
- isso altera receita/MRR/KPIs do modelo de forma consistente

### 4. Fazer a edição mensal realmente persistir no modelo
Hoje editar mês só tenta empurrar efeito via dezembro. Vou ajustar para:
- ao editar um mês projetado, recalcular a série mensal correta
- persistir o resultado usado pelo modelo
- manter o card anual, total do ano e MRR coerentes com o que foi digitado

### 5. Corrigir a semântica do ticket
O campo continuará como **Ticket (R$/mês)**, mas com comportamento correto:
- ticket mensal afeta receita mensal
- não reescreve histórico de clientes
- resumo “MRR Dez” passa a refletir exatamente a mesma base usada pelo engine

## Arquivos principais
- `src/pages/Assumptions.tsx`
- `src/lib/monthlyData.ts`
- `src/engine/calculationsEngine.ts`
- possivelmente `src/lib/financialData.ts` se eu precisar guardar override mensal explícito

## Resultado esperado
Depois do ajuste:
- março/2025 não ficará mais “editável errado”
- meses projetados passarão a funcionar de verdade
- mudar cliente mensal impactará anual, receita e KPIs
- mudar ticket impactará receita/MRR, sem distorcer histórico

## Validação que vou fazer na implementação
Vou considerar concluído só quando estes cenários passarem:

1. **Reproduzir sua captura**
   - abrir CAAS > Serviços Especializados
   - selecionar 2025
   - confirmar que março histórico está bloqueado e não gera distorção

2. **Teste funcional de projeção**
   - selecionar um ano projetado
   - editar um mês
   - validar mudança em:
     - total do ano
     - dezembro
     - MRR
     - KPIs/resumo

3. **Teste do ticket**
   - alterar ticket mensal
   - confirmar que:
     - receita muda
     - MRR muda
     - histórico de clientes não muda

4. **Teste de consistência**
   - conferir se o monthly grid e o engine retornam os mesmos números

## Detalhes técnicos
Se a inconsistência principal vier do engine linear vs. tela com churn/crescimento, a correção central será **usar a mesma função mensal nos dois lados**, em vez de continuar convertendo edição mensal apenas em target de dezembro.
