import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const OXY_BASE = 'https://api.oxy.finance';
const CNPJ = '23.813.779/0001-60';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get('OXY_API_KEY');
    if (!apiKey) throw new Error('OXY_API_KEY not configured');

    const url = new URL(req.url);
    const startDate = url.searchParams.get('startDate') || '2025-01-01';
    const endDate = url.searchParams.get('endDate') || '2025-12-31';

    const commonParams = `startDate=${startDate}&endDate=${endDate}&cnpjs[]=${encodeURIComponent(CNPJ)}`;
    const headers = { 'Authorization': `Bearer ${apiKey}`, 'Accept': 'application/json' };

    // Call both endpoints in parallel
    const [cardRecebido, cardPago, chart] = await Promise.all([
      fetch(`${OXY_BASE}/widgets/cash-flow/v2/card/details?movimentType=R&${commonParams}`, { headers }),
      fetch(`${OXY_BASE}/widgets/cash-flow/v2/card/details?movimentType=P&${commonParams}`, { headers }),
      fetch(`${OXY_BASE}/widgets/cash-flow/charts/fluxo-caixa?${commonParams}`, { headers }),
    ]);

    const result = {
      cardRecebido: { status: cardRecebido.status, data: await cardRecebido.json() },
      cardPago: { status: cardPago.status, data: await cardPago.json() },
      chart: { status: chart.status, data: await chart.json() },
    };

    return new Response(JSON.stringify(result, null, 2), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
