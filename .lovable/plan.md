
## Visão geral

Criar uma página interna `/pitch-deck` que reproduz fielmente o template enviado (41 slides) com **dados ao vivo vindos da página Premissas e do motor de cálculos** — mesma identidade visual da plataforma (navy + verde, Space Grotesk/Inter). Toda mudança em premissa reflete imediatamente nos slides.

Para os "dois mundos" (dados sempre atualizados + possibilidade de ajuste manual), o deck terá **3 níveis de override**, todos opcionais e não-destrutivos:

1. **Auto** (padrão): valor vem direto do cálculo/premissa.
2. **Override de texto/copy** por slide: editar título, bullet, subtítulo, ou substituir um número.
3. **Reordenar / ocultar slides** sem apagar nada.

Tudo persistido em snapshot no banco (igual já fazemos com Premissas). Botão **"Resetar para dados ao vivo"** desfaz overrides quando quiser voltar à fonte da verdade.

## Estrutura da página

Rota: `/pitch-deck` (entra no sidebar abaixo de Valuation).

Layout:
```text
+--------------------------------------------------+
| Toolbar: [Editar] [Apresentar F5] [Export PPTX]  |
|          [Export PDF] [Resetar overrides]        |
+------+-------------------------------------------+
| Mini |                                           |
| navs |   Canvas 1920x1080 (escala responsiva)    |
| 1..41|   ScaledSlide component                   |
|      |                                           |
+------+-------------------------------------------+
```

- Sidebar de thumbnails (clique navega).
- Canvas central com slide escalado.
- Modo Apresentação fullscreen com setas/Espaço/Esc.
- Modo Edição: clique num campo destacado abre input inline → grava override.

## Mapeamento dos 41 slides → dados do sistema

Indico apenas os slides com dados dinâmicos. Os demais (capa, problema, metodologia, time, roadmap) ficam estáticos com copy editável.

| # | Slide | Fonte dos dados |
|---|---|---|
| 3 | Overview / KPIs | Crescimento YoY, MC%, LTV/CAC: `calculationsEngine` |
| 19 | Modelo de Negócio (tickets) | `assumptionsContext` (ticket por produto) |
| 22 | NPS / satisfação | Override manual (não temos no sistema) |
| 23 | KPIs Marketing & Comercial | Client analytics (CAC, LTV, conversão) |
| 24 | Evolução do Faturamento (R$000s) | Calc engine: receita bruta por trimestre |
| 25 | Evolução KPIs Financeiros | Calc engine: Receita Bruta trimestral |
| 26 | Investimento em Marketing | DRE: linha Marketing por período |
| 27 | Projeções FY25–FY28 | DRE: Receita Bruta, Lucro Bruto, EBITDA, Resultado Líquido anuais |
| 28 | Crescimento YoY | Calc engine: variação YoY dos indicadores |
| 29 | Resultados com todos produtos | DRE consolidada por ano + % Receita Líquida |
| 30 | Geração de caixa | Cash flow page |
| 37 | Múltiplos SaaS Capital | Estático (referência externa) |
| 39 | O2 = 10× ARR | ARR atual × 10 (calc engine) |

Para cada campo dinâmico mostrado no slide, renderizo `<DataField fieldId="…" />` que:
1. Lê valor do calc engine.
2. Se houver override no snapshot, mostra override + badge "editado".
3. Em modo edição, vira input.

## Persistência

Nova tabela `pitch_deck_overrides`:
```sql
CREATE TABLE public.pitch_deck_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  overrides jsonb NOT NULL DEFAULT '{}'::jsonb,
  slide_order jsonb,
  hidden_slides jsonb DEFAULT '[]'::jsonb,
  updated_at timestamptz DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pitch_deck_overrides TO authenticated;
GRANT ALL ON public.pitch_deck_overrides TO service_role;
ALTER TABLE public.pitch_deck_overrides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage own overrides" ON public.pitch_deck_overrides
  FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
```

Estrutura do JSON:
```json
{
  "slide_27.ebitda_2028": "25.735",
  "slide_3.kpi_crescimento": "210%"
}
```

## Export

- **PDF**: reaproveita `modern-screenshot` já no projeto, renderizando cada slide em sequência (mesma pipeline do `exportPdf.ts`).
- **PPTX**: usa a skill `pptx` (pptxgenjs) num gerador server-side simples — cada slide vira um slide PPTX editável no PowerPoint/Google Slides. Mantém títulos, bullets e tabelas como objetos editáveis (não imagem), para o usuário poder ajustar fora se quiser.

## Arquitetura técnica

```text
src/pages/PitchDeck.tsx              ← rota principal (editor + presenter)
src/components/pitch-deck/
  ScaledSlide.tsx                    ← container 1920x1080
  SlideLayout.tsx                    ← wrapper padrão
  DataField.tsx                      ← campo dinâmico c/ override
  ThumbnailStrip.tsx
  PresenterMode.tsx
  slides/
    Slide01_Capa.tsx
    Slide02_Intro.tsx
    ...
    Slide41_Obrigado.tsx
src/contexts/PitchDeckContext.tsx    ← carrega overrides, expõe get/set
src/lib/pitchDeck/
  fieldRegistry.ts                   ← mapeia fieldId → seletor no calc engine
  exportPptx.ts                      ← gerador PPTX (Edge Function)
supabase/functions/pitch-export-pptx/index.ts
```

## Etapas de implementação

1. Migration `pitch_deck_overrides` + grants/RLS.
2. `PitchDeckContext` (overrides + ordem + hidden) com auto-save.
3. `ScaledSlide` + `SlideLayout` + `DataField`.
4. Rota `/pitch-deck` + entrada no sidebar.
5. 41 componentes de slide refletindo o template (uso as imagens extraídas como referência visual).
6. Modo edição inline + toolbar.
7. Modo Apresentação fullscreen.
8. Export PDF (reaproveita pipeline existente).
9. Edge Function de export PPTX.
10. QA visual: render todos os slides com dados ao vivo, comparar lado-a-lado com o template enviado.

## Fora deste plano

- Não integramos com Pitch.com / Gamma / Google Slides (decidido: não vale o custo de manutenção).
- Não criamos colaboração multi-usuário no deck (overrides são por usuário).
- Slides 36–38 (citações SaaS Capital) ficam como copy estática editável — não há dado no sistema para automatizar.
