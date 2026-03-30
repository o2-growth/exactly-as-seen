

# Adicionar "Churn Base (Flat)" — campo editável com projeção até 2030

## Problema
Hoje a seção de churn não tem um campo para definir o valor base. O usuário só vê "Crescimento de churn" e "Aplicar", mas não consegue definir o churn inicial por subproduto. Precisa de um campo "Churn base (flat)" idêntico ao "Ticket base (flat)".

## Solução

### Arquivo: `src/pages/Assumptions.tsx`

**1. Adicionar campo "Churn base (flat)" na linha do churn (~L1168-1170)**

Inserir um input numérico antes do "Crescimento de churn", no mesmo `div` com `ml-auto`. Layout:

```
Churn base (flat): [___] % a.a.  |  Crescimento de churn: [___] % a.a.  [Aplicar]
```

- Input tipo `number`, `step="0.1"`, `disabled={!editing}`
- Valor lido de `data.monthlyChurnRates?.[prodKey]?.[selectedYear]` (ou fallback para o default do `getChurnMonthly`)
- Ao alterar (`onChange`), propagar o valor flat para todos os anos de `selectedYear` até 2030 em `monthlyChurnRates[prodKey][year]`
- Usar o guard `if (editing) setEditState(...) else setAssumptions(...)`

**2. Lógica de projeção do flat**

Ao preencher o campo, aplicar o valor para todos os anos futuros:
```ts
const yearsToApply = YEARS.filter(y => y >= selectedYear);
const newRates: Record<number, number> = {};
for (const y of yearsToApply) {
  newRates[y] = val; // mesmo valor flat para todos
}
// updater: merge em monthlyChurnRates[prodKey]
```

**3. "Crescimento de churn" usa o flat como base**

O botão "Aplicar" do crescimento já lê `data.monthlyChurnRates?.[prodKey]?.[selectedYear]` como base — com o flat preenchido, isso funcionará automaticamente. O crescimento composto será aplicado a partir desse valor base.

## Resultado
- Campo "Churn base (flat)" editável por subproduto
- Ao preencher, propaga o valor para todos os anos até 2030
- "Crescimento de churn" + "Aplicar" aplica crescimento composto sobre essa base
- Funciona para todas as categorias/subcategorias (mesmo loop `filteredProducts`)

