

# Corrigir visibilidade do campo "Churn base (flat)" e controles de crescimento

## Problema
Os controles de churn (campo "Churn base flat", "Crescimento de churn" e botão "Aplicar") estão todos numa única linha horizontal com `ml-auto`, o que faz com que em viewports de ~993px eles saiam da área visível ou fiquem cortados. O usuário não consegue ver nem interagir com esses campos.

## Solução

### Arquivo: `src/pages/Assumptions.tsx` (~L1148-1260)

**Quebrar o layout do bloco de churn em múltiplas linhas**, igual ao padrão usado no bloco de ticket:

1. **Linha do título + N/A**: manter na primeira linha
2. **Churn base (flat) + Crescimento de churn + Aplicar**: mover para uma segunda linha abaixo do título, usando `flex flex-wrap items-center gap-2` em vez de `ml-auto` numa única linha

Layout proposto:
```
Churn (clientes/mês) — 2025   [N/A]
Churn base (flat): [___] % a.a.  |  Crescimento de churn: [___] % a.a.  [Aplicar]
```

Isso garante que:
- Os campos fiquem sempre visíveis independente da largura da tela
- O input de "Churn base (flat)" fique acessível para digitação
- O botão "Aplicar" fique visível e clicável
- Mantém o `disabled={!editing}` em todos os campos

### Mudança técnica
- Mover o bloco `{!data.churnNotApplicable?.[prodKey] && (...)}` (linhas 1168-1259) para fora do `div` do título, criando um `div` separado logo abaixo
- Usar `flex flex-wrap items-center gap-2 mt-1` no novo container

