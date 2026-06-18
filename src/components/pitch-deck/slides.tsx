import { useFinancialModel } from '@/contexts/FinancialModelContext';
import { namedEmployees2025 } from '@/data/modelData';
import DataField from './DataField';
import { fmtThousands, fmtPct, fmtMillions } from '@/lib/pitchDeck/fieldRegistry';
import {
  yoy, yearsRange, getMonthlyGrossRevenue, getARR, getLtvCac,
} from '@/lib/pitchDeck/metrics';

import pdfSlide06 from '@/assets/pitch-deck/pdf-slide-06-problema.jpg.asset.json';
import pdfSlide08 from '@/assets/pitch-deck/pdf-slide-08-metodologia.jpg.asset.json';
import pdfSlide19 from '@/assets/pitch-deck/pdf-slide-19-modelo.jpg.asset.json';
import pdfSlide20 from '@/assets/pitch-deck/pdf-slide-20-time.jpg.asset.json';
import pdfSlide21 from '@/assets/pitch-deck/pdf-slide-21-time-usa.jpg.asset.json';

const GREEN = '#6BF169';
const NAVY = '#0f172a';
const NAVY_2 = '#1e293b';
const MUTED = '#94a3b8';
const TEXT = '#cbd5e1';

const H1: React.CSSProperties = { fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700, fontSize: 96, lineHeight: 1.02, letterSpacing: '-0.04em' };
const H2: React.CSSProperties = { fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700, fontSize: 60, lineHeight: 1.05, letterSpacing: '-0.03em' };
const H3: React.CSSProperties = { fontFamily: 'Space Grotesk, sans-serif', fontWeight: 600, fontSize: 36, lineHeight: 1.15 };
const BODY: React.CSSProperties = { fontFamily: 'Inter, sans-serif', fontSize: 26, lineHeight: 1.4 };
const SMALL: React.CSSProperties = { fontFamily: 'Inter, sans-serif', fontSize: 20, lineHeight: 1.35 };
const KICKER: React.CSSProperties = { fontFamily: 'Space Grotesk, sans-serif', fontSize: 22, letterSpacing: '0.18em', textTransform: 'uppercase', color: GREEN, fontWeight: 600 };

function GreenBar({ w = 80 }: { w?: number }) {
  return <div style={{ width: w, height: 6, background: GREEN, marginTop: 24, marginBottom: 24 }} />;
}

function Pad({ children, p = '160px 160px 120px' }: { children: React.ReactNode; p?: string }) {
  return <div className="absolute inset-0 flex flex-col" style={{ padding: p }}>{children}</div>;
}

function PadCenter({ children, p = '0 160px' }: { children: React.ReactNode; p?: string }) {
  return <div className="absolute inset-0 flex flex-col justify-center" style={{ padding: p }}>{children}</div>;
}

// ── Slide 1: Capa ───────────────────────────────────────────────────────────
export const Slide01 = () => (
  <PadCenter p="0 160px">
    <div style={KICKER}>2025</div>
    <h1 style={{ ...H1, fontSize: 156, color: '#fff', marginTop: 24 }}>O2 INC.</h1>
    <h2 style={{ ...H2, color: GREEN, marginTop: 40, fontSize: 64 }}>
      <DataField fieldId="s01.tagline" liveValue="O futuro das finanças, HOJE!" />
    </h2>
    <p style={{ ...BODY, color: MUTED, marginTop: 32, fontSize: 30 }}>
      <DataField fieldId="s01.subtagline" liveValue="Metodologia, Tecnologia e IA." />
    </p>
  </PadCenter>
);

// ── Slide 2: Ecossistema (4 pilares) ────────────────────────────────────────
export const Slide02 = () => (
  <PadCenter p="0 160px">
    <div style={KICKER}>O Ecossistema</div>
    <h1 style={{ ...H2, color: '#fff', marginTop: 24, marginBottom: 60 }}>
      <DataField fieldId="s02.title" liveValue="O futuro das finanças, hoje." />
    </h1>
    <div className="grid grid-cols-4 gap-6">
      {[
        ['CFO as a Service', 'Estratégia financeira sênior, sob demanda.'],
        ['Primeiro CFO 24/7 do Brasil', 'IA proprietária treinada em finanças corporativas.'],
        ['Primeiro BPO 4.0 no WhatsApp', 'Automação dos 5 processos financeiros críticos.'],
        ['Smart Banking', 'Conta digital PJ integrada e conciliação multibancos.'],
      ].map(([t, d], i) => (
        <div key={i} style={{ background: NAVY_2, borderTop: `4px solid ${GREEN}`, padding: 32, borderRadius: 12 }}>
          <div style={{ ...H3, color: '#fff', fontSize: 28 }}>
            <DataField fieldId={`s02.card${i}.title`} liveValue={t} />
          </div>
          <p style={{ ...BODY, color: MUTED, marginTop: 16, fontSize: 22 }}>
            <DataField fieldId={`s02.card${i}.desc`} liveValue={d} />
          </p>
        </div>
      ))}
    </div>
  </PadCenter>
);

// ── Slide 3: Overview / KPIs ────────────────────────────────────────────────
export const Slide03 = () => {
  const { model } = useFinancialModel();
  const r2024 = model.years[2024]?.grossRevenue ?? 0;
  const r2025 = model.years[2025]?.grossRevenue ?? 0;
  const r2026 = model.years[2026]?.grossRevenue ?? 0;
  const growth = yoy(r2025, r2024);
  const mult2026 = r2024 > 0 ? r2026 / r2024 : 0;
  const cmPct = model.years[2025]?.contributionMarginPct ?? 0;
  const ltvCac = getLtvCac(model, 2025);
  return (
    <Pad>
      <div style={KICKER}>Overview</div>
      <h2 style={{ ...H2, color: '#fff', marginTop: 12 }}>
        A plataforma de inteligência financeira do empreendedor
      </h2>
      <p style={{ ...BODY, color: TEXT, marginTop: 20, maxWidth: 1500, fontSize: 24 }}>
        <DataField fieldId="s03.desc" liveValue="Conexão de dados, inteligência estratégica e execução financeira automatizada — em uma única plataforma. Empreendedores decidem com dados, em tempo real, sem a complexidade dos modelos tradicionais." />
      </p>
      <div style={{ ...KICKER, color: '#fff', marginTop: 32, fontSize: 20 }}>KPIs</div>
      <div className="grid grid-cols-3 gap-5 mt-4">
        {[
          { label: `Crescimento YoY 2024→2025`, value: growth, fid: 's03.k.growth', fmt: (v: number) => `${v.toFixed(0)}%` },
          { label: 'Receita 2026 vs 2024', value: mult2026, fid: 's03.k.mult', fmt: (v: number) => `${v.toFixed(1)}x` },
          { label: 'Margem de Contribuição 2025', value: cmPct, fid: 's03.k.cm', fmt: (v: number) => `${v.toFixed(0)}%` },
          { label: 'LTV / CAC', value: ltvCac, fid: 's03.k.ltvcac', fmt: (v: number) => v.toFixed(2) },
          { label: 'R$ investidos em produto (4 anos)', value: 'R$ 3MM', fid: 's03.k.invest' },
          { label: 'Faturamento anual dos clientes', value: '+R$ 2 bi', fid: 's03.k.cliRev' },
        ].map((k, i) => (
          <div key={i} style={{ background: NAVY_2, padding: 24, borderRadius: 10, borderLeft: `5px solid ${GREEN}` }}>
            <div style={{ ...H1, color: GREEN, fontSize: 56, lineHeight: 1 }}>
              <DataField fieldId={k.fid} liveValue={k.value as any} format={k.fmt as any} />
            </div>
            <div style={{ ...BODY, color: TEXT, marginTop: 8, fontSize: 20 }}>{k.label}</div>
          </div>
        ))}
      </div>
    </Pad>
  );
};

// ── Slide 4: Por que existimos ──────────────────────────────────────────────
export const Slide04 = () => (
  <PadCenter p="0 200px">
    <div style={KICKER}>O Problema</div>
    <h1 style={{ ...H2, color: '#fff', marginTop: 24, fontSize: 72 }}>
      <DataField fieldId="s04.title" liveValue="Nascemos para resolver um grande problema do empreendedor" />
    </h1>
    <p style={{ ...BODY, color: TEXT, marginTop: 48, maxWidth: 1500, fontSize: 32 }}>
      <DataField fieldId="s04.p1" liveValue="Toda empresa possui um setor financeiro e todas precisam de um financeiro estratégico para sobreviver…" />
    </p>
    <p style={{ ...BODY, color: GREEN, marginTop: 32, maxWidth: 1500, fontSize: 32 }}>
      <DataField fieldId="s04.p2" liveValue="…mas montar um setor financeiro estratégico dentro da empresa é complexo e muito caro." />
    </p>
  </PadCenter>
);

// ── Slide 5: Estatística ────────────────────────────────────────────────────
export const Slide05 = () => (
  <PadCenter p="0 200px">
    <div style={KICKER}>O Efeito de Não Ter Gestão</div>
    <h1 style={{ ...H1, color: '#fff', marginTop: 24, fontSize: 88 }}>
      <DataField fieldId="s05.title" liveValue="Mais de" />{' '}
      <span style={{ color: GREEN }}><DataField fieldId="s05.stat" liveValue="2 milhões" /></span>
    </h1>
    <h2 style={{ ...H2, color: '#fff', marginTop: 8, fontSize: 60 }}>
      <DataField fieldId="s05.subtitle" liveValue="de empresas fecham as portas por ano no Brasil." />
    </h2>
    <div className="grid grid-cols-3 gap-6 mt-16">
      {[
        ['Serasa', '54,9% dos endividados são do setor de serviços.'],
        ['Sebrae', '48% das novas empresas fecham nos 3 primeiros anos.'],
        ['Sebrae', 'Gestão ineficiente é a 2ª maior causa de mortalidade.'],
      ].map(([src, t], i) => (
        <div key={i} style={{ background: NAVY_2, padding: 24, borderRadius: 10, borderTop: `3px solid ${GREEN}` }}>
          <div style={{ ...KICKER, fontSize: 16, color: GREEN }}>{src}</div>
          <p style={{ ...BODY, color: TEXT, marginTop: 12, fontSize: 22 }}>
            <DataField fieldId={`s05.src${i}`} liveValue={t} />
          </p>
        </div>
      ))}
    </div>
  </PadCenter>
);

// ── Slide 6: Sistematizando o problema (tabela 5x3) ────────────────────────
export const Slide06 = () => {
  const cols = ['Processos', 'Dados Fidedignos', 'Informações Inteligentes', 'Análise Estratégica', 'Plano de Ação Efetivo'];
  const empreendedor = [
    'Não possui processos mapeados, não sabe como sua equipe trabalha. Percebe desorganização e fica incomodado.',
    'Não sabe onde buscar informações. Tenta montar análises, perde tempo e dinheiro.',
    'Toma decisões baseadas em feeling. Quando consegue uma análise, não é confiável.',
    'Não tem rituais de análise. Decisões empíricas baseadas em poucos números.',
    'Sempre executando, sem análise estratégica. Erra muito, retrabalha e se afoga no operacional.',
  ];
  const gestor = [
    'Perde tempo em processos ineficientes; não sustenta a operação em crescimento.',
    'Guarda dados em planilhas, blocos, word. Usa ERP de maneira errada (quando há).',
    'Tenta atender o empreendedor, mas falta qualidade e velocidade.',
    'Sem conhecimento técnico de finanças corporativas estratégicas. Traz o problema sem solução.',
    'Ajuda em plano inconsistente; resolve de forma paliativa.',
  ];
  return (
    <Pad p="120px 80px 100px">
      <div style={KICKER}>Diagnóstico</div>
      <h2 style={{ ...H2, color: '#fff', marginTop: 8, fontSize: 52 }}>Sistematizando o problema</h2>
      <p style={{ ...SMALL, color: MUTED, marginTop: 4 }}>Experiência descentralizada e cara</p>
      <div className="grid grid-cols-5 gap-3 mt-8">
        {cols.map((c, i) => (
          <div key={i} style={{ background: GREEN, color: NAVY, padding: 12, borderRadius: 6, fontWeight: 700, fontSize: 18, textAlign: 'center', fontFamily: 'Space Grotesk' }}>{c}</div>
        ))}
      </div>
      {[
        { label: 'Empreendedor', rows: empreendedor, id: 'emp' },
        { label: 'Gestor Financeiro', rows: gestor, id: 'ges' },
      ].map(({ label, rows, id }, ri) => (
        <div key={id} className="grid grid-cols-5 gap-3 mt-3 flex-1">
          {rows.map((r, ci) => (
            <div key={ci} style={{ background: NAVY_2, padding: 14, borderRadius: 6, fontSize: 14, color: TEXT, lineHeight: 1.35, position: 'relative' }}>
              {ci === 0 && (
                <div style={{ color: GREEN, fontWeight: 700, marginBottom: 6, fontSize: 16, fontFamily: 'Space Grotesk' }}>{label}</div>
              )}
              <DataField fieldId={`s06.${id}.${ci}`} liveValue={r} />
            </div>
          ))}
        </div>
      ))}
    </Pad>
  );
};

// ── Slide 7: Custo da estratégia errada (do headcount real) ─────────────────
export const Slide07 = () => {
  // Buscamos no namedEmployees2025 os salários reais dos cargos equivalentes
  const findSalary = (role: string, fallback: number) => {
    const found = namedEmployees2025.find(e => e.role === role);
    return found?.salary ?? fallback;
  };
  // Para "CFO" pega o maior salário (sênior). Para FP&A pega o médio.
  const cfoSalary = Math.max(...namedEmployees2025.filter(e => e.role === 'CFO').map(e => e.salary));
  const fpaSalary = Math.round(namedEmployees2025.filter(e => e.role === 'FP&A').reduce((s, e) => s + e.salary, 0) / Math.max(1, namedEmployees2025.filter(e => e.role === 'FP&A').length));
  const ctoSalary = findSalary('CTO', 18000);
  const itSalary = Math.max(...namedEmployees2025.filter(e => e.bu === 'IT').map(e => e.salary), 0) || 8500;

  const items: [string, number][] = [
    ['1 CFO sênior', cfoSalary],
    ['1 Diretor de Tecnologia (CTO)', ctoSalary],
    ['1 Desenvolvedor/Programador', itSalary],
    ['1 Analista de Dados', 6500],
    ['1 Analista Financeiro', 6500],
    ['1 Analista de FP&A', fpaSalary],
    ['ERP, Pacote Office e Power BI', 2500],
  ];
  const total = items.reduce((s, [, v]) => s + v, 0);
  return (
    <Pad p="140px 200px 100px">
      <div style={KICKER}>O Custo da Estratégia Errada</div>
      <h2 style={{ ...H2, color: '#fff', marginTop: 12 }}>Quanto custa montar um setor financeiro estratégico?</h2>
      <div className="mt-8" style={{ background: NAVY_2, borderRadius: 12, padding: 32 }}>
        {items.map(([label, v], i) => (
          <div key={i} className="flex justify-between items-center py-3" style={{ borderBottom: '1px solid #334155', ...BODY, color: TEXT, fontSize: 24 }}>
            <span><DataField fieldId={`s07.it${i}.label`} liveValue={label} /></span>
            <span style={{ fontWeight: 600 }}>R$ <DataField fieldId={`s07.it${i}.val`} liveValue={v} format={fmtThousands} /></span>
          </div>
        ))}
        <div className="flex justify-between items-center pt-5 mt-3" style={{ borderTop: `3px solid ${GREEN}` }}>
          <span style={{ ...H3, color: '#fff', fontSize: 32 }}>TOTAL MENSAL</span>
          <span style={{ ...H3, color: GREEN, fontSize: 36 }}>R$ <DataField fieldId="s07.total" liveValue={total} format={fmtThousands} /></span>
        </div>
      </div>
      <p style={{ ...SMALL, color: MUTED, marginTop: 16, textAlign: 'center' }}>
        Sem contar encargos CLT (~70%), gestão e turnover. Valores reais do módulo Headcount.
      </p>
    </Pad>
  );
};

// ── Slide 8: Metodologia (imagem do PDF — preserva o diagrama original) ────
export const Slide08 = () => (
  <Pad p="120px 100px 80px">
    <div style={KICKER}>Nossa Metodologia</div>
    <h2 style={{ ...H2, color: '#fff', marginTop: 8, fontSize: 52 }}>Metodologia Oxigênio Empresarial<sup style={{ fontSize: 24 }}>®</sup></h2>
    <div className="flex-1 flex items-center justify-center mt-4" style={{ background: '#fff', borderRadius: 12, padding: 24 }}>
      <img src={pdfSlide08.url} alt="Diagrama da Metodologia Oxigênio Empresarial" style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }} />
    </div>
    <p style={{ ...SMALL, color: MUTED, marginTop: 12 }}>
      Registro autoral INPI · Pedro Ghiorzzi de Albite Silva · Rio de Janeiro, 20/06/2024
    </p>
  </Pad>
);

// ── Slide 9: Sistematizando a solução ───────────────────────────────────────
export const Slide09 = () => {
  const cols = ['Processos', 'Dados Fidedignos', 'Informações Inteligentes', 'Análise Estratégica', 'Plano de Ação Efetivo'];
  const empreendedor = [
    'Faz o Setup da O2 Inc.: processos analisados, plano de contas revisado. Aprova versão final dos 5 processos críticos.',
    'Entende de onde vem cada dado; aumenta criticidade e tecnicidade.',
    'Acesso em tempo real às informações inteligentes do negócio; sabe como analisá-las.',
    'Análise de onde estiver, em tempo real. CFO 24/7 (IA) faz análise direto no WhatsApp.',
    'Plano de ação com base sólida; mitiga riscos; sempre alinhado ao planejamento financeiro.',
  ];
  const gestor = [
    'Recebe os 5 processos padronizados; tempo focado no estratégico.',
    'Centraliza TODOS os dados na plataforma OXY. Conciliação automática.',
    'IA + Oxy entregam relatórios automáticos; sem retrabalho manual.',
    'Faz análise técnica suportada por dados confiáveis e pelo CFO 24/7.',
    'Executa o plano com clareza e velocidade; gera oportunidades de negócio.',
  ];
  return (
    <Pad p="120px 80px 100px">
      <div style={KICKER}>Solução</div>
      <h2 style={{ ...H2, color: '#fff', marginTop: 8, fontSize: 52 }}>Sistematizando a solução</h2>
      <p style={{ ...SMALL, color: MUTED, marginTop: 4 }}>Centralizada e acessível</p>
      <div className="grid grid-cols-5 gap-3 mt-8">
        {cols.map((c, i) => (
          <div key={i} style={{ background: GREEN, color: NAVY, padding: 12, borderRadius: 6, fontWeight: 700, fontSize: 18, textAlign: 'center', fontFamily: 'Space Grotesk' }}>{c}</div>
        ))}
      </div>
      {[
        { label: 'Empreendedor', rows: empreendedor, id: 'emp' },
        { label: 'Gestor Financeiro', rows: gestor, id: 'ges' },
      ].map(({ label, rows, id }) => (
        <div key={id} className="grid grid-cols-5 gap-3 mt-3 flex-1">
          {rows.map((r, ci) => (
            <div key={ci} style={{ background: NAVY_2, padding: 14, borderRadius: 6, fontSize: 14, color: TEXT, lineHeight: 1.35 }}>
              {ci === 0 && <div style={{ color: GREEN, fontWeight: 700, marginBottom: 6, fontSize: 16, fontFamily: 'Space Grotesk' }}>{label}</div>}
              <DataField fieldId={`s09.${id}.${ci}`} liveValue={r} />
            </div>
          ))}
        </div>
      ))}
    </Pad>
  );
};

// ── Slide 10: Benefícios ────────────────────────────────────────────────────
export const Slide10 = () => (
  <Pad p="140px 200px 100px">
    <div style={KICKER}>Benefícios e Economias</div>
    <h2 style={{ ...H2, color: '#fff', marginTop: 12 }}>O que o cliente ganha com a O2</h2>
    <div className="grid grid-cols-2 gap-6 mt-10">
      {[
        ['Redução brutal de custo', 'Em vez de R$ 72k/mês com equipe própria, paga uma fração com a O2.'],
        ['Decisões com dados em tempo real', 'DRE, fluxo de caixa e indicadores sempre atualizados — sem retrabalho.'],
        ['Time financeiro confiante', 'Profissional ganha capacidade técnica e entrega mais valor estratégico.'],
        ['Menor turnover', 'Equipe deixa de operar no apagar incêndios e cresce dentro da metodologia.'],
        ['CFO 24/7 via IA', 'Gênio responde sobre os dados da empresa no WhatsApp, a qualquer hora.'],
        ['Smart Banking integrado', 'Conta digital + conciliação multibancos no mesmo ambiente.'],
      ].map(([t, d], i) => (
        <div key={i} className="flex gap-5" style={{ background: NAVY_2, padding: 24, borderRadius: 12 }}>
          <div style={{ background: GREEN, color: NAVY, minWidth: 48, height: 48, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 22, fontFamily: 'Space Grotesk' }}>{i + 1}</div>
          <div>
            <div style={{ ...H3, color: '#fff', fontSize: 26 }}><DataField fieldId={`s10.b${i}.t`} liveValue={t} /></div>
            <p style={{ ...BODY, color: MUTED, marginTop: 4, fontSize: 20 }}><DataField fieldId={`s10.b${i}.d`} liveValue={d} /></p>
          </div>
        </div>
      ))}
    </div>
  </Pad>
);

// ── Slide 11: Evolução do mercado ───────────────────────────────────────────
export const Slide11 = () => {
  const eras = [
    ['1970–1980', 'Controle Manual'],
    ['1990–2000', 'Planilhas'],
    ['2000–2010', 'ERPs'],
    ['2010–2020', 'BI e Dashboards'],
    ['2020 →', 'SaaS + IA + Banking'],
  ];
  return (
    <Pad>
      <div style={KICKER}>Mercado</div>
      <h2 style={{ ...H2, color: '#fff', marginTop: 12 }}>Evolução do mercado</h2>
      <div className="flex items-stretch gap-4 mt-12">
        {eras.map(([year, label], i) => (
          <div key={i} style={{ flex: 1, background: i === eras.length - 1 ? GREEN : NAVY_2, color: i === eras.length - 1 ? NAVY : TEXT, padding: 28, borderRadius: 12 }}>
            <div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 22 }}>{year}</div>
            <div style={{ ...H3, fontSize: 24, marginTop: 12 }}>{label}</div>
          </div>
        ))}
      </div>
      <div className="mt-16 text-center">
        <div style={{ ...H1, fontSize: 96, color: GREEN }}>O2 INC.</div>
        <p style={{ ...BODY, color: MUTED, marginTop: 12 }}>A plataforma da nova era.</p>
      </div>
    </Pad>
  );
};

// ── Slide 12: TAM / SAM / SOM ──────────────────────────────────────────────
export const Slide12 = () => (
  <Pad p="140px 200px 100px">
    <div style={KICKER}>Tamanho do Mercado</div>
    <h2 style={{ ...H2, color: '#fff', marginTop: 12 }}>Um mercado gigante: PMEs brasileiras</h2>
    <div className="mt-10" style={{ background: NAVY_2, borderRadius: 12, overflow: 'hidden' }}>
      {[
        { tag: 'TAM', desc: 'Total de empresas no Brasil', val: '20.051.000', src: 'Sebrae', color: '#475569' },
        { tag: 'SAM', desc: 'Micro, Pequenas e Médias Empresas (R$ 81 mil até R$ 300 milhões/ano)', val: '6.051.000', src: 'Sebrae', color: '#64748b' },
        { tag: 'SOM', desc: 'Meta realista de contratos nos próximos 5 anos · Penetração de 1,6% do mercado PME', val: '100.000', src: 'Projeção O2 Inc.', color: GREEN },
      ].map((r, i) => (
        <div key={i} className="grid grid-cols-12 items-center" style={{ borderBottom: i < 2 ? '1px solid #334155' : 'none', padding: 24 }}>
          <div className="col-span-1" style={{ ...H3, color: r.color === GREEN ? GREEN : '#fff', fontWeight: 800 }}>{r.tag}</div>
          <div className="col-span-7" style={{ ...BODY, color: TEXT, fontSize: 22 }}>
            <DataField fieldId={`s12.${r.tag}.desc`} liveValue={r.desc} />
          </div>
          <div className="col-span-2 text-right" style={{ ...H3, color: r.color === GREEN ? GREEN : '#fff', fontSize: 36 }}>
            <DataField fieldId={`s12.${r.tag}.val`} liveValue={r.val} />
          </div>
          <div className="col-span-2 text-right" style={{ ...SMALL, color: MUTED }}>{r.src}</div>
        </div>
      ))}
    </div>
    <p style={{ ...BODY, color: MUTED, marginTop: 32, fontStyle: 'italic', maxWidth: 1500, fontSize: 22 }}>
      "As PMEs brasileiras movimentam mais de R$ 2 trilhões por ano, representando quase 30% do PIB nacional."
    </p>
  </Pad>
);

// ── Slide 13: Produtos overview ────────────────────────────────────────────
export const Slide13 = () => (
  <PadCenter p="0 200px">
    <div style={KICKER}>Produtos</div>
    <h2 style={{ ...H2, color: '#fff', marginTop: 12, marginBottom: 80 }}>Três linhas de produto, um ecossistema</h2>
    <div className="grid grid-cols-3 gap-10">
      {[
        ['SAAS + AI', 'Oxy + Gênio', 'Plataforma + IA financeira'],
        ['CAAS', 'CFO as a Service', 'Sênior dedicado'],
        ['BAAS', 'Smart Banking', 'Conta PJ + WhatsApp'],
      ].map(([cat, name, sub], i) => (
        <div key={i} style={{ background: NAVY_2, padding: 48, borderRadius: 16, borderTop: `6px solid ${GREEN}` }}>
          <div style={{ color: GREEN, fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 28, letterSpacing: '0.1em' }}>{cat}</div>
          <div style={{ ...H3, color: '#fff', fontSize: 32, marginTop: 16 }}>{name}</div>
          <div style={{ ...BODY, color: MUTED, marginTop: 12, fontSize: 22 }}>{sub}</div>
        </div>
      ))}
    </div>
  </PadCenter>
);

// ── Helper: produto com lista longa ────────────────────────────────────────
function LongListSlide({ cat, name, items, id }: { cat: string; name: string; items: { t: string; d?: string }[]; id: string }) {
  return (
    <Pad p="120px 120px 80px">
      <div style={KICKER}>Produtos · {cat}</div>
      <h2 style={{ ...H2, color: '#fff', marginTop: 8, fontSize: 52 }}>{name}</h2>
      <GreenBar w={64} />
      <div className="grid grid-cols-2 gap-x-10 gap-y-4 mt-2">
        {items.map((it, i) => (
          <div key={i} className="flex gap-3" style={{ ...SMALL, color: TEXT }}>
            <span style={{ color: GREEN, fontWeight: 700, minWidth: 28, fontFamily: 'Space Grotesk', fontSize: 18 }}>{String(i + 1).padStart(2, '0')}</span>
            <div>
              <div style={{ color: '#fff', fontWeight: 600, fontSize: 18 }}>
                <DataField fieldId={`${id}.b${i}.t`} liveValue={it.t} />
              </div>
              {it.d && (
                <div style={{ color: MUTED, fontSize: 16, marginTop: 2 }}>
                  <DataField fieldId={`${id}.b${i}.d`} liveValue={it.d} />
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </Pad>
  );
}

// ── Slide 14: SAAS + AI overview ───────────────────────────────────────────
export const Slide14 = () => (
  <PadCenter p="0 200px">
    <div style={KICKER}>Produtos · SAAS + AI</div>
    <h2 style={{ ...H2, color: '#fff', marginTop: 12, fontSize: 88 }}>Oxy + Gênio</h2>
    <GreenBar />
    <p style={{ ...BODY, color: TEXT, marginTop: 16, fontSize: 30, maxWidth: 1400 }}>
      <DataField fieldId="s14.desc" liveValue="A plataforma que substitui ERP, BI e CFO interno: integra dados, gera análises e responde dúvidas no WhatsApp via IA." />
    </p>
  </PadCenter>
);

// ── Slide 15: SAAS + AI funcionalidades (10 itens fiel ao PDF) ─────────────
export const Slide15 = () => (
  <LongListSlide id="s15" cat="SAAS + AI · Oxy + Gênio" name="Funcionalidades-chave"
    items={[
      { t: 'Integração nativa com ERPs.', d: 'Importação automática de dados financeiros para análises em tempo real.' },
      { t: 'CFO HUB para gerenciamento fácil.', d: 'Gestão de usuários, plano de contas e integrações sem conhecimento técnico.' },
      { t: 'Relatórios estratégicos automáticos.', d: 'DRE, DFC, Ciclo Financeiro e Budget em tempo real.' },
      { t: 'Simulações financeiras dinâmicas.', d: 'Cenários conservador, moderado, arrojado dentro da plataforma.' },
      { t: 'Alertas operacionais e estratégicos.', d: 'Avisos automáticos para o time financeiro e insights para o empreendedor.' },
      { t: 'CFO 24/7 via Inteligência Artificial.', d: 'Análises conversacionais puxando dados em tempo real da base.' },
      { t: 'Discussões de cenários com o CFO 24/7.', d: 'Simulações e análises estratégicas via interação direta com a IA.' },
      { t: 'Previsibilidade de fluxo de caixa.', d: 'Pergunte ao Gênio como estará o caixa em dias ou períodos específicos.' },
      { t: 'Projeção de resultados alternativos.', d: 'Peça ao CFO 24/7 para criar novos cenários e caminhos estratégicos.' },
      { t: 'Análise detalhada de lançamentos e variações de custos.', d: 'Questione lançamentos específicos e entenda despesas fora do padrão.' },
    ]} />
);

// ── Slide 16: CaaS — B2B + B2C (lista longa do PDF) ────────────────────────
export const Slide16 = () => (
  <Pad p="120px 100px 80px">
    <div style={KICKER}>Produtos · CAAS · CFO as a Service</div>
    <h2 style={{ ...H2, color: '#fff', marginTop: 8, fontSize: 52 }}>CFO as a Service</h2>
    <GreenBar w={64} />
    <div className="grid grid-cols-2 gap-8 mt-2 flex-1">
      {[
        { side: 'Para a Empresa (B2B)', id: 's16.b2b', items: [
          'Olho no olho com quem entende do seu negócio.',
          'CFO experiente, validado e com suporte tecnológico de ponta.',
          'Gestão estratégica sem montar time interno caro.',
          'Visão de futuro, controle e planejamento sem burocracia CLT.',
          'Fluidez no dia a dia financeiro com tecnologia + interação humana.',
          'Resultados de alta performance via metodologia exclusiva Oxigênio Empresarial®.',
          'Apoio em momentos-chave: expansão, captação, reestruturação.',
          'CFO da O2 fala a linguagem de bancos, investidores e mercado.',
        ]},
        { side: 'Para o CFO / Profissional (B2C)', id: 's16.b2c', items: [
          'Nova carreira: tecnologia, IA e metodologia inclusas.',
          'Parceiro estratégico apoiado por IA, plataforma OXY e know-how O2.',
          'Formação obrigatória: do CFO técnico ao Engenheiro de Negócios®.',
          'Marca forte e validada para abrir portas.',
          'Zero necessidade de investir em tecnologia própria.',
          'Suporte comercial e formação contínua para crescimento.',
          'Oportunidades de negócio geradas pela O2.',
          'Treinamento em vendas consultivas e suporte de marketing.',
        ]},
      ].map(block => (
        <div key={block.id} style={{ background: NAVY_2, padding: 24, borderRadius: 12, borderTop: `4px solid ${GREEN}` }}>
          <div style={{ ...H3, color: GREEN, fontSize: 24, marginBottom: 12 }}>{block.side}</div>
          {block.items.map((it, i) => (
            <div key={i} className="flex gap-3 py-1" style={{ ...SMALL, color: TEXT, fontSize: 16 }}>
              <span style={{ color: GREEN, fontWeight: 700, minWidth: 22 }}>{i + 1}.</span>
              <DataField fieldId={`${block.id}.${i}`} liveValue={it} />
            </div>
          ))}
        </div>
      ))}
    </div>
  </Pad>
);

// ── Slide 17: Marketplace de CFOs (3 colunas) ──────────────────────────────
export const Slide17 = () => {
  const dores = [
    'Precisa de gestão estratégica mas não pode montar time caro.',
    'Quer tecnologia e proximidade humana (olho no olho).',
    'Precisa de apoio para crescer, captar, reestruturar.',
    'Busca inteligência de dados + inteligência de negócios.',
  ];
  const o2 = [
    'Plataforma tecnológica (OXY + IA).',
    'Metodologia Oxigênio Empresarial®.',
    'Formação Engenheiro de Negócios®.',
    'Comunidade e Licenciamento.',
  ];
  const cfo = [
    'Não consegue se recolocar no mercado.',
    'Falta tecnologia, marca forte, metodologia.',
    'Não sabe vender seus serviços estratégicos.',
    'Quer ser mais do que um financeiro: quer ser gerador de negócios.',
  ];
  return (
    <Pad p="120px 100px 100px">
      <div style={KICKER}>CFO · Marketplace</div>
      <h2 style={{ ...H2, color: '#fff', marginTop: 8, fontSize: 48 }}>Agora empresas e CFOs têm um novo ponto de encontro</h2>
      <p style={{ ...BODY, color: GREEN, marginTop: 8, fontSize: 26 }}>
        <DataField fieldId="s17.tag" liveValue="Tecnologia, estratégia e crescimento reunidos pela O2 Inc." />
      </p>
      <div className="grid grid-cols-3 gap-6 mt-10 flex-1">
        {[
          { t: 'Dores da empresa', col: GREEN, items: dores, id: 'dor' },
          { t: 'Plataforma O2 Inc.', col: GREEN, items: o2, id: 'o2' },
          { t: 'Dores do CFO', col: GREEN, items: cfo, id: 'cfo' },
        ].map(b => (
          <div key={b.id} style={{ background: NAVY_2, padding: 28, borderRadius: 12, borderTop: `4px solid ${b.col}` }}>
            <div style={{ ...H3, color: b.col, fontSize: 24, marginBottom: 16 }}>{b.t}</div>
            {b.items.map((it, i) => (
              <div key={i} className="flex gap-3 py-2" style={{ ...BODY, color: TEXT, fontSize: 18 }}>
                <span style={{ color: GREEN }}>●</span>
                <DataField fieldId={`s17.${b.id}.${i}`} liveValue={it} />
              </div>
            ))}
          </div>
        ))}
      </div>
    </Pad>
  );
};

// ── Slide 18: BaaS (14 itens fiel ao PDF) ──────────────────────────────────
export const Slide18 = () => (
  <LongListSlide id="s18" cat="BAAS · Banking as a Service" name="Smart Banking + BPO 4.0"
    items={[
      { t: 'Conta digital PJ integrada ao WhatsApp.', d: 'Envia, recebe e consulta saldo direto pelo WhatsApp.' },
      { t: 'Wallet digital corporativa.', d: 'Gestão centralizada de saldo, pagamentos e antecipações.' },
      { t: 'Alertas de Contas a Receber e a Pagar.', d: 'Avisos inteligentes para controle do fluxo de caixa.' },
      { t: 'Alçadas de aprovação via WhatsApp.', d: 'Autorizações configuráveis com segurança e agilidade.' },
      { t: 'Integração completa com a OXY.', d: 'Movimentações bancárias impactam DRE, fluxo e ciclo financeiro.' },
      { t: 'Automação dos 5 processos críticos (BPO 4.0).', d: 'IA assume faturamento, CR, compras, CP e conciliações.' },
      { t: 'Gestão multibancos em um só lugar.', d: 'Conciliação e controle de múltiplas contas com inteligência.' },
    ]} />
);

// ── Slide 19: Modelo de Negócio (preserva diagrama PDF + tickets reais) ────
export const Slide19 = () => {
  const { assumptions } = useFinancialModel();
  const t = assumptions.tickets;
  const fmt = (v: number) => v.toLocaleString('pt-BR');
  return (
    <Pad p="120px 120px 80px">
      <div style={KICKER}>Modelo de Negócio</div>
      <h2 style={{ ...H2, color: '#fff', marginTop: 8, fontSize: 48 }}>Ticket médio e estrutura de receita</h2>
      <div className="grid grid-cols-3 gap-6 mt-8 flex-1">
        <div style={{ background: NAVY_2, padding: 24, borderRadius: 12, borderTop: `4px solid ${GREEN}` }}>
          <div style={{ ...H3, color: GREEN, fontSize: 24 }}>SETUP</div>
          <div style={{ ...BODY, color: TEXT, marginTop: 8, fontSize: 18 }}>Ticket médio</div>
          <div style={{ ...H1, color: '#fff', fontSize: 56, marginTop: 4 }}>R$ <DataField fieldId="s19.setup" liveValue={t.caasSetup} format={fmt} /></div>
          <div style={{ ...SMALL, color: MUTED, marginTop: 8 }}>à vista ou 12× R$ 1.497</div>
          <div style={{ ...SMALL, color: TEXT, marginTop: 16, lineHeight: 1.4 }}>
            Mapeamento de processos · Integração ERP · CFO HUB · Plano de contas · Roadmap inicial.
          </div>
        </div>
        <div style={{ background: NAVY_2, padding: 24, borderRadius: 12, borderTop: `4px solid ${GREEN}` }}>
          <div style={{ ...H3, color: GREEN, fontSize: 24 }}>SAAS (MRR)</div>
          <div className="mt-3 space-y-2">
            {[
              ['Oxy', t.saasOxy, 's19.oxy'],
              ['Oxy + Gênio', t.saasOxyGenio, 's19.oxyGenio'],
              ['Oxy + Gênio Especialista', t.saasOxyGenioEsp, 's19.oxyGenioEsp'],
            ].map(([l, v, fid]: any) => (
              <div key={fid} className="flex justify-between py-1" style={{ borderBottom: '1px solid #334155', ...SMALL, color: TEXT }}>
                <span>{l}</span>
                <span style={{ color: GREEN, fontWeight: 600 }}>R$ <DataField fieldId={fid} liveValue={v} format={fmt} /></span>
              </div>
            ))}
          </div>
        </div>
        <div style={{ background: NAVY_2, padding: 24, borderRadius: 12, borderTop: `4px solid ${GREEN}` }}>
          <div style={{ ...H3, color: GREEN, fontSize: 24 }}>CAAS (MRR)</div>
          <div className="mt-3 space-y-2">
            {[
              ['Assessoria', t.caasAssessoria, 's19.cAss'],
              ['Enterprise', t.caasEnterprise, 's19.cEnt'],
              ['Corporate', t.caasCorporate, 's19.cCor'],
            ].map(([l, v, fid]: any) => (
              <div key={fid} className="flex justify-between py-1" style={{ borderBottom: '1px solid #334155', ...SMALL, color: TEXT }}>
                <span>{l}</span>
                <span style={{ color: GREEN, fontWeight: 600 }}>R$ <DataField fieldId={fid} liveValue={v} format={fmt} /></span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <p style={{ ...SMALL, color: MUTED, marginTop: 16 }}>
        + Success Fee, Add-ons, Up-sell, Cross-sell e BAAS. Tickets puxados ao vivo de Premissas → Tickets.
      </p>
    </Pad>
  );
};

// ── Slide 20: Time C-Level (imagem PDF do time) ────────────────────────────
export const Slide20 = () => (
  <Pad p="120px 120px 80px">
    <div style={KICKER}>Time</div>
    <h2 style={{ ...H2, color: '#fff', marginTop: 8, fontSize: 52 }}>C-Level empreendedor e multidisciplinar</h2>
    <div className="flex-1 flex items-center justify-center mt-6" style={{ background: '#fff', borderRadius: 12, padding: 16 }}>
      <img src={pdfSlide20.url} alt="Time C-Level O2 Inc." style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }} />
    </div>
  </Pad>
);

// ── Slide 21: Operação USA (imagem PDF) ────────────────────────────────────
export const Slide21 = () => (
  <Pad p="120px 120px 80px">
    <div style={KICKER}>Time</div>
    <h2 style={{ ...H2, color: '#fff', marginTop: 8, fontSize: 52 }}>Sócios experientes lideram nossa operação USA</h2>
    <div className="flex-1 flex items-center justify-center mt-6" style={{ background: '#fff', borderRadius: 12, padding: 16 }}>
      <img src={pdfSlide21.url} alt="Time USA O2 Inc." style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }} />
    </div>
  </Pad>
);

// ── Slide 22: NPS ──────────────────────────────────────────────────────────
export const Slide22 = () => (
  <PadCenter p="0 200px">
    <div style={KICKER}>Clientes Satisfeitos</div>
    <h2 style={{ ...H2, color: '#fff', marginTop: 12 }}>Tudo começa com clientes satisfeitos</h2>
    <div className="flex items-end gap-12 mt-12">
      <div>
        <div style={{ ...H1, fontSize: 240, color: GREEN, lineHeight: 1 }}>
          <DataField fieldId="s22.nps" liveValue="88" />
        </div>
        <div style={{ ...H3, color: '#fff', marginTop: 8 }}>NPS</div>
        <div style={{ ...SMALL, color: MUTED, marginTop: 4 }}>(editável manualmente)</div>
      </div>
      <div style={{ flex: 1, background: NAVY_2, padding: 32, borderRadius: 12, borderLeft: `4px solid ${GREEN}` }}>
        <p style={{ ...BODY, color: TEXT, fontStyle: 'italic', fontSize: 24 }}>
          "<DataField fieldId="s22.quote" liveValue="A O2 transformou nossa visão financeira e nos deu confiança pra crescer." />"
        </p>
        <div style={{ ...BODY, color: GREEN, marginTop: 16, fontSize: 22 }}>
          — <DataField fieldId="s22.author" liveValue="Fernanda Curi · Executive Producer, Roof Studio 🇺🇸" />
        </div>
      </div>
    </div>
  </PadCenter>
);

// ── Slide 23: KPIs M&S (live) ──────────────────────────────────────────────
export const Slide23 = () => {
  const { model } = useFinancialModel();
  const ltvCac = getLtvCac(model, 2025);
  const cmPct = model.years[2025]?.contributionMarginPct ?? 0;
  return (
    <Pad p="140px 200px 100px">
      <div style={KICKER}>Marketing & Comercial</div>
      <h2 style={{ ...H2, color: '#fff', marginTop: 12 }}>Principais KPIs</h2>
      <div className="grid grid-cols-3 gap-8 mt-12">
        {[
          ['LTV / CAC', ltvCac, 's23.ltvcac', (v: number) => v.toFixed(2)],
          ['Margem de Contribuição', cmPct, 's23.cm', (v: number) => `${v.toFixed(1)}%`],
          ['NPS', 88, 's23.nps', (v: number) => String(v)],
        ].map(([label, v, fid, fmt]: any, i) => (
          <div key={i} style={{ background: NAVY_2, padding: 32, borderRadius: 12, borderTop: `4px solid ${GREEN}` }}>
            <div style={{ ...BODY, color: MUTED }}>{label}</div>
            <div style={{ ...H1, fontSize: 96, color: GREEN, marginTop: 8 }}>
              <DataField fieldId={fid} liveValue={v} format={fmt} />
            </div>
          </div>
        ))}
      </div>
      <p style={{ ...SMALL, color: MUTED, marginTop: 32 }}>
        LTV/CAC e Margem de Contribuição calculados ao vivo pelo engine. NPS: override manual.
      </p>
    </Pad>
  );
};

// ── Helper: chart de barras (anos dinâmicos) ───────────────────────────────
function BarChart({ data, format = fmtThousands, idPrefix }: { data: { label: string; value: number }[]; format?: (n: number) => string; idPrefix: string }) {
  const m = Math.max(...data.map(d => d.value), 1);
  return (
    <div className="flex items-end gap-3 mt-10" style={{ height: 480 }}>
      {data.map((d, i) => {
        const h = (d.value / m) * 100;
        return (
          <div key={i} className="flex-1 flex flex-col items-center justify-end">
            <div style={{ ...SMALL, color: GREEN, fontWeight: 700, marginBottom: 8, fontSize: 18 }}>
              <DataField fieldId={`${idPrefix}.${d.label}`} liveValue={d.value} format={format} />
            </div>
            <div style={{ width: '75%', height: `${h}%`, background: `linear-gradient(180deg, ${GREEN} 0%, #4ade80 100%)`, borderRadius: '8px 8px 0 0', minHeight: 4 }} />
            <div style={{ ...SMALL, color: TEXT, marginTop: 10, fontSize: 18 }}>{d.label}</div>
          </div>
        );
      })}
    </div>
  );
}

// ── Slide 24: Evolução do Faturamento 2022→2030 ────────────────────────────
export const Slide24 = () => {
  const { model } = useFinancialModel();
  const ys = yearsRange(2022, 2030);
  const data = ys.map(y => ({
    label: String(y),
    value: model.years[y as 2022]?.grossRevenue ?? 0,
  }));
  return (
    <Pad p="140px 120px 100px">
      <div style={KICKER}>Faturamento</div>
      <h2 style={{ ...H2, color: '#fff', marginTop: 12 }}>Evolução do Faturamento 2022→2030 (R$ 000's)</h2>
      <BarChart data={data} idPrefix="s24" />
    </Pad>
  );
};

// ── Slide 25: Receita Bruta mensal 2025 ────────────────────────────────────
export const Slide25 = () => {
  const { model } = useFinancialModel();
  const monthly = getMonthlyGrossRevenue(model, 2025);
  const labels = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const data = labels.map((l, i) => ({ label: l, value: monthly[i] }));
  return (
    <Pad p="140px 120px 100px">
      <div style={KICKER}>KPIs Financeiros</div>
      <h2 style={{ ...H2, color: '#fff', marginTop: 12 }}>Receita Bruta mensal 2025 (R$ 000's) — dados reais</h2>
      <BarChart data={data} idPrefix="s25" />
    </Pad>
  );
};

// ── Slide 26: Investimento em Marketing 2024→2030 ──────────────────────────
export const Slide26 = () => {
  const { model } = useFinancialModel();
  const ys = yearsRange(2024, 2030);
  const data = ys.map(y => ({ label: String(y), value: model.years[y as 2024]?.marketing ?? 0 }));
  return (
    <Pad p="140px 120px 100px">
      <div style={KICKER}>Investimento em Marketing</div>
      <h2 style={{ ...H2, color: '#fff', marginTop: 12 }}>Investimento em Marketing 2024→2030 (R$ 000's)</h2>
      <BarChart data={data} idPrefix="s26" />
    </Pad>
  );
};

// ── Helper tabela ano-a-ano ────────────────────────────────────────────────
function YearTable({ years, rows, idPrefix }: { years: number[]; rows: { label: string; fn: (y: number) => number; fmt: (n: number) => string }[]; idPrefix: string }) {
  return (
    <table className="mt-8 w-full" style={{ borderCollapse: 'separate', borderSpacing: '0 4px' }}>
      <thead>
        <tr style={{ color: GREEN, fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 22 }}>
          <th className="text-left p-3" style={{ background: NAVY_2 }}>Indicador</th>
          {years.map(y => <th key={y} className="text-right p-3" style={{ background: NAVY_2 }}>{y}</th>)}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} style={{ ...BODY, color: TEXT, fontSize: 20 }}>
            <td className="p-3" style={{ background: NAVY_2, color: '#fff', fontWeight: 600 }}>{r.label}</td>
            {years.map(y => (
              <td key={y} className="text-right p-3" style={{ background: NAVY_2 }}>
                <DataField fieldId={`${idPrefix}.${r.label}.${y}`} liveValue={r.fn(y)} format={r.fmt} />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ── Slide 27: Projeções 2025→2030 ──────────────────────────────────────────
export const Slide27 = () => {
  const { model } = useFinancialModel();
  const years = yearsRange(2025, 2030);
  return (
    <Pad p="140px 100px 100px">
      <div style={KICKER}>Projeções FY25 → FY30</div>
      <h2 style={{ ...H2, color: '#fff', marginTop: 12 }}>Projeções financeiras (R$ 000's)</h2>
      <YearTable years={years} idPrefix="s27" rows={[
        { label: 'Receita Bruta', fn: y => model.years[y as 2025]?.grossRevenue ?? 0, fmt: fmtThousands },
        { label: 'Lucro Bruto', fn: y => model.years[y as 2025]?.grossProfit ?? 0, fmt: fmtThousands },
        { label: 'EBITDA', fn: y => model.years[y as 2025]?.ebitda ?? 0, fmt: fmtThousands },
        { label: 'Resultado Líquido', fn: y => model.years[y as 2025]?.netIncome ?? 0, fmt: fmtThousands },
      ]} />
    </Pad>
  );
};

// ── Slide 28: YoY (2025/24 e 2026/25) ──────────────────────────────────────
export const Slide28 = () => {
  const { model } = useFinancialModel();
  const m = (y: number, k: 'grossRevenue' | 'grossProfit' | 'ebitda' | 'netIncome') =>
    model.years[y as 2024]?.[k] ?? 0;
  const yoyFmt = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(0)}%`;
  const rows = [
    { label: 'Receita Bruta', a: yoy(m(2025, 'grossRevenue'), m(2024, 'grossRevenue')), b: yoy(m(2026, 'grossRevenue'), m(2025, 'grossRevenue')) },
    { label: 'Lucro Bruto', a: yoy(m(2025, 'grossProfit'), m(2024, 'grossProfit')), b: yoy(m(2026, 'grossProfit'), m(2025, 'grossProfit')) },
    { label: 'EBITDA', a: yoy(m(2025, 'ebitda'), m(2024, 'ebitda')), b: yoy(m(2026, 'ebitda'), m(2025, 'ebitda')) },
    { label: 'Resultado Líquido', a: yoy(m(2025, 'netIncome'), m(2024, 'netIncome')), b: yoy(m(2026, 'netIncome'), m(2025, 'netIncome')) },
  ];
  return (
    <Pad p="140px 120px 100px">
      <div style={KICKER}>Validação da Tese</div>
      <h2 style={{ ...H2, color: '#fff', marginTop: 12 }}>Crescimento Year-over-Year</h2>
      <div className="grid grid-cols-4 gap-6 mt-10">
        {rows.map((r, i) => (
          <div key={i} style={{ background: NAVY_2, padding: 28, borderRadius: 12, borderTop: `4px solid ${GREEN}` }}>
            <div style={{ ...BODY, color: '#fff', fontSize: 22, fontWeight: 600 }}>{r.label}</div>
            <div className="mt-6">
              <div style={{ ...SMALL, color: MUTED }}>2024 → 2025</div>
              <div style={{ ...H1, fontSize: 56, color: GREEN, lineHeight: 1.1 }}>
                <DataField fieldId={`s28.${r.label}.a`} liveValue={r.a} format={yoyFmt} />
              </div>
            </div>
            <div className="mt-4">
              <div style={{ ...SMALL, color: MUTED }}>2025 → 2026</div>
              <div style={{ ...H1, fontSize: 56, color: GREEN, lineHeight: 1.1 }}>
                <DataField fieldId={`s28.${r.label}.b`} liveValue={r.b} format={yoyFmt} />
              </div>
            </div>
          </div>
        ))}
      </div>
      <p style={{ ...SMALL, color: MUTED, marginTop: 24 }}>
        Otimização de SG&A com reflexo direto no EBITDA. Dados puxados do engine de cálculos.
      </p>
    </Pad>
  );
};

// ── Slide 29: Resultado consolidado 2024→2030 ──────────────────────────────
export const Slide29 = () => {
  const { model } = useFinancialModel();
  const years = yearsRange(2024, 2030);
  return (
    <Pad p="140px 80px 100px">
      <div style={KICKER}>Resultado Consolidado</div>
      <h2 style={{ ...H2, color: '#fff', marginTop: 12, fontSize: 48 }}>Com todos os produtos, a companhia atinge resultados promissores</h2>
      <YearTable years={years} idPrefix="s29" rows={[
        { label: 'Receita Líquida', fn: y => model.years[y as 2024]?.netRevenue ?? 0, fmt: fmtThousands },
        { label: 'EBITDA', fn: y => model.years[y as 2024]?.ebitda ?? 0, fmt: fmtThousands },
        { label: '% Margem EBITDA', fn: y => model.years[y as 2024]?.ebitdaMarginPct ?? 0, fmt: fmtPct },
      ]} />
    </Pad>
  );
};

// ── Slide 30: Geração de caixa ─────────────────────────────────────────────
export const Slide30 = () => {
  const { model } = useFinancialModel();
  const fcl2025 = model.years[2025]?.finalResult ?? 0;
  return (
    <PadCenter p="0 200px">
      <div style={KICKER}>Caixa</div>
      <h2 style={{ ...H2, color: '#fff', marginTop: 12 }}>A companhia hoje já é geradora de caixa</h2>
      <p style={{ ...BODY, color: GREEN, fontSize: 32, marginTop: 16 }}>
        E cresce sem capital de terceiros.
      </p>
      <div className="grid grid-cols-3 gap-8 mt-12">
        {[
          { n: '100%', l: 'Bootstrapped', fid: 's30.k0' },
          { n: 'R$ 0', l: 'Dívida bancária líquida', fid: 's30.k1' },
          { n: '+3 anos', l: 'Operação positiva', fid: 's30.k2' },
        ].map((k, i) => (
          <div key={i} style={{ background: NAVY_2, padding: 32, borderRadius: 12, borderTop: `4px solid ${GREEN}`, textAlign: 'center' }}>
            <div style={{ ...H1, fontSize: 80, color: GREEN }}><DataField fieldId={`${k.fid}.n`} liveValue={k.n} /></div>
            <div style={{ ...BODY, color: TEXT, marginTop: 8 }}><DataField fieldId={`${k.fid}.l`} liveValue={k.l} /></div>
          </div>
        ))}
      </div>
      <p style={{ ...SMALL, color: MUTED, marginTop: 28, textAlign: 'center' }}>
        Resultado financeiro 2025 (engine): R$ <DataField fieldId="s30.fcl2025" liveValue={fcl2025} format={fmtThousands} /> mil
      </p>
    </PadCenter>
  );
};

// ── Slide 31: Moat ─────────────────────────────────────────────────────────
export const Slide31 = () => (
  <Pad p="140px 200px 100px">
    <div style={KICKER}>Moat Competitivo</div>
    <h2 style={{ ...H2, color: '#fff', marginTop: 12 }}>Difícil de replicar</h2>
    <div className="grid grid-cols-2 gap-6 mt-10">
      {[
        ['Metodologia proprietária registrada (INPI)', true],
        ['Base de dados financeira de PMEs', true],
        ['Marketplace de CFOs validados', true],
        ['IA Gênio treinada no contexto brasileiro', true],
        ['Smart Banking integrado ao WhatsApp', false],
        ['Operação USA com sócios experientes', false],
      ].map(([t, done], i) => (
        <div key={i} className="flex items-center gap-4" style={{ background: NAVY_2, padding: 24, borderRadius: 10 }}>
          <span style={{ color: done ? GREEN : '#64748b', fontSize: 28 }}>●</span>
          <span style={{ ...BODY, color: TEXT }}><DataField fieldId={`s31.b${i}`} liveValue={t as string} /></span>
        </div>
      ))}
    </div>
    <div className="flex gap-8 mt-8" style={{ ...SMALL, color: MUTED }}>
      <span><span style={{ color: GREEN }}>●</span> Desenvolvido</span>
      <span><span style={{ color: '#64748b' }}>●</span> A desenvolver</span>
    </div>
  </Pad>
);

// ── Roadmap ────────────────────────────────────────────────────────────────
function RoadmapSlide({ year, title, items, id }: { year: string; title: string; items: string[]; id: string }) {
  return (
    <Pad p="140px 200px 100px">
      <div style={KICKER}>Roadmap Estratégico 2025–2030</div>
      <h2 style={{ ...H2, color: '#fff', marginTop: 12 }}>
        <span style={{ color: GREEN }}>{year}</span> — {title}
      </h2>
      <GreenBar />
      <ul style={{ marginTop: 16 }}>
        {items.map((it, i) => (
          <li key={i} className="flex gap-4 py-3" style={{ ...BODY, color: TEXT, fontSize: 24 }}>
            <span style={{ color: GREEN, fontWeight: 700 }}>→</span>
            <DataField fieldId={`${id}.b${i}`} liveValue={it} />
          </li>
        ))}
      </ul>
    </Pad>
  );
}
export const Slide32 = () => (<RoadmapSlide year="2025" title="Consolidação de Produto + Bases de Expansão" id="s32"
  items={['Lançamento da plataforma Oxy + Gênio', 'Desenvolvimento do Smart Banking no WhatsApp', 'Integração com Oxy para sincronização bancária em tempo real']} />);
export const Slide33 = () => (<RoadmapSlide year="2026" title="Lançamento e Consolidação do BPO Financeiro 4.0" id="s33"
  items={['BPO 4.0 100% via WhatsApp', 'BAAS com banking inteligente integrado', 'Forte crescimento de base de clientes', 'Atingir +3K clientes ativos']} />);
export const Slide34 = () => (<RoadmapSlide year="2028" title="Expansão Internacional" id="s34"
  items={['Operação consolidada nos EUA', 'Replicação da metodologia em mercados LATAM', 'Maior ecossistema de gestão financeira para PMEs da América Latina']} />);
export const Slide35 = () => (<RoadmapSlide year="2030" title="Expansão e liquidez estratégica" id="s35"
  items={['Expansão contínua de produtos com foco em IA e finanças inteligentes', 'Liquidez estratégica para founders e investidores']} />);

// ── Citações SaaS Capital ──────────────────────────────────────────────────
function QuoteSlide({ quote, source, id }: { quote: string; source: string; id: string }) {
  return (
    <PadCenter p="0 200px">
      <div style={KICKER}>Valuation · Benchmark</div>
      <div style={{ ...H1, fontSize: 80, color: '#fff', marginTop: 24, lineHeight: 1.1 }}>
        "<DataField fieldId={`${id}.q`} liveValue={quote} />"
      </div>
      <div style={{ ...BODY, color: GREEN, marginTop: 24, fontSize: 26, fontStyle: 'italic' }}>
        — <DataField fieldId={`${id}.src`} liveValue={source} />
      </div>
    </PadCenter>
  );
}
export const Slide36 = () => <QuoteSlide id="s36" quote="O maior driver do múltiplo é a taxa de crescimento." source="SaaS Capital" />;
export const Slide37 = () => (
  <PadCenter p="0 200px">
    <div style={KICKER}>SaaS Capital · 2025</div>
    <h2 style={{ ...H2, color: '#fff', marginTop: 12 }}>Benchmarks públicos de múltiplos</h2>
    <div className="grid grid-cols-3 gap-8 mt-10">
      {[['Mediana SCI', '7× ARR'], ['Top 10 SaaS', '~14× ARR'], ['Low growth', '0,4 – 2,7× ARR']].map(([l, v], i) => (
        <div key={i} style={{ background: NAVY_2, padding: 32, borderRadius: 12, borderTop: `4px solid ${GREEN}`, textAlign: 'center' }}>
          <div style={{ ...BODY, color: MUTED }}>{l}</div>
          <div style={{ ...H1, fontSize: 64, color: GREEN, marginTop: 8 }}><DataField fieldId={`s37.${i}`} liveValue={v} /></div>
        </div>
      ))}
    </div>
  </PadCenter>
);
export const Slide38 = () => <QuoteSlide id="s38" quote="Empresas com crescimento baixo se concentram entre 1–3× ARR." source="SaaS Capital" />;

// ── Slide 39: O2 = 10× ARR (ARR real do engine) ────────────────────────────
export const Slide39 = () => {
  const { model } = useFinancialModel();
  const arr2025 = getARR(model, 2025);
  const arr2026 = getARR(model, 2026);
  const valuation = arr2025 * 10;
  return (
    <PadCenter p="0 160px">
      <div style={KICKER}>Valuation O2</div>
      <h2 style={{ ...H2, color: '#fff', marginTop: 12, fontSize: 48 }}>Multiplicador acompanha velocidade e qualidade de crescimento</h2>
      <p style={{ ...BODY, color: TEXT, marginTop: 16, fontSize: 24, maxWidth: 1400 }}>
        <DataField fieldId="s39.desc" liveValue="A O2 entrega crescimento acelerado + diferencial tecnológico + potencial de expansão internacional." />
      </p>
      <div className="mt-12 grid grid-cols-3 gap-8">
        <div style={{ background: NAVY_2, padding: 28, borderRadius: 12, borderTop: `4px solid ${GREEN}` }}>
          <div style={{ ...SMALL, color: MUTED }}>ARR 2025 (MRR Dez × 12)</div>
          <div style={{ ...H1, fontSize: 56, color: '#fff', marginTop: 8 }}>R$ <DataField fieldId="s39.arr2025" liveValue={arr2025} format={fmtMillions} /></div>
        </div>
        <div style={{ background: NAVY_2, padding: 28, borderRadius: 12, borderTop: `4px solid ${GREEN}` }}>
          <div style={{ ...SMALL, color: MUTED }}>ARR 2026 projetado</div>
          <div style={{ ...H1, fontSize: 56, color: '#fff', marginTop: 8 }}>R$ <DataField fieldId="s39.arr2026" liveValue={arr2026} format={fmtMillions} /></div>
        </div>
        <div style={{ background: NAVY_2, padding: 28, borderRadius: 12, borderLeft: `5px solid ${GREEN}` }}>
          <div style={{ ...SMALL, color: MUTED }}>Múltiplo aplicado</div>
          <div style={{ ...H1, fontSize: 88, color: GREEN, marginTop: 8 }}><DataField fieldId="s39.mult" liveValue="10×" /></div>
          <div style={{ ...SMALL, color: TEXT }}>ARR</div>
        </div>
      </div>
      <div className="mt-8" style={{ background: NAVY_2, padding: 28, borderRadius: 12, borderLeft: `6px solid ${GREEN}` }}>
        <div style={{ ...BODY, color: MUTED }}>Valuation implícito (10× ARR 2025)</div>
        <div style={{ ...H1, fontSize: 96, color: GREEN, marginTop: 4 }}>
          R$ <DataField fieldId="s39.val" liveValue={valuation} format={fmtMillions} />
        </div>
      </div>
    </PadCenter>
  );
};

// ── Slide 40: Closing ──────────────────────────────────────────────────────
export const Slide40 = () => (
  <PadCenter p="0 200px">
    <div style={KICKER}>Por que agora</div>
    <div style={{ ...H1, fontSize: 80, color: '#fff', marginTop: 24, lineHeight: 1.1 }}>
      "<DataField fieldId="s40.q" liveValue="A O2 Inc. não é apenas um SaaS. É a plataforma que está transformando a forma como o empreendedor brasileiro toma decisões — com tecnologia, inteligência e velocidade." />"
    </div>
    <p style={{ ...BODY, color: GREEN, marginTop: 32, fontSize: 32, fontStyle: 'italic' }}>
      <DataField fieldId="s40.sub" liveValue="Às vezes, o que o empreendedor precisa é de um fôlego." />
    </p>
  </PadCenter>
);

// ── Slide 41: Obrigado ─────────────────────────────────────────────────────
export const Slide41 = () => (
  <div className="absolute inset-0 flex flex-col justify-center items-center text-center">
    <div style={{ ...H1, fontSize: 96, color: '#fff' }}>O2 INC.</div>
    <div style={{ ...H1, fontSize: 200, color: GREEN, marginTop: 32, lineHeight: 0.9 }}>
      <DataField fieldId="s41.thanks" liveValue="Obrigado!" />
    </div>
    <p style={{ ...BODY, color: MUTED, marginTop: 32 }}>
      <DataField fieldId="s41.contact" liveValue="contato@o2inc.com.br · www.o2inc.com.br" />
    </p>
  </div>
);

// ── Registry ───────────────────────────────────────────────────────────────
export interface SlideDef {
  id: number;
  title: string;
  Component: React.ComponentType;
  variant?: 'dark' | 'light';
}

export const SLIDES: SlideDef[] = [
  { id: 1, title: 'Capa', Component: Slide01 },
  { id: 2, title: 'Ecossistema', Component: Slide02 },
  { id: 3, title: 'Overview & KPIs', Component: Slide03 },
  { id: 4, title: 'Por que existimos', Component: Slide04 },
  { id: 5, title: 'O problema do mercado', Component: Slide05 },
  { id: 6, title: 'Sistematizando o problema', Component: Slide06 },
  { id: 7, title: 'Custo da estratégia errada', Component: Slide07 },
  { id: 8, title: 'Metodologia Oxigênio', Component: Slide08 },
  { id: 9, title: 'Sistematizando a solução', Component: Slide09 },
  { id: 10, title: 'Benefícios', Component: Slide10 },
  { id: 11, title: 'Evolução do mercado', Component: Slide11 },
  { id: 12, title: 'TAM / SAM / SOM', Component: Slide12 },
  { id: 13, title: 'Produtos overview', Component: Slide13 },
  { id: 14, title: 'SaaS + AI · Oxy + Gênio', Component: Slide14 },
  { id: 15, title: 'SaaS + AI · 10 funcionalidades', Component: Slide15 },
  { id: 16, title: 'CaaS · B2B + B2C', Component: Slide16 },
  { id: 17, title: 'Marketplace de CFOs', Component: Slide17 },
  { id: 18, title: 'BaaS · Smart Banking', Component: Slide18 },
  { id: 19, title: 'Modelo de Negócio', Component: Slide19 },
  { id: 20, title: 'Time C-Level', Component: Slide20 },
  { id: 21, title: 'Operação USA', Component: Slide21 },
  { id: 22, title: 'NPS & Clientes', Component: Slide22 },
  { id: 23, title: 'KPIs M&S', Component: Slide23 },
  { id: 24, title: 'Faturamento 2022→2030', Component: Slide24 },
  { id: 25, title: 'Receita Mensal 2025', Component: Slide25 },
  { id: 26, title: 'Marketing 2024→2030', Component: Slide26 },
  { id: 27, title: 'Projeções FY25–FY30', Component: Slide27 },
  { id: 28, title: 'Crescimento YoY', Component: Slide28 },
  { id: 29, title: 'Resultado Consolidado', Component: Slide29 },
  { id: 30, title: 'Geração de caixa', Component: Slide30 },
  { id: 31, title: 'Moat competitivo', Component: Slide31 },
  { id: 32, title: 'Roadmap 2025', Component: Slide32 },
  { id: 33, title: 'Roadmap 2026', Component: Slide33 },
  { id: 34, title: 'Roadmap 2028', Component: Slide34 },
  { id: 35, title: 'Roadmap 2030', Component: Slide35 },
  { id: 36, title: 'SaaS Capital · driver', Component: Slide36 },
  { id: 37, title: 'Benchmarks SaaS Capital', Component: Slide37 },
  { id: 38, title: 'SaaS Capital · low growth', Component: Slide38 },
  { id: 39, title: 'O2 = 10× ARR', Component: Slide39 },
  { id: 40, title: 'Por que agora', Component: Slide40 },
  { id: 41, title: 'Obrigado', Component: Slide41 },
];
