

# Adicionar "Adicional de IRPJ" — Faturamento Global (Corrigido)

## Correção
Trimestres encerram nos meses **3, 6, 9 e 12** (índices 1-based), ou seja, índices **2, 5, 8, 11** no array 0-based. O plano anterior já usava os índices corretos no código (0-based), mas a descrição textual estava confusa. Agora fica claro:

- Q1: Jan–Mar (meses 1-3) → calcula no mês 3
- Q2: Abr–Jun (meses 4-6) → calcula no mês 6
- Q3: Jul–Set (meses 7-9) → calcula no mês 9
- Q4: Out–Dez (meses 10-12) → calcula no mês 12

## Lógica

Soma-se a receita bruta total (grossRev de todos os subprodutos) nos 3 meses do trimestre. Ao final (mês 3, 6, 9, 12):

```
lucroPresumido = receitaBrutaTotalTri × 0.32
adicionalTri = max(0, (lucroPresumido - 60) × 0.10)    // R$ mil
```

Distribui `adicionalTri / 3` nos 3 meses do trimestre (retroativamente).

## Alterações

### 1. `src/engine/calculationsEngine.ts` — Cálculo trimestral global

- Acumulador `quarterGrossRev` somando `grossRev` de todos os subprodutos a cada mês
- No mês final do trimestre (quando `monthIndex % 3 === 2`, i.e. meses 3, 6, 9, 12), calcular o adicional e distribuir nos 3 meses do quarter
- Adicionar `adicionalIrpj` ao `taxD` e incluir em `totalTax`/`annualTaxes`
- Resetar acumulador após cada trimestre

### 2. `src/engine/calculationsEngine.ts` — PnL Tree

Novo nó `10.03 — Adicional de IRPJ` entre IRPJ e CSLL, com valores annual e monthly.

### 3. `src/pages/Assumptions.tsx` — UI Tax Deductions

Linha informativa "Adicional de IRPJ" abaixo de "IRPJ efetivo" mostrando "até 3.20%" com nota "(10% sobre excedente de R$60k/tri)". Incluir no TOTAL.

### 4. Testes

Validar `taxDetail.adicionalIrpj` correto e = 0 quando receita trimestral × 0.32 ≤ R$60k.

