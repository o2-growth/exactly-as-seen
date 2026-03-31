

# Remover condição `ebt > 0` — IRPJ/CSLL sempre incidem no Lucro Presumido

## Problema
Atualmente (linha 858), IRPJ e CSLL só são calculados quando `ebt > 0`. No Lucro Presumido, esses tributos incidem **sempre** sobre a base presumida (32% da receita bruta), independente de lucro ou prejuízo.

## Alterações

### 1. `src/engine/calculationsEngine.ts` — Remover guarda `ebt > 0` (linha 858)

Mudar de:
```typescript
if (ebt > 0 && assumptions.taxEnabled !== false) {
```
Para:
```typescript
if (assumptions.taxEnabled !== false) {
```

Isso faz IRPJ (15%) e CSLL (9%) incidirem sempre que `taxEnabled` estiver ativo, sobre a base presumida de cada subproduto, mesmo com EBT negativo.

### 2. `src/pages/Assumptions.tsx` — Atualizar nota explicativa (linha ~1712)

Trocar o texto "somente se EBT > 0" por "sempre incidem — independente de lucro ou prejuízo", alinhado à regra do Lucro Presumido.

### 3. `src/test/engine/calculationsEngine.test.ts` — Ajustar testes

Atualizar o teste "IRPJ/CSLL are non-zero when taxEnabled=true and EBT > 0" para refletir que IRPJ/CSLL são sempre não-zero quando há receita (independente de EBT).

## Impacto
- IRPJ e CSLL passam a reduzir o lucro líquido mesmo em anos de prejuízo operacional
- Adicional de IRPJ já está correto (não depende de EBT)
- Valores no P&L e nos totais anuais refletirão a mudança automaticamente

