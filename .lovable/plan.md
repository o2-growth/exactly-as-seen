

# Mover controles de Churn para baixo dos meses e corrigir projeção

## Problema
1. Os controles "Churn base (flat)", "Crescimento de churn" e "Aplicar" estão **acima** da grade mensal — o padrão das outras seções (ticket) é colocá-los **abaixo**
2. O valor flat não está refletindo nos meses — provavelmente porque o input `value` usa uma IIFE como fallback que pode causar problemas de re-render

## Solução

### Arquivo: `src/pages/Assumptions.tsx`

**1. Reposicionar controles (L1169-1257 → mover para depois de L1287)**

Mover todo o bloco `{!data.churnNotApplicable?.[prodKey] && (<div className="flex flex-wrap ...">` para **depois** da grade de meses (depois do `</div>` do grid em L1286), seguindo o mesmo padrão do ticket onde os controles ficam abaixo dos meses.

Ordem final:
```
Título "Churn (clientes/mês)" + [N/A]
Grid 12 meses (ou N/A)
Churn base (flat): [___]  |  Crescimento de churn: [___]  [Aplicar]
Total ano: X clientes perdidos
```

**2. Corrigir value do input "Churn base (flat)"**

O `value` atual usa uma IIFE como fallback que pode não atualizar corretamente. Trocar para uma variável calculada antes do JSX:

```ts
const currentChurnFlat = data.monthlyChurnRates?.[prodKey]?.[selectedYear] 
  ?? Math.round(getChurnMonthly(prodKey, data, selectedYear) * 12 * 100 * 10) / 10;
```

E usar `value={currentChurnFlat}` no input — mais limpo e garante re-render correto.

**3. Condicionar exibição dos controles**

Só mostrar os controles de flat+crescimento quando `!data.churnNotApplicable?.[prodKey]`, mantendo a lógica atual mas na nova posição (abaixo do grid).

