import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Pool } from "https://deno.land/x/postgres@v0.17.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const pool = new Pool({
      hostname: Deno.env.get('DRE_DB_HOST'),
      port: parseInt(Deno.env.get('DRE_DB_PORT') || '5432'),
      database: Deno.env.get('DRE_DB_NAME'),
      user: Deno.env.get('DRE_DB_USER'),
      password: Deno.env.get('DRE_DB_PASSWORD'),
    }, 1);

    const conn = await pool.connect();

    // 1. Get all groups with their category
    const groupsRes = await conn.queryObject(`
      SELECT g.id, g.external_id, g.label, g.is_metric, g.category_code, g.parent_group_id
      FROM dre_groups g
      ORDER BY g.category_code, g.label
    `);

    // 2. Get all dre_data (group-level values per period)
    const dreDataRes = await conn.queryObject(`
      SELECT group_id, period, value::float, av::float, avc::float
      FROM dre_data
      ORDER BY period
    `);

    // 3. Get all category items (detail-level values per period)
    const itemsRes = await conn.queryObject(`
      SELECT group_id, item_name, period, value::float, av::float, avc::float
      FROM dre_category_items
      ORDER BY item_name, period
    `);

    // 4. Get categories for ordering
    const catsRes = await conn.queryObject(`
      SELECT code, name, display_order FROM categories ORDER BY display_order
    `);

    conn.release();
    await pool.end();

    // Build lookup structures
    const groups = groupsRes.rows as any[];
    const dreData = dreDataRes.rows as any[];
    const items = itemsRes.rows as any[];
    const categories = catsRes.rows as any[];

    // Group dre_data by group_id → { period: value }
    const dataByGroup: Record<string, Record<string, number>> = {};
    for (const d of dreData) {
      if (!d.period || d.period === 'TOTAL') continue;
      if (!dataByGroup[d.group_id]) dataByGroup[d.group_id] = {};
      dataByGroup[d.group_id][d.period] = parseFloat(d.value) || 0;
    }

    // Group items by group_id → item_name → { period: value }
    const itemsByGroup: Record<string, Record<string, Record<string, number>>> = {};
    for (const item of items) {
      if (!item.period || item.period === 'TOTAL') continue;
      if (!itemsByGroup[item.group_id]) itemsByGroup[item.group_id] = {};
      if (!itemsByGroup[item.group_id][item.item_name]) itemsByGroup[item.group_id][item.item_name] = {};
      itemsByGroup[item.group_id][item.item_name][item.period] = parseFloat(item.value) || 0;
    }

    // Discover all periods available (exclude TOTAL)
    const allPeriods = new Set<string>();
    for (const d of dreData) { if (d.period && d.period !== 'TOTAL') allPeriods.add(d.period); }
    for (const item of items) { if (item.period && item.period !== 'TOTAL') allPeriods.add(item.period); }
    const periods = [...allPeriods].sort();

    // Derive years from periods
    const yearsSet = new Set<number>();
    for (const p of periods) {
      const y = parseInt(p.split('-')[0]);
      if (!isNaN(y)) yearsSet.add(y);
    }
    const years = [...yearsSet].sort();

    // Helper: build annual & monthly from period→value map
    function buildTimeSeries(periodValues: Record<string, number>) {
      const annual: Record<number, number> = {};
      const monthly: Record<number, number[]> = {};

      for (const y of years) {
        monthly[y] = Array(12).fill(0);
        for (let m = 0; m < 12; m++) {
          const period = `${y}-${String(m + 1).padStart(2, '0')}`;
          const val = periodValues[period] || 0;
          monthly[y][m] = val;
        }
        annual[y] = monthly[y].reduce((a, b) => a + b, 0);
      }

      return { annual, monthly };
    }

    // Build P&L tree
    // Separate metric groups (summary rows) from data groups
    const metricGroups = groups.filter((g: any) => g.is_metric);
    const dataGroups = groups.filter((g: any) => !g.is_metric);

    // Category order map
    const catOrder: Record<string, number> = {};
    for (const c of categories) catOrder[c.code] = c.display_order;

    // Build category → groups mapping
    const groupsByCategory: Record<string, any[]> = {};
    for (const g of dataGroups) {
      const cat = g.category_code || 'OTHER';
      if (!groupsByCategory[cat]) groupsByCategory[cat] = [];
      groupsByCategory[cat].push(g);
    }

    // Build the tree
    const pnlTree: any[] = [];
    let codeCounter = 1;

    // Category code → DRE section mapping
    const categoryConfig: Record<string, { label: string; sign: number; isHeader?: boolean }> = {
      'RB': { label: 'Receita Bruta de Vendas', sign: 1 },
      'DC': { label: 'Dedução de Vendas', sign: -1 },
      'CV': { label: 'Custo dos Serviços Prestados (COGS)', sign: -1 },
      'DX': { label: 'Despesas Fixas', sign: -1, isHeader: true },
      'RF': { label: 'Receitas Financeiras', sign: 1 },
      'DF': { label: 'Despesas Financeiras', sign: -1 },
      'OR': { label: 'Outras Receitas', sign: 1 },
      'DN': { label: 'Despesas Não Operacionais', sign: -1 },
      'IR': { label: 'Provisão IRPJ/CSLL', sign: -1 },
      'AM': { label: 'Amortização e Depreciação', sign: -1 },
      'IN': { label: 'Investimentos', sign: -1 },
    };

    // Metric label → summary config
    const metricConfig: Record<string, { code: string; isSummary?: boolean; isMargin?: boolean; afterCategory?: string }> = {
      'RECEITA BRUTA': { code: 'RB_T', isSummary: true, afterCategory: 'RB' },
      'RECEITA LÍQUIDA': { code: 'NR', isSummary: true, afterCategory: 'DC' },
      'CUSTOS VARIÁVEIS': { code: 'CV_T', isSummary: true, afterCategory: 'CV' },
      'LUCRO BRUTO': { code: 'GP', isSummary: true, afterCategory: 'CV' },
      'DESPESAS FIXAS': { code: 'DX_T', isSummary: true, afterCategory: 'DX' },
      'EBITDA': { code: 'EBITDA', isSummary: true, afterCategory: 'DX' },
      'RESULTADO LÍQUIDO': { code: 'NI', isSummary: true, afterCategory: 'IR' },
      'RESULTADO FINAL': { code: 'FCR', isSummary: true, afterCategory: 'IN' },
    };

    // Build metric time series
    const metricTimeSeries: Record<string, { annual: Record<number, number>; monthly: Record<number, number[]> }> = {};
    for (const mg of metricGroups) {
      const data = dataByGroup[mg.id] || {};
      metricTimeSeries[mg.label] = buildTimeSeries(data);
    }

    // Sort categories by display_order
    const sortedCats = Object.keys(groupsByCategory).sort((a, b) => (catOrder[a] || 99) - (catOrder[b] || 99));

    // Process each category
    for (const catCode of sortedCats) {
      const config = categoryConfig[catCode] || { label: catCode, sign: 1 };
      const catGroups = groupsByCategory[catCode];
      const code = String(codeCounter++);

      // Build children from groups
      const children: any[] = [];
      let catAnnual: Record<number, number> = {};
      let catMonthly: Record<number, number[]> = {};
      for (const y of years) {
        catAnnual[y] = 0;
        catMonthly[y] = Array(12).fill(0);
      }

      for (let i = 0; i < catGroups.length; i++) {
        const g = catGroups[i];
        const gData = dataByGroup[g.id] || {};
        const ts = buildTimeSeries(gData);

        // Check if this group has category items (sub-items)
        const groupItems = itemsByGroup[g.id];
        let groupChildren: any[] | undefined;
        if (groupItems && Object.keys(groupItems).length > 0) {
          groupChildren = [];
          for (const [itemName, itemPeriods] of Object.entries(groupItems)) {
            const itemTs = buildTimeSeries(itemPeriods);
            groupChildren.push({
              code: `${code}.${i + 1}.${groupChildren.length + 1}`,
              label: itemName,
              annual: itemTs.annual,
              monthly: itemTs.monthly,
            });
          }
        }

        // Accumulate category totals
        for (const y of years) {
          catAnnual[y] += ts.annual[y];
          for (let m = 0; m < 12; m++) {
            catMonthly[y][m] += ts.monthly[y][m];
          }
        }

        children.push({
          code: `${code}.${i + 1}`,
          label: g.label,
          annual: ts.annual,
          monthly: ts.monthly,
          ...(groupChildren && groupChildren.length > 0 ? { children: groupChildren } : {}),
        });
      }

      const categoryNode: any = {
        code,
        label: config.label,
        annual: catAnnual,
        monthly: catMonthly,
      };

      if (children.length > 0) {
        categoryNode.children = children;
      }
      if (config.isHeader) {
        categoryNode.isHeader = true;
      }

      pnlTree.push(categoryNode);

      // Insert metrics that come after this category
      for (const [metricLabel, mc] of Object.entries(metricConfig)) {
        if (mc.afterCategory === catCode) {
          const mts = metricTimeSeries[metricLabel];
          if (mts) {
            pnlTree.push({
              code: mc.code,
              label: `(=) ${metricLabel}`,
              annual: mts.annual,
              monthly: mts.monthly,
              isSummary: mc.isSummary,
              isMargin: mc.isMargin,
            });
          }
        }
      }
    }

    const result = {
      pnlTree,
      years,
      periods,
      meta: {
        groupCount: groups.length,
        dataRowCount: dreData.length,
        itemCount: items.length,
      },
    };

    const jsonStr = JSON.stringify(result, (_, v) =>
      typeof v === 'bigint' ? Number(v) : v, 2);

    return new Response(jsonStr, {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
