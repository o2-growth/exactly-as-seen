
# Ajustar lógica de Ticket Flat e Crescimento de Churn em toda a aba Revenue

## O que está acontecendo hoje
A tela de Revenue já propaga corretamente o crescimento de clientes até 2030, mas **ticket** e **churn** ainda seguem regras diferentes:

- **Ticket base (flat)** hoje só altera `tickets[prodKey]`, mas não reprojeta automaticamente os meses do modelo
- **Aplicar crescimento do ticket** usa uma base incompleta e pode não respeitar o encadeamento esperado entre meses/anos
- **Churn** hoje grava apenas um valor anual para o ano selecionado em `monthlyChurnRates`
- O rótulo ainda está como **“Taxa de churn”**, mas você quer usar isso como um **crescimento de churn**
- Precisa aceitar **percentual negativo**, para reduzir churn ao longo do tempo
- Isso deve valer para **todas as categorias e subcategorias de receita**

## Implementação proposta

### 1. Ticket base (flat) passa a projetar todos os meses até 2030
No bloco expandido de cada subcategoria em `src/pages/Assumptions.tsx`:

- transformar o campo **Ticket base (flat)** em origem de projeção mensal
- ao editar esse campo:
  - atualizar `tickets[prodKey]`
  - recriar `monthlyTickets[prodKey]` de `selectedYear` até 2030
  - preencher todos os meses futuros com o valor flat
  - preservar meses históricos bloqueados
  - usar o valor final de um ano como base do próximo, mantendo consistência com o resto do modelo

Resultado esperado:
- se eu mudar o flat de uma linha, o ticket mensal daquela subcategoria passa a refletir isso em todo o horizonte do modelo

### 2. Crescimento do ticket segue a mesma lógica de clientes
Ajustar `handleApplyTicketGrowth` para seguir o mesmo padrão já usado em clientes:

- iterar de `selectedYear` até 2030
- manter `prev` como float
- aplicar crescimento mês a mês
- arredondar só no valor exibido/salvo do mês
- usar o último mês do ano anterior como base do próximo ano
- preservar qualquer valor mensal manual já inserido, usando esse manual como nova base

Assim o ticket terá comportamento consistente com:
- crescimento acumulado real
- propagação até fim do modelo
- respeito a intervenções manuais

### 3. Churn vira “Crescimento de churn”
No bloco de churn da mesma tela:

- renomear **“Taxa de churn”** para **“Crescimento de churn”**
- manter o campo como percentual anual
- permitir entrada de valores **negativos**
- manter o botão **Aplicar**

### 4. Aplicar crescimento de churn até 2030
Criar para churn a mesma lógica de propagação:

- ao clicar em **Aplicar**, em vez de salvar apenas `monthlyChurnRates[prodKey][selectedYear]`
- projetar do ano selecionado até 2030
- usar o churn atual daquele produto/ano como base
- aplicar crescimento acumulado anual:
  - exemplo: 5% com crescimento de churn de -10% vira 4.5 no próximo ano, depois 4.05, etc.
- salvar os valores anuais projetados em `monthlyChurnRates[prodKey][year]`

Importante:
- o valor continua sendo um **churn anual armazenado por ano**
- a visualização mensal continua derivada dele via `getChurnMonthly(...) / 12`
- isso evita mexer no motor inteiro e mantém compatibilidade com o cálculo atual de perda de clientes

### 5. Atualizar toda a UI dependente para usar `data`
Há trechos que ainda usam `assumptions` direto em vez de `data` (que respeita `editState` enquanto edita). Vou alinhar isso no bloco de Revenue para evitar sensação de “não aplicou”:

- MRR de Dez
- Nova Receita adicionada
- totais do ano
- qualquer leitura de `monthlyTickets`/`monthlyChurnRates` dentro da expansão da linha

Isso garante que as mudanças apareçam imediatamente no modo de edição.

## Arquivo principal
- `src/pages/Assumptions.tsx`

## Detalhes técnicos
- `monthlyTickets` continuará sendo override mensal por produto/ano
- `monthlyChurnRates` continuará sendo override anual por produto/ano
- `getChurnMonthly` não precisa mudar de estrutura; só passará a receber valores anuais já projetados até 2030
- a propagação será aplicada automaticamente para todas as categorias porque a tela já renderiza tudo a partir de `CLIENTS_ROWS`

## Resultado esperado
Para qualquer subcategoria de receita, será possível:

- definir um **ticket flat** e espalhar isso por todo o modelo
- aplicar **crescimento de ticket** até 2030
- aplicar **crescimento de churn** até 2030
- usar **percentuais negativos** para reduzir churn
- ver tudo refletido imediatamente na tela durante edição
