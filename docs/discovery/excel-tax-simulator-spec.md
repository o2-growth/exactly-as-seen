# Simulador Tributário O2 — Complete Specification

> Fonte: `/Users/macos/Downloads/Simulador_Tributario_O2.xlsx`
> Autor da análise: Atlas (Business Analyst)
> Data: 2026-04-10

---

## TL;DR

- É um **simulador de carga tributária exclusivamente no regime de Lucro Presumido** para a O2 Inc., modelando 22 subcategorias de receita agrupadas em 5 categorias (CaaS, SaaS, Education, Expansão, Tax).
- A lógica central é: cada receita é classificada em um **perfil tributário** (P1..P8), que define o % de presunção (IRPJ/CSLL) e alíquotas de PIS/COFINS/ISS/ICMS; blends de até 3 perfis permitem simular produtos mistos (ex.: serviço + e-book).
- Serve três decisões: (1) estimar imposto de uma receita pontual (aba `Simulador`), (2) planejar o mix anual de toda a empresa (aba `Planejamento` + `Resumo`) e (3) comparar 3 cenários lado a lado (aba `Comparador`).
- O "truque fiscal" do modelo é **transformar parte da receita de serviço (32% presunção, tributação agressiva) em receita de editora/livro (8-12% presunção + alíquota zero de PIS/COFINS)** via blends com e-book (P6) ou material didático (P7).
- Projeção é **anual, regime único, sem multi-ano e sem comparação Lucro Real/Simples** — o escopo é estritamente "qual blend de perfis dá menor carga dentro do Presumido".

---

## Estrutura do arquivo

| Tab | Rows × Cols | Merges | Fórmulas | Papel |
|---|---|---|---|---|
| `Simulador` | 47 × 9 | 27 | 139 | Simulação unitária (1 receita, até 3 componentes) |
| `Planejamento` | 79 × 16 | 144 | 308 | Planejamento anual de TODAS as 22 subcategorias |
| `Resumo` | 48 × 7 | 23 | 147 | Consolidação automática do Planejamento |
| `Comparador` | 29 × 8 | 77 | 41 | Lado-a-lado de 3 cenários |
| `Premissas` | 22 × 9 | 10 | 0 | Catálogo de perfis + constantes (editável) |
| `Mapeamento` | 48 × 15 | 2 | 45 | Lookup categoria→sub→cenário→composição |
| `Premissas Legais` | 22 × 5 | 11 | 0 | Base legal de cada perfil (documentação) |

**Nomes definidos (Named Ranges):**

| Nome | Célula | Valor | Uso |
|---|---|---|---|
| `IRPJ_BASE` | `Premissas!E16` | 0,15 | Alíquota IRPJ base (15%) |
| `ADIC_RATE` | `Premissas!E17` | 0,10 | Adicional IRPJ (10%) |
| `CSLL_BASE` | `Premissas!E18` | 0,09 | Alíquota CSLL base (9%) |
| `ADIC_LIMIT` | `Premissas!E19` | 20.000 | Limite mensal p/ adicional IRPJ |
| `MESES` | `Premissas!E20` | 12 | Meses no ano |
| `MODO_ADIC` | `Premissas!E21` | "ORIGINAL" ou "CORRETO" | Seleciona fórmula do adicional IRPJ |

Total de fórmulas: **680** (dominadas por repetição vertical da mesma lógica ~22 subcategorias × 3 componentes).

---

## Inputs (entradas manuais do usuário)

### Aba `Simulador`
| Cell | Label | Tipo | Exemplo |
|---|---|---|---|
| `C4` | 1. CATEGORIA | dropdown (CaaS/SaaS/Education/Expansão/Tax) | "CaaS" |
| `C5` | 2. SUBCATEGORIA | dropdown (depende de C4) | "Serviços Especializados" |
| `C6` | 3. CENÁRIO | dropdown (depende de C4+C5) | "Puro — CaaS" |
| `C7` | 4. RECEITA ANUAL (R$) | número | 10.000.000 |

### Aba `Planejamento`
| Cell | Label | Tipo | Exemplo |
|---|---|---|---|
| `C4` | MODO DE RECEITA | dropdown: "RECEITA PRÓPRIA" \| "DISTRIBUIÇÃO %" | "RECEITA PRÓPRIA" |
| `J4` | RECEITA TOTAL O2 (só se DISTRIBUIÇÃO %) | número | 10.000.000 |
| `D8..D71` | Cenário por subcategoria (22 dropdowns) | texto | "Blend CaaS + E-book (50/50)" |
| `E8..E73` | Perfil ID (editável p/ blend Custom) | texto P1..P8 | "P1" |
| `G8..G73` | % do Mix (editável p/ blend Custom) | 0..1 | 0,5 |
| `H8,H11,H14,...` | Receita da subcategoria (ou % se modo DISTRIBUIÇÃO) | número | 1.000.000 |

(22 subcategorias × 3 linhas A/B/C = 66 linhas de componentes, rows 8 a 73)

### Aba `Comparador`
| Cell | Label | Tipo | Exemplo |
|---|---|---|---|
| `C4` | Receita anual | número | 10.000.000 |
| `C7,E7,G7` | Categoria cenários 1/2/3 | dropdown | "CaaS" |
| `C8,E8,G8` | Subcategoria cenários 1/2/3 | dropdown | "Serviços Especializados" |
| `C9,E9,G9` | Cenário cenários 1/2/3 | dropdown | "Puro — CaaS" |

### Aba `Premissas` (editável para ajustes fiscais)
| Cell | Label | Tipo | Default |
|---|---|---|---|
| `C5..C12` | % Presunção IRPJ por perfil | % | 0,32 ou 0,08 |
| `D5..D12` | % Presunção CSLL por perfil | % | 0,32 ou 0,12 |
| `E5..E12` | Alíquota PIS por perfil | % | 0 ou 0,0065 |
| `F5..F12` | Alíquota COFINS por perfil | % | 0 ou 0,03 |
| `G5..G12` | Alíquota ISS por perfil | % | 0..0,05 |
| `H5..H12` | Alíquota ICMS por perfil | % | 0 |
| `E16..E21` | Constantes (IRPJ, CSLL, adic, meses, modo) | vários | ver Named Ranges |

---

## Outputs (resultados finais)

### `Simulador`
| Cell | Label | Significado |
|---|---|---|
| `D44` | Receita Total | = `C7` |
| `D45` | Imposto Total | Soma dos impostos dos 3 componentes (`G25+G33+G41`) |
| `D46` | Receita Líquida | `D44 - D45` |
| `D47` | **Alíquota Efetiva Total** | `D45/D44` (KPI principal) |

### `Resumo`
| Cell | Label |
|---|---|
| `D5` | Receita Total Anual |
| `D6` | Imposto Total Anual |
| `D7` | Receita Líquida Anual |
| `D8` | Alíquota Efetiva Média |
| `D11` | Cenário baseline "tudo CaaS/Tax" (16,57%) |
| `D12` | Cenário planejado atual |
| `D13` | **ECONOMIA ANUAL** |
| `D14` | **% de redução tributária** |
| `A18..G39` | Detalhe por subcategoria |
| `A44..F48` | Sub-totais por categoria (CaaS/SaaS/Education/Expansão/Tax) |

### `Comparador`
| Cell | Label |
|---|---|
| `C24,E24,G24` | Imposto total por cenário |
| `C25,E25,G25` | Receita líquida por cenário |
| `C26,E26,G26` | Alíquota efetiva por cenário |
| `C28` | **MELHOR CENÁRIO** (menor alíquota, via INDEX/MATCH) |
| `C29` | Economia vs pior cenário |

---

## Regimes tributários modelados

**Um único regime: Lucro Presumido.**

O título da aba `Simulador` é explícito: "SIMULADOR TRIBUTÁRIO O2 INC. - LUCRO PRESUMIDO". Não há:

- Lucro Real (não há base real, despesas dedutíveis, crédito PIS/COFINS não-cumulativo)
- Simples Nacional (sem Anexos, sem faixas por faturamento)
- Comparação entre regimes
- IBS/CBS / Reforma Tributária (mencionada só como nome de subcategoria de consultoria "Reforma Tributária", mas não modelada)

O que ele **compara** é: dentro do Lucro Presumido, qual a menor carga quando se classifica a receita como serviço (presunção 32%) vs. livro/material didático (presunção 8%/12% + alíquota zero PIS/COFINS).

---

## Tributos modelados

| Tributo | Alíquota | Base | Fórmula típica |
|---|---|---|---|
| **IRPJ** | 15% (`IRPJ_BASE`) | Receita × % presunção | `(receita × pres_irpj) × 0,15` |
| **AD.IRPJ** | 10% (`ADIC_RATE`) | (Base presumida − R$240k) ou (IRPJ pago − R$240k) | ver regra do `MODO_ADIC` abaixo |
| **CSLL** | 9% (`CSLL_BASE`) | Receita × % presunção CSLL | `(receita × pres_csll) × 0,09` |
| **PIS** | 0,65% (cumulativo) ou 0% (imunidade livro) | Receita bruta | `receita × PIS` |
| **COFINS** | 3% (cumulativo) ou 0% (imunidade livro) | Receita bruta | `receita × COFINS` |
| **ISS** | 0% / 2% / 2,9% / 5% | Receita bruta | `receita × ISS` |
| **ICMS** | 0% em todos os perfis | Receita bruta | `receita × ICMS` |

**Alíquotas de PIS/COFINS hard-coded como regime cumulativo** (0,65% + 3%) — confirmando Lucro Presumido. Não há créditos de PIS/COFINS (regime não-cumulativo do Lucro Real ausente).

Não modelado: INSS patronal, FGTS, IBS, CBS, IPI.

### Catálogo de perfis tributários (`Premissas!A5:H12`)

| ID | Perfil | % IRPJ | % CSLL | PIS | COFINS | ISS | ICMS | Observação |
|---|---|---|---|---|---|---|---|---|
| P1 | CaaS / Tax | 32% | 32% | 0,65% | 3% | 5% | 0 | Serviço — ISS 5% (POA) |
| P2 | Franquia | 32% | 32% | 0,65% | 3% | 5% | 0 | Royalties + serviços |
| P3 | SaaS Tech | 32% | 32% | 0,65% | 3% | 2,9% | 0 | ISS 2,9% software POA |
| P4 | Education | 32% | 32% | 0,65% | 3% | 2% | 0 | Mentoria/Curso |
| P5 | Cessão de Direitos | 32% | 32% | 0,65% | 3% | 5% | 0 | Direitos autorais |
| P6 | E-book | **8%** | **12%** | 0,65% | 3% | 0 | 0 | Livro digital não equiparado |
| P7 | Material Didático | **8%** | **12%** | **0** | **0** | 0 | 0 | Editora — PIS/COFINS zero (Lei 10.865/04) |
| P8 | Livro Físico | **8%** | **12%** | **0** | **0** | 0 | 0 | Imunidade constitucional |

---

## Fórmulas-chave (transcritas)

### 1. Cálculo de imposto por componente (Planejamento!J8 — mesma forma replicada em J9..J73 e G18..G40 do Simulador)

```
=IF(OR(E8="",I8=0),0,
  (
    (I8 * VLOOKUP(E8,Premissas!$A$5:$H$12,3,FALSE)) * IRPJ_BASE
  )
  + IF(MODO_ADIC="ORIGINAL",
      MAX(0, ((I8*VLOOKUP(E8,...,3,FALSE))*IRPJ_BASE) - ADIC_LIMIT*MESES) * ADIC_RATE,
      MAX(0, (I8*VLOOKUP(E8,...,3,FALSE)) - ADIC_LIMIT*MESES) * ADIC_RATE
    )
  + (I8 * VLOOKUP(E8,...,4,FALSE)) * CSLL_BASE
  + I8 * (
      VLOOKUP(E8,...,5,FALSE) + VLOOKUP(E8,...,6,FALSE)
    + VLOOKUP(E8,...,7,FALSE) + VLOOKUP(E8,...,8,FALSE)
    )
)
```

**Decomposição em português:**

| Termo | Significado |
|---|---|
| `I8 × pres_irpj × 0,15` | IRPJ base = (Receita alocada × presunção IRPJ) × 15% |
| `MAX(0, base_ou_irpj − 240k) × 10%` | Adicional IRPJ (lógica depende de MODO_ADIC) |
| `I8 × pres_csll × 0,09` | CSLL = (Receita × presunção CSLL) × 9% |
| `I8 × (PIS+COFINS+ISS+ICMS)` | Tributos cumulativos diretos sobre receita |

**Dependências:** `E8` (perfil ID), `I8` (receita alocada), `Premissas!A5:H12` (catálogo), `IRPJ_BASE`, `CSLL_BASE`, `ADIC_RATE`, `ADIC_LIMIT`, `MESES`, `MODO_ADIC`.

### 2. Modo AD.IRPJ (duas interpretações)

```
"ORIGINAL" → adicional = MAX(0, IRPJ_base_pago − 240k) × 10%
"CORRETO"  → adicional = MAX(0, base_presumida_anual − 240k) × 10%
```

Comentário em `Premissas!A22`: _"ORIGINAL = (IRPJ pago − R$240k) × 10% | CORRETO = (Base anual − R$240k) × 10%"_.

Nota tributária: a lei diz que o adicional incide sobre a **base de cálculo** (lucro presumido) que exceder R$240k/ano, não sobre o IRPJ apurado. O modo "ORIGINAL" é formalmente incorreto mas foi preservado por compatibilidade com a versão anterior do modelo; o modo "CORRETO" reflete a legislação.

### 3. Alocação de receita (Planejamento!I8)

```
=IF($C$4="RECEITA PRÓPRIA", H8*G8, $J$4*H8*G8)
```

Se modo = "RECEITA PRÓPRIA": receita alocada ao componente = receita_subcategoria × %_mix. Se "DISTRIBUIÇÃO %": receita alocada = receita_total_O2 × %_subcategoria × %_mix.

### 4. Composição do cenário (Simulador!H4, Comparador!C10/E10/G10)

```
=IFERROR(INDEX(Mapeamento!D:D, MATCH(C4&"|"&C5&"|"&C6, Mapeamento!E:E, 0)), "—")
```

Busca na tabela `Mapeamento` a string de composição (ex.: `"P1 50% + P6 50%"`) correspondente à combinação Categoria|Subcategoria|Cenário.

### 5. Parsing da string de composição (Simulador!C11..C13, E11..E13)

Fórmulas em cascata usando `LEFT/MID/FIND/SUBSTITUTE` para extrair até 3 pares (Perfil, %) da string `"Pn XX% + Pm YY% + Pq ZZ%"`. Exemplo do componente A:

```
C11 = IFERROR(LEFT(H4, FIND(" ",H4)-1), "")                  → "P1"
E11 = IFERROR(VALUE(MID(H4, FIND(" ",H4)+1,
       FIND("%",H4)-FIND(" ",H4)-1))/100, 1)                  → 0,5
F11 = $C$7 * E11                                              → receita alocada do componente A
```

### 6. Consolidação anual (Resumo!D5)

```
=SUMPRODUCT((Planejamento!C8:C73="A")*Planejamento!I8:I73)
+SUMPRODUCT((Planejamento!C8:C73="B")*Planejamento!I8:I73)
+SUMPRODUCT((Planejamento!C8:C73="C")*Planejamento!I8:I73)
```

Soma receitas alocadas dos 3 componentes A/B/C através das 22 subcategorias.

### 7. Baseline "tudo CaaS" e economia (Resumo!D11, D13, D14)

```
D11 = D5 * 0,1657      → hipótese: toda receita tributada como P1 → alíquota efetiva 16,57%
D12 = D6                → imposto do cenário planejado atual
D13 = D11 - D12         → economia anual absoluta
D14 = D13 / D11         → % de redução
```

**Observação crítica**: `16,57%` é **hard-coded** — é a alíquota efetiva de uma receita 100% P1 (CaaS/Tax) sobre receita bruta com base 32%. Se qualquer alíquota de P1 mudar em `Premissas`, o baseline `D11` ficará defasado.

### 8. Escolha do melhor cenário (Comparador!C28)

```
=INDEX({"CENÁRIO 1","CENÁRIO 2","CENÁRIO 3"},
       MATCH(MIN(C26,E26,G26), {0,0,0}+CHOOSE({1,2,3},C26,E26,G26), 0))
```

Retorna o rótulo do cenário com menor alíquota efetiva.

### 9. Sub-totais por categoria (Resumo!C44:E48)

```
C44 = SUMIF(A18:A39,"CaaS",D18:D39)   → receita CaaS
D44 = SUMIF(A18:A39,"CaaS",E18:E39)   → imposto CaaS
E44 = D44/C44                          → alíquota efetiva CaaS
```

Repetido para SaaS, Education, Expansão, Tax.

---

## Regras de negócio críticas

1. **Um único regime tributário (Lucro Presumido cumulativo)** — PIS 0,65%, COFINS 3%, sem crédito. Alterar isso exige reescrever o catálogo inteiro.

2. **Presunção binária "serviço vs. editora"** — todos os perfis caem em 32%/32% (serviço) ou 8%/12% (mercadoria/livro). Não há presunção intermediária.

3. **Blends de até 3 componentes** por cenário — a string `"Pn XX% + Pm YY% + Pq ZZ%"` é a única forma de expressar mix; a soma das porcentagens **deve fechar 100%** por subcategoria (nota em `Planejamento!A79`).

4. **Adicional IRPJ tem duas interpretações alternáveis** (`MODO_ADIC = ORIGINAL | CORRETO`), ambas preservadas no modelo. A versão "ORIGINAL" calcula o adicional sobre o IRPJ pago (errado juridicamente); a "CORRETO" sobre a base (correto).

5. **Limite de isenção do adicional = R$240k/ano** (R$20k × 12), aplicado **por componente, não por empresa** — isso significa que a fórmula calcula o adicional em cada linha de forma independente, e o limite de isenção é "consumido" integralmente por cada componente. Em um planejamento anual onde a mesma CNPJ tem 66 componentes, cada um recebe R$240k de isenção, o que **subestima o AD.IRPJ real** (no mundo real há um único limite de R$240k/ano para toda a pessoa jurídica).

6. **PIS/COFINS zero/imunidade (P7, P8)** depende de premissas legais rígidas: ISBN, registro de editora, CNAE de edição, industrialização própria (não por encomenda). A aba `Premissas Legais` documenta isso mas o simulador apenas confia que o usuário escolheu o perfil correto.

7. **Baseline de economia hard-coded em 16,57%** — se a alíquota de P1 mudar, o cálculo de "economia vs tudo CaaS" fica inconsistente.

8. **ISS depende de município** — valores hard-coded para Porto Alegre (POA): CaaS 5%, SaaS 2,9%, Education 2%. Fora de POA, precisa recalibrar.

9. **ICMS = 0 em todos os perfis** — o modelo assume que a O2 não vende mercadoria tributada por ICMS (ou que a imunidade/alíquota zero cobre os livros).

10. **Temporalidade = 1 ano cheio** — não há projeção multi-ano, não há sazonalidade mensal, não há ajustes por mês-a-mês. Tudo é anualizado.

---

## Integrações necessárias com o dashboard atual

### O que o módulo precisa RECEBER do `FinancialModelContext`:

1. **Receita bruta anual por subcategoria** — hoje o dashboard tem receita por BU (CaaS, SaaS, Education, BaaS, Tax) mas precisa descer até a subcategoria (22 subcategorias). Se o dashboard só tem BU, o usuário precisará alocar manualmente.
2. **Mapeamento "produto/contrato → subcategoria → perfil tributário default"** — novo. Não existe no dashboard.
3. **Modo de receita** — opcional: se o dashboard já tem receita histórica + projetada, pode ser usado direto; a aba `Planejamento` oferece também "DISTRIBUIÇÃO %" para simulações hipotéticas.

### O que o módulo precisa EXPOR de volta para o dashboard:

1. **Imposto total anual estimado** → alimenta DRE projetada (linha de impostos sobre receita)
2. **Alíquota efetiva média** → KPI no header do dashboard
3. **Economia vs baseline** → card de "otimização fiscal"
4. **Breakdown por categoria** (5 BUs) → gráfico de contribuição tributária
5. **Recomendação de melhor cenário** (do `Comparador`) → alerta/sugestão

### Campos novos a criar:

- `TaxProfile` enum: P1..P8
- `TaxScenario` entidade: (categoria, subcategoria, nome, composição[])
- `TaxComposition`: array de `{ profileId, pctMix }` (1-3 itens)
- `TaxAssumptions`: catálogo editável (equivalente à aba `Premissas`)
- `TaxResult`: por subcategoria → imposto, alíquota efetiva, breakdown por tributo

### Não precisa do dashboard:

- Folha de pagamento (não modelada)
- Custos/despesas (não há base real)
- Headcount (irrelevante para presumido)
- Créditos de PIS/COFINS (regime cumulativo)

---

## Perguntas em aberto (para esclarecer com o cliente)

1. **Qual `MODO_ADIC` deve ser o default no app?** "ORIGINAL" (retrocompat) ou "CORRETO" (legal)? Recomendação: "CORRETO" + toggle.

2. **O limite de R$240k/ano do adicional IRPJ deve ser aplicado por componente (como está hoje) ou consolidado por CNPJ?** A abordagem consolidada é a juridicamente correta, mas muda significativamente os resultados.

3. **Existe intenção de modelar Lucro Real em algum momento?** O título da aba é "LUCRO PRESUMIDO" mas a O2 pode cruzar o teto de R$78MM/ano e ser obrigada ao Lucro Real.

4. **A alíquota baseline 16,57% deve ser recalculada dinamicamente** a partir do catálogo de perfis, ou permanece hard-coded como "marca histórica"?

5. **ISS é multi-municipal?** Hoje só considera POA. Se a O2 emite nota em outras capitais, precisa parametrizar por município.

6. **As 22 subcategorias são definitivas?** O app precisa de CRUD para adicionar/remover subcategorias, ou a lista é fixa?

7. **Os cenários pré-definidos (Mapeamento!A4:D48, 45 combinações)** devem ser migrados 1:1 ou haverá novo catálogo?

8. **Reforma Tributária (IBS/CBS 2026-2033)** deve entrar nesta primeira versão ou fica fora do escopo? A aba só menciona como _nome de produto_, não como cálculo.

9. **Internacionalização** — mencionada em `Premissas Legais!A21` ("tributação fixa de USD 1.000/mês"). Está fora do escopo do simulador atual, mas pode ser parametrizada?

10. **Há intenção de versionamento dos cenários tributários?** (salvar simulação, comparar com simulação de 3 meses atrás, etc.)

---

## Complexidade estimada para portar

### Métricas brutas

- **680 fórmulas Excel**, mas com altíssima repetição (~3 templates + 66 repetições verticais)
- **~15 fórmulas únicas** na realidade (o restante é aplicação da mesma fórmula a linhas diferentes)
- **8 perfis tributários** (catálogo estático)
- **22 subcategorias × ~3 cenários/média = ~45 cenários pré-definidos** no `Mapeamento`
- **6 parâmetros globais** (`IRPJ_BASE`, `CSLL_BASE`, `ADIC_RATE`, `ADIC_LIMIT`, `MESES`, `MODO_ADIC`)

### Lógica única (não trivial)

1. Fórmula monstro de imposto por componente (15 termos, 5 VLOOKUPs, 1 IF aninhado) — **1 função TypeScript de ~40 linhas**
2. Parser da string de composição `"Pn XX% + Pm YY% + Pq ZZ%"` — **1 função regex simples**
3. Lookup categoria/sub/cenário → composição — **1 array de objetos com .find()**
4. Consolidação anual (soma por componente A/B/C) — **trivial com reduce**
5. Escolha do melhor cenário — **trivial com Math.min + findIndex**

### Complexidade: **MÉDIA-BAIXA**

**Justificativa:**
- A matemática é direta (multiplicação e soma; 1 único MAX para adicional IRPJ)
- Não há solver, goal-seek, ou lookup com interpolação
- A maior parte do volume é repetição estrutural (66 linhas de componentes = 22 subcategorias × 3 slots A/B/C), resolvida com `Array.map()`
- Não há dependências circulares entre abas — o fluxo é linear: `Premissas` → `Mapeamento` → `Simulador/Planejamento/Comparador` → `Resumo`
- Os dropdowns encadeados (Categoria → Subcategoria → Cenário) são UI work, não lógica tributária

**Esforço estimado:**
- **Backend/domínio (TS puro):** 2-3 dias
  - Tipos + catálogo de perfis
  - Engine de cálculo (função `calculateTax(revenue, composition[], assumptions)`)
  - Engine de planejamento (map sobre 22 subcategorias)
  - Engine de comparador (3x calculate + melhor)
  - Testes unitários comparando com valores do Excel (baseline: 10MM receita P1 = 1.657MM imposto)
- **UI (React):** 3-5 dias
  - Tela Simulador (1 receita, cascading dropdowns)
  - Tela Planejamento (tabela 22×5)
  - Tela Comparador (3 colunas)
  - Tela Resumo (KPIs + gráficos)
  - Tela Premissas (CRUD do catálogo)
- **Integração com FinancialModelContext:** 1-2 dias
- **Validação cruzada com cliente (reconciliar com Excel):** 1-2 dias

**Total: 7-12 dias de dev** (1 dev sênior), assumindo que o cliente confirme as 10 perguntas em aberto antes da implementação.

### Riscos

- **Baixo risco técnico** — matemática simples, sem surpresas
- **Médio risco de escopo** — cliente pode querer Lucro Real, IBS/CBS, ou drill-down multi-empresa depois
- **Alto risco de validação** — qualquer divergência de 0,01% vs Excel vai gerar desconfiança do cliente; testes unitários com valores idênticos ao Excel são mandatórios

---

## Anexo: Snapshot dos valores de referência (para testes)

Com os defaults da planilha (Receita = R$10.000.000, Cenário "Puro — CaaS", Perfil P1):

| Item | Valor |
|---|---|
| Base presumida IRPJ (10MM × 32%) | 3.200.000 |
| IRPJ (3,2MM × 15%) | 480.000 |
| AD.IRPJ ORIGINAL ((480k − 240k) × 10%) | 24.000 |
| CSLL (3,2MM × 9%) | 288.000 |
| PIS (10MM × 0,65%) | 65.000 |
| COFINS (10MM × 3%) | 300.000 |
| ISS (10MM × 5%) | 500.000 |
| ICMS | 0 |
| **Total imposto** | **1.657.000** |
| **Alíquota efetiva** | **16,57%** |

Com Planejamento default (22 subs × R$1MM = R$22MM, mix de cenários atual):
- Imposto total anual: R$2.108.250
- Alíquota efetiva média: 9,58%
- Baseline "tudo CaaS" (16,57%): R$3.645.400
- Economia anual: R$1.537.150
- % de redução: 42,17%

Esses números devem bater 1:1 no código reimplementado.
