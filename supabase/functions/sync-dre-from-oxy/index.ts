/**
 * sync-dre-from-oxy — Supabase Edge Function
 *
 * Fetches the full DRE table from Oxy Finance API (`/v2/dre/dre-table`)
 * and upserts all values into the external DRE PostgreSQL database.
 *
 * POST body (optional):
 *   { "startDate": "2025-01-01", "endDate": "2025-12-31" }
 *   Defaults: 2025-01-01 → today.
 *
 * Env vars (same as fetch-dre-data):
 *   DRE_DB_HOST, DRE_DB_PORT, DRE_DB_NAME, DRE_DB_USER, DRE_DB_PASSWORD
 *   OXY_API_KEY (optional, has fallback)
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Pool } from "https://deno.land/x/postgres@v0.17.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const OXY_API_KEY = Deno.env.get("OXY_API_KEY") || "65ef8d4f-4e78-4e94-8ce1-5eb7e0028ad8";
const CNPJ = "23813779000160";
const CNPJ_FORMATTED = "23.813.779/0001-60";

// ── Types ────────────────────────────────────────────────────────────────────

interface OxyDataPoint {
  period: string;
  value: number;
  av: number;
  avc: number;
}

interface OxyGroup {
  label: string;
  type: "metric" | "group";
  data: OxyDataPoint[];
  code: string;
  ids: string[];
}

interface OxyDreTable {
  period: string;
  periods: string[];
  groups: OxyGroup[];
}

// ── Main ─────────────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const log: string[] = [];
  const addLog = (msg: string) => { log.push(msg); console.log(msg); };

  try {
    // Parse optional body
    let startDate = "2025-01-01";
    let endDate = new Date().toISOString().split("T")[0];
    try {
      const body = await req.json();
      if (body.startDate) startDate = body.startDate;
      if (body.endDate) endDate = body.endDate;
    } catch { /* no body */ }

    addLog(`Syncing DRE: ${startDate} → ${endDate}`);

    // 1. Fetch full DRE table from Oxy API
    const oxyUrl = `https://api.oxy.finance/v2/dre/dre-table?startDate=${startDate}&endDate=${endDate}&cnpjs[]=${encodeURIComponent(CNPJ_FORMATTED)}`;
    addLog(`Calling Oxy API: dre-table`);

    const oxyRes = await fetch(oxyUrl, {
      headers: { "x-api-key": OXY_API_KEY },
      signal: AbortSignal.timeout(60_000),
    });
    if (!oxyRes.ok) throw new Error(`Oxy API error: ${oxyRes.status} ${await oxyRes.text()}`);
    const oxy: OxyDreTable = await oxyRes.json();

    const realPeriods = oxy.periods.filter((p) => p !== "TOTAL");
    addLog(`Got ${oxy.groups.length} groups, ${realPeriods.length} periods`);

    // 2. Connect to DRE DB
    const pool = new Pool({
      hostname: Deno.env.get("DRE_DB_HOST"),
      port: parseInt(Deno.env.get("DRE_DB_PORT") || "5432"),
      database: Deno.env.get("DRE_DB_NAME"),
      user: Deno.env.get("DRE_DB_USER"),
      password: Deno.env.get("DRE_DB_PASSWORD"),
    }, 1);
    const conn = await pool.connect();

    // 3. Load existing group map: label → id
    const groupsRes = await conn.queryObject<{ id: string; label: string }>(
      `SELECT id, label FROM dre_groups`
    );
    const groupMap: Record<string, string> = {};
    for (const g of groupsRes.rows) groupMap[g.label] = g.id;
    addLog(`Mapped ${Object.keys(groupMap).length} DB groups`);

    // 4. Upsert dre_data for each group
    let dataUpserted = 0;
    let dataSkipped = 0;

    for (const oxyGroup of oxy.groups) {
      const dbGroupId = groupMap[oxyGroup.label];
      if (!dbGroupId) {
        addLog(`  ⚠ No DB group for "${oxyGroup.label}" — skipping`);
        dataSkipped++;
        continue;
      }

      for (const dp of oxyGroup.data) {
        if (dp.period === "TOTAL") continue;

        await conn.queryObject(
          `INSERT INTO dre_data (cnpj, group_id, period, value, av, avc, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, NOW())
           ON CONFLICT (cnpj, group_id, period)
           DO UPDATE SET value = $4, av = $5, avc = $6, updated_at = NOW()`,
          [CNPJ, dbGroupId, dp.period, dp.value, dp.av, dp.avc]
        );
        dataUpserted++;
      }
      addLog(`  ✓ ${oxyGroup.label}: ${oxyGroup.data.filter(d => d.period !== "TOTAL").length} periods`);
    }

    // 5. Fetch drill-down items for non-metric groups (line-item detail)
    let itemsUpserted = 0;
    const errors: string[] = [];

    for (const oxyGroup of oxy.groups) {
      if (oxyGroup.type === "metric") continue;
      const dbGroupId = groupMap[oxyGroup.label];
      if (!dbGroupId) continue;

      try {
        const ddUrl = `https://api.oxy.finance/v2/dre/dre-drill-down?category=${encodeURIComponent(oxyGroup.label)}&startDate=${startDate}&endDate=${endDate}&cnpjs[]=${encodeURIComponent(CNPJ_FORMATTED)}`;
        const ddRes = await fetch(ddUrl, {
          headers: { "x-api-key": OXY_API_KEY },
          signal: AbortSignal.timeout(30_000),
        });

        if (ddRes.ok) {
          const dd = await ddRes.json();
          const clients = dd.data || [];

          for (const client of clients) {
            for (const dp of client.data || []) {
              if (!dp.period || dp.period === "TOTAL") continue;
              await conn.queryObject(
                `INSERT INTO dre_category_items (group_id, item_name, period, value, updated_at)
                 VALUES ($1, $2, $3, $4, NOW())
                 ON CONFLICT (group_id, item_name, period)
                 DO UPDATE SET value = $4, updated_at = NOW()`,
                [dbGroupId, client.label, dp.period, dp.value || 0]
              );
              itemsUpserted++;
            }
          }
        }
        // Rate limit
        await new Promise((r) => setTimeout(r, 200));
      } catch (err) {
        const msg = `Drill-down ${oxyGroup.label}: ${err instanceof Error ? err.message : err}`;
        errors.push(msg);
        addLog(`  ⚠ ${msg}`);
      }
    }

    // 6. Log integration
    await conn.queryObject(
      `INSERT INTO integration_logs (execution_mode, period_start, period_end, status, records_processed, errors_count, error_message)
       VALUES ('edge_function', $1, $2, $3, $4, $5, $6)`,
      [
        startDate, endDate,
        errors.length > 0 ? "partial_success" : "success",
        dataUpserted + itemsUpserted,
        errors.length,
        errors.length > 0 ? errors.join("\n").slice(0, 4000) : null,
      ]
    );

    conn.release();
    await pool.end();

    const summary = `Done! dre_data: ${dataUpserted} upserted, dre_category_items: ${itemsUpserted}, skipped: ${dataSkipped}, errors: ${errors.length}`;
    addLog(summary);

    return new Response(
      JSON.stringify({ success: true, dataUpserted, itemsUpserted, dataSkipped, errors: errors.length, log }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    addLog(`FATAL: ${message}`);
    return new Response(JSON.stringify({ error: message, log }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
