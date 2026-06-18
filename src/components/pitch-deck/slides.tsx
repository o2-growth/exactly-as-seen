import { useFinancialModel } from '@/contexts/FinancialModelContext';
import DataField from './DataField';
import { fmtThousands, fmtPct, yoyPct, fmtMillions } from '@/lib/pitchDeck/fieldRegistry';

const GREEN = '#6BF169';
const NAVY = '#0f172a';
const NAVY_2 = '#1e293b';

// ── Shared atoms ────────────────────────────────────────────────────────────
const H1: React.CSSProperties = { fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700, fontSize: 96, lineHeight: 1.02, letterSpacing: '-0.04em' };
const H2: React.CSSProperties = { fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700, fontSize: 64, lineHeight: 1.05, letterSpacing: '-0.03em' };
const H3: React.CSSProperties = { fontFamily: 'Space Grotesk, sans-serif', fontWeight: 600, fontSize: 40, lineHeight: 1.15 };
const BODY: React.CSSProperties = { fontFamily: 'Inter, sans-serif', fontSize: 28, lineHeight: 1.4 };
const KICKER: React.CSSProperties = { fontFamily: 'Space Grotesk, sans-serif', fontSize: 22, letterSpacing: '0.18em', textTransform: 'uppercase', color: GREEN, fontWeight: 600 };

function GreenBar() {
  return <div style={{ width: 80, height: 6, background: GREEN, marginBottom: 32 }} />;
}

// ── Slide 1: Capa ───────────────────────────────────────────────────────────
export const Slide01 = () => (
  <div className="absolute inset-0 flex flex-col justify-center" style={{ paddingLeft: 160 }}>
    <div style={KICKER}>2025</div>
    <h1 style={{ ...H1, fontSize: 140, color: '#fff', marginTop: 24 }}>O2 INC.</h1>
    <h2 style={{ ...H2, color: GREEN, marginTop: 40 }}>
      <DataField fieldId="s01.tagline" liveValue="O futuro das finanças, HOJE!" />
    </h2>
    <p style={{ ...BODY, color: '#94a3b8', marginTop: 32 }}>
      <DataField fieldId="s01.subtagline" liveValue="Metodologia, Tecnologia e IA." />
    </p>
  </div>
);

// ── Slide 2: Intro 3 pilares ────────────────────────────────────────────────
export const Slide02 = () => (
  <div className="absolute inset-0 flex flex-col justify-center" style={{ paddingLeft: 160, paddingRight: 160 }}>
    <div style={KICKER}>O Ecossistema</div>
    <h1 style={{ ...H2, color: '#fff', marginTop: 24, marginBottom: 80 }}>
      <DataField fieldId="s02.title" liveValue="O futuro das finanças, hoje." />
    </h1>
    <div className="grid grid-cols-3 gap-10">
      {[
        ['CFO as a Service', 'Estratégia financeira de alto nível, sob demanda.'],
        ['Primeiro CFO 24/7 do Brasil', 'IA proprietária treinada em finanças corporativas.'],
        ['BPO 4.0 no WhatsApp + Smart Banking', 'Execução financeira automatizada e integrada.'],
      ].map(([t, d], i) => (
        <div key={i} style={{ background: NAVY_2, borderTop: `4px solid ${GREEN}`, padding: 40, borderRadius: 12 }}>
          <div style={{ ...H3, color: '#fff' }}>
            <DataField fieldId={`s02.card${i}.title`} liveValue={t} />
          </div>
          <p style={{ ...BODY, color: '#94a3b8', marginTop: 16 }}>
            <DataField fieldId={`s02.card${i}.desc`} liveValue={d} />
          </p>
        </div>
      ))}
    </div>
  </div>
);

// ── Slide 3: Overview / KPIs ────────────────────────────────────────────────
export const Slide03 = () => {
  const { model } = useFinancialModel();
  const r2024 = model.years[2024]?.grossRevenue ?? 0;
  const r2025 = model.years[2025]?.grossRevenue ?? 0;
  const r2026 = model.years[2026]?.grossRevenue ?? 0;
  const growth = yoyPct(r2025, r2024);
  const mult2026 = r2024 > 0 ? r2026 / r2024 : 0;
  const cmPct = model.years[2025]?.contributionMarginPct ?? 0;
  return (
    <div className="absolute inset-0 flex flex-col" style={{ padding: '160px 160px 120px' }}>
      <div style={KICKER}>Overview</div>
      <h2 style={{ ...H2, color: '#fff', marginTop: 16 }}>
        A plataforma de inteligência financeira do empreendedor
      </h2>
      <p style={{ ...BODY, color: '#cbd5e1', marginTop: 24, maxWidth: 1400 }}>
        <DataField fieldId="s03.desc" liveValue="Conexão de dados, inteligência estratégica e execução financeira automatizada — tudo em uma única plataforma." />
      </p>
      <div className="grid grid-cols-3 gap-8 mt-12">
        {[
          [`${growth.toFixed(0)}%`, 'Crescimento YoY 2024→2025', `s03.kpi.growth`, growth, (v: number) => `${v.toFixed(0)}%`],
          [`${mult2026.toFixed(1)}x`, 'Receita 2026 vs 2024', `s03.kpi.mult`, mult2026, (v: number) => `${v.toFixed(1)}x`],
          [`${cmPct.toFixed(0)}%`, 'Margem de Contribuição', `s03.kpi.cm`, cmPct, (v: number) => `${v.toFixed(0)}%`],
        ].map(([_, label, fid, val, fmt]: any, i) => (
          <div key={i} style={{ background: NAVY_2, padding: 36, borderRadius: 12, borderLeft: `6px solid ${GREEN}` }}>
            <div style={{ ...H1, color: GREEN, fontSize: 96 }}>
              <DataField fieldId={fid} liveValue={val} format={fmt} />
            </div>
            <div style={{ ...BODY, color: '#cbd5e1', marginTop: 12 }}>{label}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ── Slide 4: Por que existimos ──────────────────────────────────────────────
export const Slide04 = () => (
  <div className="absolute inset-0 flex flex-col justify-center" style={{ padding: '0 200px' }}>
    <div style={KICKER}>O Problema</div>
    <h1 style={{ ...H2, color: '#fff', marginTop: 24 }}>
      <DataField fieldId="s04.title" liveValue="Nascemos para resolver um grande problema do empreendedor" />
    </h1>
    <p style={{ ...BODY, color: '#cbd5e1', marginTop: 40, maxWidth: 1400 }}>
      <DataField fieldId="s04.p1" liveValue="Toda empresa precisa de gestão financeira estratégica para sobreviver." />
    </p>
    <p style={{ ...BODY, color: '#94a3b8', marginTop: 24, maxWidth: 1400 }}>
      <DataField fieldId="s04.p2" liveValue="Mas montar um setor financeiro estratégico internamente é complexo e caro." />
    </p>
  </div>
);

// ── Slide 5: Estatística ────────────────────────────────────────────────────
export const Slide05 = () => (
  <div className="absolute inset-0 flex flex-col justify-center" style={{ padding: '0 200px' }}>
    <div style={KICKER}>O Custo de Não Ter Gestão</div>
    <h1 style={{ ...H1, color: '#fff', marginTop: 24 }}>
      <DataField fieldId="s05.stat" liveValue="+2 milhões" />
    </h1>
    <h2 style={{ ...H2, color: GREEN, marginTop: 16 }}>
      <DataField fieldId="s05.title" liveValue="de empresas fecham as portas por ano no Brasil." />
    </h2>
    <div className="grid grid-cols-3 gap-6 mt-16">
      {['Serasa: 54,9% dos endividados são serviços', '48% das novas empresas fecham em até 3 anos', 'Gestão ineficiente é a 2ª maior causa'].map((t, i) => (
        <div key={i} style={{ background: NAVY_2, padding: 24, borderRadius: 10, ...BODY, color: '#cbd5e1', fontSize: 22 }}>
          <DataField fieldId={`s05.src${i}`} liveValue={t} />
        </div>
      ))}
    </div>
  </div>
);

// ── Slide 6: Sistematizando o problema ──────────────────────────────────────
export const Slide06 = () => (
  <div className="absolute inset-0 flex flex-col" style={{ padding: '160px 100px 120px' }}>
    <div style={KICKER}>Diagnóstico</div>
    <h2 style={{ ...H2, color: '#fff', marginTop: 16 }}>Sistematizando o problema</h2>
    <p style={{ ...BODY, color: '#94a3b8', marginTop: 8 }}>Experiência descentralizada e cara</p>
    <div className="grid grid-cols-5 gap-3 mt-10">
      {['Processos', 'Dados Fidedignos', 'Informações Inteligentes', 'Análise Estratégica', 'Plano de Ação Efetivo'].map((h, i) => (
        <div key={i} style={{ background: GREEN, color: NAVY, padding: 16, borderRadius: 8, fontWeight: 700, fontSize: 20, textAlign: 'center' }}>
          {h}
        </div>
      ))}
    </div>
    {['Empreendedor', 'Gestor financeiro'].map((row, ri) => (
      <div key={ri} className="grid grid-cols-5 gap-3 mt-3" style={{ alignItems: 'stretch' }}>
        {[0, 1, 2, 3, 4].map(ci => (
          <div key={ci} style={{ background: NAVY_2, padding: 16, borderRadius: 8, fontSize: 16, color: '#cbd5e1', lineHeight: 1.3 }}>
            {ci === 0 && <div style={{ color: GREEN, fontWeight: 700, marginBottom: 8 }}>{row}</div>}
            <DataField fieldId={`s06.r${ri}.c${ci}`} liveValue={ci === 0 ? 'Sem processos mapeados; equipe trabalha sem visibilidade.' : ['Não sabe onde buscar dados.', 'Decide por feeling.', 'Sem rituais; decisões empíricas.', 'Sempre executando, sem estratégia.'][ci - 1]} />
          </div>
        ))}
      </div>
    ))}
  </div>
);

// ── Slide 7: Custo da estratégia errada ─────────────────────────────────────
export const Slide07 = () => {
  const items: [string, number][] = [
    ['1 CFO', 25000], ['1 Diretor de Tecnologia', 18000], ['1 Desenvolvedor/Programador', 8500],
    ['1 Analista de Dados', 6500], ['1 Analista Financeiro', 6500], ['1 Analista de FP&A', 5000],
    ['ERP, Pacote Office e Power BI', 2500],
  ];
  const total = items.reduce((s, [, v]) => s + v, 0);
  return (
    <div className="absolute inset-0 flex flex-col" style={{ padding: '160px 200px 120px' }}>
      <div style={KICKER}>O Custo da Estratégia Errada</div>
      <h2 style={{ ...H2, color: '#fff', marginTop: 16 }}>Quanto custa montar um setor financeiro estratégico?</h2>
      <div className="mt-10" style={{ background: NAVY_2, borderRadius: 12, padding: 40 }}>
        {items.map(([label, v], i) => (
          <div key={i} className="flex justify-between items-center py-3" style={{ borderBottom: '1px solid #334155', ...BODY, color: '#cbd5e1' }}>
            <span><DataField fieldId={`s07.it${i}.label`} liveValue={label} /></span>
            <span style={{ fontWeight: 600 }}>R$ <DataField fieldId={`s07.it${i}.val`} liveValue={v} format={fmtThousands} /></span>
          </div>
        ))}
        <div className="flex justify-between items-center pt-6 mt-4" style={{ borderTop: `3px solid ${GREEN}` }}>
          <span style={{ ...H3, color: '#fff' }}>TOTAL MENSAL</span>
          <span style={{ ...H3, color: GREEN }}>R$ <DataField fieldId="s07.total" liveValue={total} format={fmtThousands} /></span>
        </div>
      </div>
    </div>
  );
};

// ── Slide 8: Metodologia ────────────────────────────────────────────────────
export const Slide08 = () => (
  <div className="absolute inset-0 flex flex-col" style={{ padding: '160px 160px 120px' }}>
    <div style={KICKER}>Nossa Metodologia</div>
    <h2 style={{ ...H2, color: '#fff', marginTop: 16 }}>Metodologia Oxigênio Empresarial</h2>
    <div className="grid grid-cols-4 gap-6 mt-12">
      {[
        ['DATAFLOW', 'Mapeamento de Dados', 'Faturamento · Contas a Receber · Compras · Despesas · Conciliação'],
        ['DIAPA', 'Dados Fidedignos', 'Criação · Input · Categorização · Output → DRE · Fluxo de Caixa'],
        ['PLANO DE AÇÃO', 'Efetivo', 'Lucratividade · Liquidez · Estrutura de Capital · OSIs · Rituais'],
        ['LUXA', 'Lucro + Caixa', 'Break Even · Rentabilidade · Compras · PMR · PMP · Estoque · Capital de Giro'],
      ].map(([k, t, d], i) => (
        <div key={i} style={{ background: NAVY_2, padding: 28, borderRadius: 12, borderTop: `4px solid ${GREEN}` }}>
          <div style={{ color: GREEN, fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 22, letterSpacing: '0.1em' }}>{k}</div>
          <div style={{ ...H3, color: '#fff', fontSize: 28, marginTop: 12 }}>{t}</div>
          <p style={{ ...BODY, color: '#94a3b8', fontSize: 18, marginTop: 12 }}>{d}</p>
        </div>
      ))}
    </div>
    <p style={{ ...BODY, fontSize: 18, color: '#64748b', marginTop: 40 }}>
      Registro autoral INPI · Pedro Ghiorzzi de Albite Silva · Rio de Janeiro, 20/06/2024
    </p>
  </div>
);

// ── Slide 9: Sistematizando a solução ───────────────────────────────────────
export const Slide09 = () => (
  <div className="absolute inset-0 flex flex-col" style={{ padding: '160px 200px 120px' }}>
    <div style={KICKER}>Solução</div>
    <h2 style={{ ...H2, color: '#fff', marginTop: 16 }}>Sistematizando a solução</h2>
    <p style={{ ...BODY, color: '#94a3b8', marginTop: 8 }}>Centralizada e acessível</p>
    <div className="grid grid-cols-3 gap-8 mt-12">
      {[
        ['Plataforma SaaS + IA', 'Oxy + Gênio integram ERPs, geram análises e respondem dúvidas no WhatsApp.'],
        ['CFO as a Service', 'Profissional sênior treinado pela O2 com toda a metodologia.'],
        ['Smart Banking', 'Conta digital PJ, conciliação multibancos e gestão de fluxo via WhatsApp.'],
      ].map(([t, d], i) => (
        <div key={i} style={{ background: NAVY_2, padding: 36, borderRadius: 12, borderTop: `4px solid ${GREEN}` }}>
          <div style={{ ...H3, color: '#fff' }}>{t}</div>
          <p style={{ ...BODY, color: '#cbd5e1', marginTop: 16 }}>{d}</p>
        </div>
      ))}
    </div>
  </div>
);

// ── Slide 10: Benefícios ────────────────────────────────────────────────────
export const Slide10 = () => (
  <div className="absolute inset-0 flex flex-col" style={{ padding: '160px 200px 120px' }}>
    <div style={KICKER}>Benefícios e Economias</div>
    <h2 style={{ ...H2, color: '#fff', marginTop: 16 }}>O que o cliente ganha</h2>
    <div className="grid grid-cols-2 gap-8 mt-12">
      {[
        ['Redução de custo', 'Em vez de R$ 72k/mês com equipe própria, paga uma fração com a O2.'],
        ['Decisões com dados', 'Análises em tempo real, sem retrabalho.'],
        ['Time financeiro confiante', 'Profissional ganha capacidade técnica e entrega mais valor.'],
        ['Menor turnover', 'Equipe deixa de operar no apagar incêndios.'],
      ].map(([t, d], i) => (
        <div key={i} className="flex gap-6" style={{ background: NAVY_2, padding: 32, borderRadius: 12 }}>
          <div style={{ background: GREEN, color: NAVY, width: 56, height: 56, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 24 }}>{i + 1}</div>
          <div>
            <div style={{ ...H3, color: '#fff', fontSize: 30 }}>{t}</div>
            <p style={{ ...BODY, color: '#94a3b8', marginTop: 6 }}>{d}</p>
          </div>
        </div>
      ))}
    </div>
  </div>
);

// ── Slide 11: Evolução do mercado ───────────────────────────────────────────
export const Slide11 = () => {
  const eras = [
    ['1970–1980', 'Controle Manual'], ['1990–2000', 'Planilhas'],
    ['2000–2010', 'ERPs'], ['2010–2020', 'BI e Dashboards'],
    ['2020 →', 'SaaS + IA + Banking'],
  ];
  return (
    <div className="absolute inset-0 flex flex-col" style={{ padding: '160px 160px 120px' }}>
      <div style={KICKER}>Mercado</div>
      <h2 style={{ ...H2, color: '#fff', marginTop: 16 }}>Evolução do mercado</h2>
      <div className="flex items-stretch gap-4 mt-16">
        {eras.map(([year, label], i) => (
          <div key={i} style={{ flex: 1, background: i === eras.length - 1 ? GREEN : NAVY_2, color: i === eras.length - 1 ? NAVY : '#cbd5e1', padding: 32, borderRadius: 12 }}>
            <div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 22 }}>{year}</div>
            <div style={{ ...H3, fontSize: 26, marginTop: 12 }}>{label}</div>
          </div>
        ))}
      </div>
      <div className="mt-16 text-center">
        <div style={{ ...H1, fontSize: 96, color: GREEN }}>O2 INC.</div>
        <p style={{ ...BODY, color: '#94a3b8', marginTop: 12 }}>A plataforma da nova era.</p>
      </div>
    </div>
  );
};

// ── Slide 12: Mercado gigante ──────────────────────────────────────────────
export const Slide12 = () => (
  <div className="absolute inset-0 flex flex-col" style={{ padding: '160px 200px 120px' }}>
    <div style={KICKER}>TAM</div>
    <h2 style={{ ...H2, color: '#fff', marginTop: 16 }}>Um mercado gigante: 6 milhões de empresas no Brasil</h2>
    <div className="grid grid-cols-3 gap-8 mt-16">
      {[
        ['6M', 'PMEs no Brasil'], ['R$ 2 Tri', 'Movimentação anual'], ['~30%', 'do PIB nacional'],
      ].map(([n, l], i) => (
        <div key={i} style={{ background: NAVY_2, padding: 40, borderRadius: 12, textAlign: 'center', borderTop: `4px solid ${GREEN}` }}>
          <div style={{ ...H1, fontSize: 120, color: GREEN }}>
            <DataField fieldId={`s12.k${i}.n`} liveValue={n} />
          </div>
          <div style={{ ...BODY, color: '#cbd5e1', marginTop: 12 }}>
            <DataField fieldId={`s12.k${i}.l`} liveValue={l} />
          </div>
        </div>
      ))}
    </div>
    <p style={{ ...BODY, color: '#94a3b8', marginTop: 56, fontStyle: 'italic', maxWidth: 1200 }}>
      "As PMEs brasileiras movimentam mais de R$ 2 trilhões por ano, representando quase 30% do PIB nacional."
    </p>
  </div>
);

// ── Slide 13: Produtos overview ────────────────────────────────────────────
export const Slide13 = () => (
  <div className="absolute inset-0 flex flex-col justify-center" style={{ padding: '0 200px' }}>
    <div style={KICKER}>Produtos</div>
    <h2 style={{ ...H2, color: '#fff', marginTop: 16, marginBottom: 80 }}>Três linhas de produto, um ecossistema</h2>
    <div className="grid grid-cols-3 gap-10">
      {[
        ['SAAS + AI', 'Oxy + Gênio'], ['CAAS', 'CFO as a Service'], ['BAAS', 'Smart Banking'],
      ].map(([cat, name], i) => (
        <div key={i} style={{ background: NAVY_2, padding: 48, borderRadius: 16, borderTop: `6px solid ${GREEN}` }}>
          <div style={{ color: GREEN, fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 28, letterSpacing: '0.1em' }}>{cat}</div>
          <div style={{ ...H3, color: '#fff', fontSize: 36, marginTop: 16 }}>{name}</div>
        </div>
      ))}
    </div>
  </div>
);

// ── Slides 14–18: produtos detalhados ──────────────────────────────────────
function ProductSlide({ cat, name, bullets, id }: { cat: string; name: string; bullets: string[]; id: string }) {
  return (
    <div className="absolute inset-0 flex flex-col" style={{ padding: '160px 200px 120px' }}>
      <div style={KICKER}>Produtos · {cat}</div>
      <h2 style={{ ...H2, color: '#fff', marginTop: 16 }}>{name}</h2>
      <GreenBar />
      <ul style={{ marginTop: 24 }}>
        {bullets.map((b, i) => (
          <li key={i} className="flex gap-4 py-2" style={{ ...BODY, color: '#cbd5e1' }}>
            <span style={{ color: GREEN, fontWeight: 700, minWidth: 32 }}>{String(i + 1).padStart(2, '0')}</span>
            <DataField fieldId={`${id}.b${i}`} liveValue={b} />
          </li>
        ))}
      </ul>
    </div>
  );
}
export const Slide14 = () => (
  <ProductSlide cat="SAAS + AI" name="Oxy + Gênio" id="s14"
    bullets={['Bem-vindo: onboarding guiado em minutos.', 'Login com email ou Google.', 'Conexão direta ao seu workspace.']} />
);
export const Slide15 = () => (
  <ProductSlide cat="SAAS + AI · Oxy + Gênio" name="Funcionalidades-chave" id="s15"
    bullets={[
      'Integração nativa com ERPs.',
      'Categorização automática por IA.',
      'DRE, Fluxo de Caixa e indicadores em tempo real.',
      'Gênio: assistente que responde sobre seus dados via WhatsApp.',
      'Questione lançamentos específicos e entenda despesas fora do padrão.',
    ]} />
);
export const Slide16 = () => (
  <ProductSlide cat="CAAS" name="CFO as a Service · Para a Empresa (B2B)" id="s16"
    bullets={[
      'CFO sênior dedicado, treinado na metodologia O2.',
      'Reuniões mensais com diagnóstico, plano de ação e acompanhamento.',
      'Acesso à plataforma Oxy + Gênio incluso.',
      'Gestão de fluxo, planejamento orçamentário e valuation.',
      'Programa de capacitação contínua e geração de oportunidades de negócio.',
    ]} />
);
export const Slide17 = () => (
  <div className="absolute inset-0 flex flex-col justify-center" style={{ padding: '0 200px' }}>
    <div style={KICKER}>CFO · Marketplace</div>
    <h2 style={{ ...H2, color: '#fff', marginTop: 16 }}>Agora empresas e CFOs têm um novo ponto de encontro</h2>
    <p style={{ ...BODY, color: GREEN, marginTop: 32, fontSize: 36 }}>
      <DataField fieldId="s17.tagline" liveValue="Tecnologia, estratégia e crescimento reunidos pela O2 Inc." />
    </p>
    <div className="grid grid-cols-2 gap-10 mt-16">
      <div style={{ background: NAVY_2, padding: 32, borderRadius: 12 }}>
        <div style={{ ...H3, color: GREEN }}>Para empresas</div>
        <p style={{ ...BODY, color: '#cbd5e1', marginTop: 12 }}>Acesso a CFOs sênior validados, sem custo de seleção e gestão.</p>
      </div>
      <div style={{ background: NAVY_2, padding: 32, borderRadius: 12 }}>
        <div style={{ ...H3, color: GREEN }}>Para CFOs</div>
        <p style={{ ...BODY, color: '#cbd5e1', marginTop: 12 }}>Quer ser mais que um financeiro: quer ser um gerador de negócios.</p>
      </div>
    </div>
  </div>
);
export const Slide18 = () => (
  <ProductSlide cat="BAAS" name="Banking as a Service" id="s18"
    bullets={[
      'Conta digital PJ integrada ao WhatsApp.',
      'Pagamentos, cobranças e Pix por comando.',
      'Conciliação multibancos com inteligência.',
      'Gestão de múltiplas contas em um único lugar.',
    ]} />
);

// ── Slide 19: Modelo de Negócio (tickets) ──────────────────────────────────
export const Slide19 = () => {
  const { assumptions } = useFinancialModel();
  const t = assumptions.tickets;
  const block = (label: string, val: number, fid: string) => (
    <div className="flex justify-between items-center py-3" style={{ borderBottom: '1px solid #334155' }}>
      <span style={{ ...BODY, color: '#cbd5e1' }}>{label}</span>
      <span style={{ ...BODY, color: GREEN, fontWeight: 600 }}>
        R$ <DataField fieldId={fid} liveValue={val} format={(v) => v.toLocaleString('pt-BR')} />
      </span>
    </div>
  );
  return (
    <div className="absolute inset-0 flex flex-col" style={{ padding: '160px 200px 120px' }}>
      <div style={KICKER}>Modelo de Negócio</div>
      <h2 style={{ ...H2, color: '#fff', marginTop: 16 }}>Ticket médio por produto</h2>
      <div className="grid grid-cols-2 gap-12 mt-12">
        <div style={{ background: NAVY_2, padding: 32, borderRadius: 12 }}>
          <div style={{ ...H3, color: GREEN, marginBottom: 16 }}>CAAS</div>
          {block('Setup (one-shot)', t.caasSetup, 's19.caasSetup')}
          {block('Assessoria', t.caasAssessoria, 's19.caasAssessoria')}
          {block('Enterprise', t.caasEnterprise, 's19.caasEnterprise')}
          {block('Corporate', t.caasCorporate, 's19.caasCorporate')}
        </div>
        <div style={{ background: NAVY_2, padding: 32, borderRadius: 12 }}>
          <div style={{ ...H3, color: GREEN, marginBottom: 16 }}>SAAS</div>
          {block('Oxy', t.saasOxy, 's19.oxy')}
          {block('Oxy + Gênio', t.saasOxyGenio, 's19.oxyGenio')}
          {block('Oxy + Gênio Especialista', t.saasOxyGenioEsp, 's19.oxyGenioEsp')}
        </div>
      </div>
      <p style={{ ...BODY, color: '#94a3b8', marginTop: 32, fontSize: 20 }}>
        + Success Fee, Add-ons, Up-sell, Cross-sell e BAAS.
      </p>
    </div>
  );
};

// ── Slide 20–21: Time ──────────────────────────────────────────────────────
function TeamSlide({ title, members, id }: { title: string; members: [string, string, string][]; id: string }) {
  return (
    <div className="absolute inset-0 flex flex-col" style={{ padding: '160px 160px 120px' }}>
      <div style={KICKER}>Time</div>
      <h2 style={{ ...H2, color: '#fff', marginTop: 16 }}>{title}</h2>
      <div className="grid grid-cols-3 gap-8 mt-16">
        {members.map(([name, role, bg], i) => (
          <div key={i} style={{ background: NAVY_2, padding: 32, borderRadius: 12, borderTop: `4px solid ${GREEN}` }}>
            <div style={{ width: 88, height: 88, borderRadius: '50%', background: '#334155', marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Space Grotesk', fontSize: 36, fontWeight: 700, color: GREEN }}>
              {name.split(' ').map(s => s[0]).slice(0, 2).join('')}
            </div>
            <div style={{ ...H3, color: '#fff', fontSize: 30 }}><DataField fieldId={`${id}.m${i}.name`} liveValue={name} /></div>
            <div style={{ ...BODY, color: GREEN, fontSize: 20, marginTop: 4 }}><DataField fieldId={`${id}.m${i}.role`} liveValue={role} /></div>
            <p style={{ ...BODY, color: '#94a3b8', fontSize: 18, marginTop: 12 }}><DataField fieldId={`${id}.m${i}.bg`} liveValue={bg} /></p>
          </div>
        ))}
      </div>
    </div>
  );
}
export const Slide20 = () => (
  <TeamSlide title="C-Level empreendedor e multidisciplinar" id="s20"
    members={[
      ['Pedro Albite', 'Founder & CEO', '15+ anos em finanças corporativas. Criador da metodologia Oxigênio Empresarial.'],
      ['Co-founder COO', 'Operações', 'Liderança operacional escalável, foco em processos e métricas.'],
      ['CTO', 'Tecnologia', 'Ex-sócio e líder em Stone, Cora e Nibo. UVA.'],
    ]} />
);
export const Slide21 = () => (
  <TeamSlide title="Sócios experientes lideram nossa operação USA" id="s21"
    members={[
      ['Partner US #1', 'GP / Investments', 'Citi · Wharton'],
      ['Partner US #2', 'Strategy', 'Berkeley Haas'],
      ['Partner US #3', 'Growth', 'PUC-SP · Wharton'],
    ]} />
);

// ── Slide 22: NPS ──────────────────────────────────────────────────────────
export const Slide22 = () => (
  <div className="absolute inset-0 flex flex-col justify-center" style={{ padding: '0 200px' }}>
    <div style={KICKER}>Clientes Satisfeitos</div>
    <h2 style={{ ...H2, color: '#fff', marginTop: 16 }}>Tudo começa com clientes satisfeitos</h2>
    <div className="flex items-end gap-16 mt-20">
      <div>
        <div style={{ ...H1, fontSize: 240, color: GREEN, lineHeight: 1 }}>
          <DataField fieldId="s22.nps" liveValue="88" />
        </div>
        <div style={{ ...H3, color: '#fff', marginTop: 8 }}>NPS</div>
      </div>
      <div style={{ flex: 1, background: NAVY_2, padding: 36, borderRadius: 12, borderLeft: `4px solid ${GREEN}` }}>
        <p style={{ ...BODY, color: '#cbd5e1', fontStyle: 'italic', fontSize: 26 }}>
          <DataField fieldId="s22.quote" liveValue='"A O2 transformou nossa visão financeira e nos deu confiança pra crescer."' />
        </p>
        <div style={{ ...BODY, color: GREEN, marginTop: 20, fontSize: 22 }}>
          — <DataField fieldId="s22.author" liveValue="Fernanda Curi · Executive Producer, Roof Studio 🇺🇸" />
        </div>
      </div>
    </div>
  </div>
);

// ── Slide 23: KPIs M&S ─────────────────────────────────────────────────────
export const Slide23 = () => {
  const { model } = useFinancialModel();
  const ltvCac = 8.9;
  const cmPct = model.years[2025]?.contributionMarginPct ?? 0;
  return (
    <div className="absolute inset-0 flex flex-col" style={{ padding: '160px 200px 120px' }}>
      <div style={KICKER}>Marketing & Comercial</div>
      <h2 style={{ ...H2, color: '#fff', marginTop: 16 }}>Principais KPIs</h2>
      <div className="grid grid-cols-3 gap-8 mt-12">
        {[
          ['LTV/CAC', `${ltvCac.toFixed(2)}`, 's23.ltvcac', ltvCac, (v: number) => v.toFixed(2)],
          ['Margem de Contribuição', `${cmPct.toFixed(1)}%`, 's23.cm', cmPct, fmtPct],
          ['NPS', '88', 's23.nps', 88, (v: number) => String(v)],
        ].map(([label, _, fid, val, fmt]: any, i) => (
          <div key={i} style={{ background: NAVY_2, padding: 36, borderRadius: 12, borderTop: `4px solid ${GREEN}` }}>
            <div style={{ ...BODY, color: '#94a3b8' }}>{label}</div>
            <div style={{ ...H1, fontSize: 96, color: GREEN, marginTop: 8 }}>
              <DataField fieldId={fid} liveValue={val} format={fmt} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ── Helper: chart de barras simples ────────────────────────────────────────
function BarChart({ data, format = fmtThousands, max }: { data: { label: string; value: number; fid?: string }[]; format?: (n: number) => string; max?: number }) {
  const m = max ?? Math.max(...data.map(d => d.value), 1);
  return (
    <div className="flex items-end gap-6 mt-12" style={{ height: 480 }}>
      {data.map((d, i) => {
        const h = (d.value / m) * 100;
        return (
          <div key={i} className="flex-1 flex flex-col items-center justify-end">
            <div style={{ ...BODY, color: GREEN, fontWeight: 700, marginBottom: 8 }}>
              {d.fid ? <DataField fieldId={d.fid} liveValue={d.value} format={format} /> : format(d.value)}
            </div>
            <div style={{ width: '70%', height: `${h}%`, background: `linear-gradient(180deg, ${GREEN} 0%, #4ade80 100%)`, borderRadius: '8px 8px 0 0', minHeight: 4 }} />
            <div style={{ ...BODY, color: '#cbd5e1', marginTop: 12, fontSize: 22 }}>{d.label}</div>
          </div>
        );
      })}
    </div>
  );
}

// ── Slide 24: Evolução do Faturamento ──────────────────────────────────────
export const Slide24 = () => {
  const { model } = useFinancialModel();
  const data = [2022, 2023, 2024, 2025].map(y => ({
    label: String(y), value: model.years[y as keyof typeof model.years]?.grossRevenue ?? 0, fid: `s24.${y}`,
  }));
  return (
    <div className="absolute inset-0 flex flex-col" style={{ padding: '160px 200px 120px' }}>
      <div style={KICKER}>Faturamento</div>
      <h2 style={{ ...H2, color: '#fff', marginTop: 16 }}>Evolução do Faturamento (R$ 000's)</h2>
      <BarChart data={data} />
    </div>
  );
};

// ── Slide 25: Evolução KPIs (quarters - estimativa via /4) ─────────────────
export const Slide25 = () => {
  const { model } = useFinancialModel();
  const r25 = (model.years[2025]?.grossRevenue ?? 0) / 4;
  const data = ['Q1-25', 'Q2-25', 'Q3-25', 'Q4-25'].map((q, i) => ({
    label: q, value: r25 * (0.7 + i * 0.2), fid: `s25.${q}`,
  }));
  return (
    <div className="absolute inset-0 flex flex-col" style={{ padding: '160px 200px 120px' }}>
      <div style={KICKER}>KPIs Financeiros</div>
      <h2 style={{ ...H2, color: '#fff', marginTop: 16 }}>Receita Bruta trimestral 2025 (R$ 000's)</h2>
      <BarChart data={data} />
    </div>
  );
};

// ── Slide 26: Marketing ────────────────────────────────────────────────────
export const Slide26 = () => {
  const { model } = useFinancialModel();
  const data = [2024, 2025, 2026, 2027, 2028].map(y => ({
    label: String(y), value: model.years[y as keyof typeof model.years]?.marketing ?? 0, fid: `s26.${y}`,
  }));
  return (
    <div className="absolute inset-0 flex flex-col" style={{ padding: '160px 200px 120px' }}>
      <div style={KICKER}>Investimento em Marketing</div>
      <h2 style={{ ...H2, color: '#fff', marginTop: 16 }}>Investimento em Marketing (R$ 000's)</h2>
      <BarChart data={data} />
    </div>
  );
};

// ── Slide 27: Projeções ────────────────────────────────────────────────────
export const Slide27 = () => {
  const { model } = useFinancialModel();
  const years = [2025, 2026, 2027, 2028] as const;
  const rows: [string, (y: typeof years[number]) => number][] = [
    ['Receita Bruta', y => model.years[y]?.grossRevenue ?? 0],
    ['Lucro Bruto', y => model.years[y]?.grossProfit ?? 0],
    ['EBITDA', y => model.years[y]?.ebitda ?? 0],
    ['Resultado Líquido', y => model.years[y]?.netIncome ?? 0],
  ];
  return (
    <div className="absolute inset-0 flex flex-col" style={{ padding: '160px 200px 120px' }}>
      <div style={KICKER}>Projeções FY25 → FY28</div>
      <h2 style={{ ...H2, color: '#fff', marginTop: 16 }}>Projeções (R$ 000's)</h2>
      <table className="mt-12 w-full" style={{ borderCollapse: 'separate', borderSpacing: '0 8px' }}>
        <thead>
          <tr style={{ ...BODY, color: GREEN, fontFamily: 'Space Grotesk', fontWeight: 700 }}>
            <th className="text-left p-3" style={{ background: NAVY_2 }}>Indicador</th>
            {years.map(y => <th key={y} className="text-right p-3" style={{ background: NAVY_2 }}>{y}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, fn], i) => (
            <tr key={i} style={{ ...BODY, color: '#cbd5e1' }}>
              <td className="p-4" style={{ background: NAVY_2, fontWeight: 600, color: '#fff' }}>{label}</td>
              {years.map(y => (
                <td key={y} className="text-right p-4" style={{ background: NAVY_2 }}>
                  <DataField fieldId={`s27.${label}.${y}`} liveValue={fn(y)} format={fmtThousands} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// ── Slide 28: YoY ──────────────────────────────────────────────────────────
export const Slide28 = () => {
  const { model } = useFinancialModel();
  const m = (y: number, k: 'grossRevenue' | 'grossProfit' | 'ebitda' | 'netIncome') =>
    model.years[y as keyof typeof model.years]?.[k] ?? 0;
  const cards = [
    ['Receita Bruta', yoyPct(m(2025, 'grossRevenue'), m(2024, 'grossRevenue'))],
    ['Lucro Bruto', yoyPct(m(2025, 'grossProfit'), m(2024, 'grossProfit'))],
    ['EBITDA', yoyPct(m(2025, 'ebitda'), m(2024, 'ebitda'))],
    ['Resultado Líquido', yoyPct(m(2025, 'netIncome'), m(2024, 'netIncome'))],
  ];
  return (
    <div className="absolute inset-0 flex flex-col" style={{ padding: '160px 200px 120px' }}>
      <div style={KICKER}>Validação da Tese</div>
      <h2 style={{ ...H2, color: '#fff', marginTop: 16 }}>Crescimento YoY 2024 → 2025</h2>
      <div className="grid grid-cols-4 gap-6 mt-16">
        {cards.map(([label, v], i) => (
          <div key={i} style={{ background: NAVY_2, padding: 32, borderRadius: 12, borderTop: `4px solid ${GREEN}` }}>
            <div style={{ ...BODY, color: '#94a3b8' }}>{label}</div>
            <div style={{ ...H1, fontSize: 80, color: GREEN, marginTop: 8 }}>
              <DataField fieldId={`s28.${label}`} liveValue={v as number} format={(x) => `${x >= 0 ? '+' : ''}${x.toFixed(0)}%`} />
            </div>
          </div>
        ))}
      </div>
      <p style={{ ...BODY, color: '#94a3b8', marginTop: 40, fontSize: 22 }}>
        Otimização de SG&A com reflexo direto no EBITDA.
      </p>
    </div>
  );
};

// ── Slide 29: Receita líquida % ────────────────────────────────────────────
export const Slide29 = () => {
  const { model } = useFinancialModel();
  const years = [2024, 2025, 2026, 2027, 2028] as const;
  return (
    <div className="absolute inset-0 flex flex-col" style={{ padding: '160px 200px 120px' }}>
      <div style={KICKER}>Resultado Consolidado</div>
      <h2 style={{ ...H2, color: '#fff', marginTop: 16 }}>Com todos os produtos disponíveis, a companhia atinge resultados promissores</h2>
      <table className="mt-12 w-full" style={{ borderCollapse: 'separate', borderSpacing: '0 6px' }}>
        <thead>
          <tr style={{ ...BODY, color: GREEN, fontWeight: 700 }}>
            <th className="text-left p-3" style={{ background: NAVY_2 }}>Indicador</th>
            {years.map(y => <th key={y} className="text-right p-3" style={{ background: NAVY_2 }}>{y}</th>)}
          </tr>
        </thead>
        <tbody>
          {[
            ['Receita Líquida', (y: number) => model.years[y as keyof typeof model.years]?.netRevenue ?? 0, fmtThousands],
            ['EBITDA', (y: number) => model.years[y as keyof typeof model.years]?.ebitda ?? 0, fmtThousands],
            ['% Margem EBITDA', (y: number) => model.years[y as keyof typeof model.years]?.ebitdaMarginPct ?? 0, fmtPct],
          ].map(([label, fn, fmt]: any, i) => (
            <tr key={i} style={{ ...BODY, color: '#cbd5e1' }}>
              <td className="p-4" style={{ background: NAVY_2, color: '#fff', fontWeight: 600 }}>{label}</td>
              {years.map(y => (
                <td key={y} className="text-right p-4" style={{ background: NAVY_2 }}>
                  <DataField fieldId={`s29.${label}.${y}`} liveValue={fn(y)} format={fmt} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// ── Slide 30: Geração de caixa ─────────────────────────────────────────────
export const Slide30 = () => (
  <div className="absolute inset-0 flex flex-col justify-center" style={{ padding: '0 200px' }}>
    <div style={KICKER}>Caixa</div>
    <h2 style={{ ...H2, color: '#fff', marginTop: 16 }}>A companhia hoje já é geradora de caixa</h2>
    <p style={{ ...BODY, color: GREEN, fontSize: 36, marginTop: 24 }}>
      E cresce sem capital de terceiros.
    </p>
    <div className="grid grid-cols-3 gap-8 mt-16">
      {[
        ['100%', 'Bootstrapped'], ['0', 'Dívida bancária'], ['+3 anos', 'Operação positiva'],
      ].map(([n, l], i) => (
        <div key={i} style={{ background: NAVY_2, padding: 36, borderRadius: 12, borderTop: `4px solid ${GREEN}`, textAlign: 'center' }}>
          <div style={{ ...H1, fontSize: 96, color: GREEN }}><DataField fieldId={`s30.k${i}.n`} liveValue={n} /></div>
          <div style={{ ...BODY, color: '#cbd5e1', marginTop: 8 }}><DataField fieldId={`s30.k${i}.l`} liveValue={l} /></div>
        </div>
      ))}
    </div>
  </div>
);

// ── Slide 31: Difícil de replicar ──────────────────────────────────────────
export const Slide31 = () => (
  <div className="absolute inset-0 flex flex-col" style={{ padding: '160px 200px 120px' }}>
    <div style={KICKER}>Moat</div>
    <h2 style={{ ...H2, color: '#fff', marginTop: 16 }}>Difícil de replicar</h2>
    <div className="grid grid-cols-2 gap-6 mt-12">
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
          <span style={{ ...BODY, color: '#cbd5e1' }}>{t as string}</span>
        </div>
      ))}
    </div>
    <div className="flex gap-8 mt-10" style={{ ...BODY, color: '#94a3b8', fontSize: 20 }}>
      <span><span style={{ color: GREEN }}>●</span> Desenvolvido</span>
      <span><span style={{ color: '#64748b' }}>●</span> A desenvolver</span>
    </div>
  </div>
);

// ── Slides 32–35: Roadmap ──────────────────────────────────────────────────
function RoadmapSlide({ year, title, items, id }: { year: string; title: string; items: string[]; id: string }) {
  return (
    <div className="absolute inset-0 flex flex-col" style={{ padding: '160px 200px 120px' }}>
      <div style={KICKER}>Roadmap Estratégico 2025–2030</div>
      <h2 style={{ ...H2, color: '#fff', marginTop: 16 }}>
        <span style={{ color: GREEN }}>{year}</span> — {title}
      </h2>
      <GreenBar />
      <ul style={{ marginTop: 24 }}>
        {items.map((it, i) => (
          <li key={i} className="flex gap-4 py-3" style={{ ...BODY, color: '#cbd5e1' }}>
            <span style={{ color: GREEN, fontWeight: 700 }}>→</span>
            <DataField fieldId={`${id}.b${i}`} liveValue={it} />
          </li>
        ))}
      </ul>
    </div>
  );
}
export const Slide32 = () => (
  <RoadmapSlide year="2025" title="Consolidação de Produto + Bases de Expansão" id="s32"
    items={['Lançamento da plataforma Oxy + Gênio', 'Desenvolvimento do Smart Banking no WhatsApp', 'Integração com Oxy para sincronização bancária em real time']} />
);
export const Slide33 = () => (
  <RoadmapSlide year="2026" title="Lançamento e Consolidação do BPO Financeiro 4.0" id="s33"
    items={['BPO 4.0 100% via WhatsApp', 'BAAS com banking inteligente integrado', 'Forte crescimento de base de clientes', 'Atingir +3K clientes ativos']} />
);
export const Slide34 = () => (
  <RoadmapSlide year="2028" title="Expansão Internacional" id="s34"
    items={['Operação consolidada nos EUA', 'Replicação da metodologia em mercados latam', 'Consolidação como o maior ecossistema de gestão financeira para PMEs da América Latina']} />
);
export const Slide35 = () => (
  <RoadmapSlide year="2030" title="Expansão e liquidez estratégica" id="s35"
    items={['Expansão contínua de produtos com foco em IA e finanças inteligentes', 'Liquidez estratégica para founders e investidores']} />
);

// ── Slides 36–38: Citações SaaS Capital ────────────────────────────────────
function QuoteSlide({ quote, source, id }: { quote: string; source: string; id: string }) {
  return (
    <div className="absolute inset-0 flex flex-col justify-center" style={{ padding: '0 200px' }}>
      <div style={KICKER}>Valuation · Benchmark</div>
      <div style={{ ...H1, fontSize: 88, color: '#fff', marginTop: 32, lineHeight: 1.1 }}>
        "<DataField fieldId={`${id}.q`} liveValue={quote} />"
      </div>
      <div style={{ ...BODY, color: GREEN, marginTop: 32, fontSize: 28, fontStyle: 'italic' }}>
        — <DataField fieldId={`${id}.src`} liveValue={source} />
      </div>
    </div>
  );
}
export const Slide36 = () => <QuoteSlide id="s36" quote="O maior driver do múltiplo é a taxa de crescimento." source="SaaS Capital" />;
export const Slide37 = () => (
  <div className="absolute inset-0 flex flex-col justify-center" style={{ padding: '0 200px' }}>
    <div style={KICKER}>SaaS Capital · 2025</div>
    <h2 style={{ ...H2, color: '#fff', marginTop: 16 }}>Benchmarks públicos</h2>
    <div className="grid grid-cols-3 gap-8 mt-12">
      {[['Mediana SCI', '7× ARR'], ['Top 10', '~14× ARR'], ['Bottom (low growth)', '0,4 – 2,7× ARR']].map(([l, v], i) => (
        <div key={i} style={{ background: NAVY_2, padding: 36, borderRadius: 12, borderTop: `4px solid ${GREEN}`, textAlign: 'center' }}>
          <div style={{ ...BODY, color: '#94a3b8' }}>{l}</div>
          <div style={{ ...H1, fontSize: 72, color: GREEN, marginTop: 8 }}><DataField fieldId={`s37.${i}`} liveValue={v} /></div>
        </div>
      ))}
    </div>
  </div>
);
export const Slide38 = () => <QuoteSlide id="s38" quote="Empresas com crescimento baixo se concentram entre 1–3× ARR." source="SaaS Capital" />;

// ── Slide 39: O2 = 10× ARR ─────────────────────────────────────────────────
export const Slide39 = () => {
  const { model } = useFinancialModel();
  const arr = model.years[2025]?.grossRevenue ?? 0;
  const valuation = arr * 10;
  return (
    <div className="absolute inset-0 flex flex-col justify-center" style={{ padding: '0 200px' }}>
      <div style={KICKER}>Valuation O2</div>
      <h2 style={{ ...H2, color: '#fff', marginTop: 16 }}>Multiplicador acompanha velocidade e qualidade de crescimento</h2>
      <p style={{ ...BODY, color: '#cbd5e1', marginTop: 32, fontSize: 30 }}>
        <DataField fieldId="s39.desc" liveValue="A O2 entrega crescimento acelerado + diferencial tecnológico + potencial de expansão." />
      </p>
      <div className="mt-16 flex items-end gap-12">
        <div>
          <div style={{ ...BODY, color: '#94a3b8' }}>Múltiplo aplicado</div>
          <div style={{ ...H1, fontSize: 200, color: GREEN, lineHeight: 1 }}>
            <DataField fieldId="s39.mult" liveValue="10×" />
          </div>
          <div style={{ ...H3, color: '#fff' }}>ARR</div>
        </div>
        <div style={{ background: NAVY_2, padding: 36, borderRadius: 12, flex: 1, borderLeft: `4px solid ${GREEN}` }}>
          <div style={{ ...BODY, color: '#94a3b8' }}>Valuation implícito (10× ARR 2025)</div>
          <div style={{ ...H1, fontSize: 80, color: GREEN, marginTop: 8 }}>
            R$ <DataField fieldId="s39.val" liveValue={valuation} format={fmtMillions} />
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Slide 40: Closing quote ────────────────────────────────────────────────
export const Slide40 = () => (
  <div className="absolute inset-0 flex flex-col justify-center" style={{ padding: '0 200px' }}>
    <div style={KICKER}>Por que agora</div>
    <div style={{ ...H1, fontSize: 88, color: '#fff', marginTop: 32, lineHeight: 1.1 }}>
      "<DataField fieldId="s40.q" liveValue="A O2 Inc. não é apenas um SaaS. É a plataforma que está transformando a forma como o empreendedor brasileiro toma decisões — com tecnologia, inteligência e velocidade." />"
    </div>
    <p style={{ ...BODY, color: GREEN, marginTop: 40, fontSize: 32, fontStyle: 'italic' }}>
      <DataField fieldId="s40.sub" liveValue="Às vezes, o que o empreendedor precisa é de um fôlego." />
    </p>
  </div>
);

// ── Slide 41: Obrigado ─────────────────────────────────────────────────────
export const Slide41 = () => (
  <div className="absolute inset-0 flex flex-col justify-center items-center text-center">
    <div style={{ ...H1, fontSize: 96, color: '#fff' }}>O2 INC.</div>
    <div style={{ ...H1, fontSize: 200, color: GREEN, marginTop: 40, lineHeight: 0.9 }}>
      <DataField fieldId="s41.thanks" liveValue="Obrigado!" />
    </div>
    <p style={{ ...BODY, color: '#94a3b8', marginTop: 40 }}>
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
  { id: 12, title: 'TAM: 6M empresas', Component: Slide12 },
  { id: 13, title: 'Produtos overview', Component: Slide13 },
  { id: 14, title: 'SaaS + AI · onboarding', Component: Slide14 },
  { id: 15, title: 'SaaS + AI · funcionalidades', Component: Slide15 },
  { id: 16, title: 'CaaS · CFO as a Service', Component: Slide16 },
  { id: 17, title: 'Marketplace de CFOs', Component: Slide17 },
  { id: 18, title: 'BaaS · Smart Banking', Component: Slide18 },
  { id: 19, title: 'Modelo de Negócio', Component: Slide19 },
  { id: 20, title: 'Time C-Level', Component: Slide20 },
  { id: 21, title: 'Operação USA', Component: Slide21 },
  { id: 22, title: 'NPS & Clientes', Component: Slide22 },
  { id: 23, title: 'KPIs Marketing & Comercial', Component: Slide23 },
  { id: 24, title: 'Evolução do Faturamento', Component: Slide24 },
  { id: 25, title: 'KPIs Financeiros 2025', Component: Slide25 },
  { id: 26, title: 'Investimento em Marketing', Component: Slide26 },
  { id: 27, title: 'Projeções FY25–FY28', Component: Slide27 },
  { id: 28, title: 'Crescimento YoY', Component: Slide28 },
  { id: 29, title: 'Resultado Consolidado', Component: Slide29 },
  { id: 30, title: 'Geração de caixa', Component: Slide30 },
  { id: 31, title: 'Moat — difícil de replicar', Component: Slide31 },
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
