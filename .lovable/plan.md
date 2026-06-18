## Diagnóstico do que está hoje vs. o PDF original

Comparei os 41 slides atuais com o PDF que você enviou. Existem **3 problemas reais**:

**1. Conteúdo do PDF foi resumido demais.** Vários slides perderam bullets, tabelas e números que estavam no original:
- Slide 7 (custo CLT) — copy fiel, mas os valores estão **hardcoded** (R$ 25k, R$ 18k…) em vez de virem do módulo de Headcount.
- Slide 12 (TAM) — o PDF tem tabela **TAM/SAM/SOM (20M / 6M / 100k)** com fonte Sebrae; nosso slide só mostra "6M · R$2Tri · 30%".
- Slide 15 (SaaS+AI) — o PDF lista **10 funcionalidades detalhadas**; nosso slide mostra só 5 bullets curtos.
- Slide 16 (CaaS) — o PDF tem **dois blocos**: B2B (10 pontos) e B2C/CFO (10 pontos); nosso slide tem 5 bullets genéricos.
- Slide 17 (Marketplace) — o PDF tem tabela **"Dores da empresa / Plataforma O2 / Dores do CFO"**; nosso slide só tem 2 cards.
- Slide 18 (BaaS) — o PDF lista **14 itens**; nosso slide mostra 4.
- Slide 19 (Modelo) — o PDF mostra o **fluxo metodológico Setup (R$15k ou 12x R$1.497) + 3 planos SaaS (R$2.390 / R$2.497 / R$3.997) + MRR R$5.000**; nosso slide só puxa tickets do contexto.

**2. Vários dados que existem no engine estão "fakes" ou hardcoded:**
- Slide 25 — distribuição trimestral inventada (`0.7 + i*0.2`). Vamos somar os meses reais do `MonthlyPnL`.
- Slide 23 — LTV/CAC = 8.9 fixo. O engine tem o cálculo real.
- Slide 3 — KPIs como "R$3mi investidos em produto" e "+R$2bi de faturamento dos clientes" estão escritos como texto. O segundo dá pra puxar do `useHistoricalClients`.
- Slide 39 — ARR usando `grossRevenue` total. ARR correto = `(MRR de dezembro do ano) × 12`, somando só receitas recorrentes (SaaS + CaaS recorrente).

**3. Recorte travado em 2028.** Você pediu série completa **2022→2030** nos slides financeiros — hoje os charts param em 2025 (slide 24), 2028 (slide 27, 29), e a tabela de valuation usa só 2025.

---

## O que vou fazer

### A. Conteúdo: reescrever os 41 slides 100% fiel ao PDF

Cada slide passa a ter exatamente os bullets, tabelas e textos do original. Mantenho o design system O2 (navy + verde, Space Grotesk/Inter) — escolha "Híbrido".

| Slide | O que muda |
|---|---|
| 6 | Tabela 5×3 com copy completo do PDF (Empreendedor + Gestor) |
| 7 | Itens viram **rows do Headcount real** (CFO, Diretor TI, Dev, Analistas), valores do módulo |
| 8 | Diagrama integrado DATAFLOW→DIAPA→LUXA fiel ao PDF |
| 12 | Tabela **TAM / SAM / SOM (20M / 6M / 100k)** com fonte Sebrae |
| 13 | 3 cards de produto com os ícones/screenshots do PDF |
| 14-18 | Listas longas (10/14 itens) idênticas ao PDF |
| 17 | Tabela 3 colunas "Dores empresa · O2 · Dores CFO" |
| 19 | Card Setup + Card SaaS (3 planos) + Card MRR/Success Fee |
| 20-21 | Fotos reais do time extraídas do PDF |

### B. Dados: cabear TUDO no `calculationsEngine` (2022→2030)

| Slide | Fonte real |
|---|---|
| 3 | `growth` = engine, `mult` = engine, `cmPct` = engine, `LTV/CAC` = engine, `clientes geridos` = `useHistoricalClients` |
| 19 | `assumptions.tickets` + `assumptions.plans` |
| 23 | LTV/CAC e CM% reais do engine |
| 24 | Faturamento **2022–2030** (9 barras) |
| 25 | Receita Bruta **mensal de 2025** (12 barras) somando `MonthlyPnL` real |
| 26 | Marketing **2024–2030** |
| 27 | Tabela **2025→2030**: Receita Bruta, Lucro Bruto, EBITDA, Lucro Líquido |
| 28 | YoY 2024→2025 **e** 2025→2026 (2 colunas), do engine |
| 29 | Tabela **2024→2030**: Receita Líquida, EBITDA, Margem EBITDA |
| 30 | KPIs reais: caixa gerado YTD via `useOxyCashFlow` + dívida bancária via `useFinancialDebts` |
| 39 | ARR = MRR dezembro de 2025 × 12 (recorrente apenas); valuation = ARR × 10× |

### C. Imagens-chave do PDF importadas como assets

Extraio do PDF: logo O2, fotos dos sócios (slides 20-21), screenshots da Oxy (slides 14-15), ícones de produto (slide 13). Cada uma vai pro CDN via `lovable-assets` e entra no slide como `<img>`.

### D. Overrides continuam funcionando

Toda string e número segue dentro de `<DataField>` — você continua editando manualmente quando precisar.

---

## Arquitetura técnica (resumo)

```text
src/components/pitch-deck/
  slides.tsx                     ← reescrita completa dos 41 slides
  charts/
    BarChart.tsx                 ← série dinâmica 2022-2030
    YearTable.tsx                ← tabela ano-a-ano (anos configuráveis)
    MonthlyBarChart.tsx          ← novo (slide 25 mensal real)
src/lib/pitchDeck/
  metrics.ts                     ← novo: getARR(), getLtvCac(), getQuarterlyRevenue(year), getMonthlyRevenue(year)
src/assets/pitch-deck/           ← imagens extraídas do PDF (via lovable-assets)
  *.asset.json
```

Novos helpers em `metrics.ts`:
- `getARR(model, year)` — soma MRR de dezembro de produtos recorrentes × 12
- `getLtvCac(model)` — usa CAC e ticket médio × duração esperada de retenção
- `getMonthlyRevenue(model, year)` — array com 12 valores reais
- `getYearsRange(start, end)` — gera labels p/ gráficos dinâmicos

Sem mudanças no engine ou no banco. Sem nova migration. Apenas:
- 1 arquivo novo (`metrics.ts`)
- 3 componentes de chart novos
- 1 reescrita de `slides.tsx`
- N assets de imagem

---

## Fora deste plano

- Não mudo o `calculationsEngine` (todos os números já existem lá).
- Não recrio a tabela `pitch_deck_overrides` (continua igual).
- Não troco o estilo visual (manteremos o design system O2 — sua escolha foi "Híbrido").
- NPS continua override manual (não existe dado de NPS no sistema). Se quiser, posso depois criar uma tabela `nps_responses` — mas isso fica fora deste escopo.
