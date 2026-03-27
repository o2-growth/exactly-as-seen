

# Tabela completa de Deduções por Produto/Subproduto

## Resumo
Substituir a tabela atual de 3 BUs (CaaS, SaaS, Setup) por uma **matriz completa** onde as linhas são as categorias de dedução (PIS, COFINS, ISS, IRPJ, CSLL) e as colunas são **todos os produtos e subprodutos** do P&L, permitindo configurar alíquotas individualmente.

## Estrutura da tabela

```text
                    │ CaaS                                          │ SaaS                                    │ Education        │ Expansão         │ Tax
Dedução             │ Serv.Esp │ Enterpr │ Corp │ Parc │ BPO Fin   │ Oxy │ Oxy+G │ Setup │ Parc │ Oxy+G+E │ DonoCFO │ EN │ FR │ FSP │ OxyHack │ Franq │ MFranq │ AT │ GPT │ RCT │ RT │ DTC
────────────────────┼──────────┼─────────┼──────┼──────┼───────────┼─────┼───────┼───────┼──────┼─────────┼─────────┼────┼────┼─────┼─────────┼───────┼────────┼────┼─────┼─────┼────┼────
PIS (%)             │  0.65    │  0.65   │ 0.65 │ 0.65 │  0.65     │ ... │  ...  │  ...  │ ...  │   ...   │   ...   │... │... │ ... │   ...   │  ...  │  ...   │... │ ... │ ... │... │...
COFINS (%)          │  3.00    │  3.00   │ 3.00 │ 3.00 │  3.00     │ ... │  ...  │  ...  │ ...  │   ...   │   ...   │... │... │ ... │   ...   │  ...  │  ...   │... │ ... │ ... │... │...
ISS (%)             │  5.00    │  5.00   │ 5.00 │ 5.00 │  5.00     │ 2.9 │  2.9  │  2.9  │ 2.9  │   2.9   │   2.9   │2.9 │2.9 │ 2.9 │   2.9   │  2.9  │  2.9   │2.9 │ 2.9 │ 2.9 │2.9 │2.9
IRPJ efetivo (%)    │  4.80    │  4.80   │ 4.80 │ 4.80 │  4.80     │ ... │  ...  │  ...  │ ...  │   ...   │   ...   │... │... │ ... │   ...   │  ...  │  ...   │... │ ... │ ... │... │...
CSLL efetivo (%)    │  2.88    │  2.88   │ 2.88 │ 2.88 │  2.88     │ ... │  ...  │  ...  │ ...  │   ...   │   ...   │... │... │ ... │   ...   │  ...  │  ...   │... │ ... │ ... │... │...
────────────────────┼──────────┼─────────┼──────┼──────┼───────────┼─────┼───────┼───────┼──────┼─────────┼─────────┼────┼────┼─────┼─────────┼───────┼────────┼────┼─────┼─────┼────┼────
TOTAL efetivo (%)   │ 16.33    │ 16.33   │16.33 │16.33 │ 16.33     │14.23│ 14.23 │ 14.23 │14.23 │  14.23  │  14.23  │... │... │ ... │  14.23  │ 14.23 │ 14.23  │... │ ... │ ... │... │...
```

Cada célula de PIS, COFINS e ISS é **editável**. IRPJ e CSLL são calculados (read-only) com base no tipo de receita (serviço → base presumida 32%). A linha TOTAL é calculada automaticamente.

## Alterações

### 1. Modelo de dados — `src/lib/financialData.ts`
- Substituir `buTaxConfigs: BUTaxConfig[]` por:
```ts
interface SubProductTaxConfig {
  pis: number;      // default 0.65
  cofins: number;   // default 3.0
  iss: number;      // default 5.0 (CaaS) ou 2.9 (demais)
  tipoReceita: string; // 'servico' (default)
}
subProductTaxRates?: Partial<Record<TicketKey, SubProductTaxConfig>>;
```
- Os defaults serão: CaaS subprodutos com ISS=5%, demais com ISS=2.9%, todos com PIS=0.65%, COFINS=3%, tipoReceita='servico'
- Manter `BUTaxConfig` como deprecated/fallback temporário

### 2. Engine — `src/engine/calculationsEngine.ts`
- Atualizar `calcularDeducoesPorBU` para aceitar `subProductTaxRates` e calcular deduções **por subproduto** usando as receitas detalhadas (`rev.caasAssessoria`, `rev.caasEnterprise`, etc.)
- IRPJ/CSLL: calcular por subproduto com base presumida individual

### 3. UI — `src/pages/Assumptions.tsx`
- Substituir a tabela de 3 BUs pela **matriz completa** acima
- Scroll horizontal para acomodar todos os subprodutos
- Cabeçalhos agrupados por produto (CaaS, SaaS, Education, Expansão, Tax) com colspan
- Células de PIS, COFINS e ISS editáveis inline
- Linha TOTAL calculada
- Manter toggle IRPJ/CSLL e info box existentes

### 4. Subprodutos incluídos (22 colunas)
**CaaS**: Serv. Especializados, Enterprise, Corporate, Parceiros, BPO Financeiro
**SaaS**: Oxy, Oxy+Gênio, Setup, Parceiros, Oxy+Gênio+Especialista
**Education**: Dono CFO, Eng. Negócios, Financeiro Raiz, FSP
**Expansão**: Oxy Hacker, Franquia, Master Franquia
**Tax**: AT, GPT, RCT, RT, DTC

## Arquivos alterados
1. `src/lib/financialData.ts` — novo `SubProductTaxConfig` + defaults por subproduto
2. `src/engine/calculationsEngine.ts` — cálculo de deduções por subproduto
3. `src/pages/Assumptions.tsx` — matriz completa editável

