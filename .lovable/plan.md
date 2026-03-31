

# Corrigir "Crescimento de churn" — diagnóstico e correções

## Diagnóstico

Analisei o código em detalhe. A lógica do botão "Aplicar" para crescimento de churn (lines 1397-1413) e a função `reprojectWithChurn` (lines 724-782) estão estruturalmente corretas. Os problemas identificados são:

### Problema 1: O crescimento composto aplica-se **ano a ano**, mas a UI mostra apenas o ano selecionado
Quando o usuário digita 10% de crescimento e clica "Aplicar" estando em 2025, o churn de 2025 permanece 5% (o base). O efeito só é visível ao trocar para 2026 (5.5%), 2027 (6.05%), etc. Não há feedback visual imediato.

### Problema 2: O resumo "Churn: X% a.a." e os valores mensais não refletem anos futuros na mesma tela
O usuário precisa manualmente trocar de ano para verificar se o crescimento foi aplicado.

### Problema 3: O campo de crescimento e o botão "Aplicar" exigem modo de edição (`editing`)
Se o usuário não entrou no modo de edição, os controles ficam desabilitados sem feedback claro.

## Alterações

### 1. `src/pages/Assumptions.tsx` — Adicionar preview do churn projetado por ano
Após o botão "Aplicar", exibir uma linha resumo mostrando o churn resultante para cada ano (2025→2030), similar à visualização de "Clientes por ano (soma)":

```
Churn por ano: 2025: 5.0% | 2026: 5.5% | 2027: 6.1% | 2028: 6.7% | 2029: 7.3% | 2030: 8.1%
```

Isso dá feedback imediato de que o crescimento foi aplicado.

### 2. `src/pages/Assumptions.tsx` — Remover `disabled={!editing}` dos controles de churn
Os campos "Churn base (flat)", "Crescimento de churn" e o botão "Aplicar" devem funcionar em modo não-edição (aplicando direto em `setAssumptions`), consistente com o fato de que `reprojectWithChurn` já suporta ambos os modos (line 781: `if (editing) setEditState(updater); else setAssumptions(updater);`).

### 3. `src/pages/Assumptions.tsx` — Feedback visual no botão "Aplicar"
Trocar brevemente o texto do botão para "Aplicado ✓" após o clique, retornando ao normal após 1.5s.

## Resultado
- O crescimento de churn funciona sem precisar entrar em modo de edição
- O usuário vê imediatamente os valores projetados por ano após clicar "Aplicar"
- Feedback visual confirma que a ação foi executada

