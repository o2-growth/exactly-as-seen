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

    // Get all tables
    const tablesResult = await conn.queryObject(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    const tables = tablesResult.rows.map((r: any) => r.table_name);

    const result: Record<string, any> = {};

    for (const table of tables) {
      // Get columns
      const colsResult = await conn.queryObject(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = '${table}'
        ORDER BY ordinal_position
      `);

      // Get sample data
      const sampleResult = await conn.queryObject(`SELECT * FROM public."${table}" LIMIT 5`);

      // Get row count
      const countResult = await conn.queryObject(`SELECT COUNT(*) as total FROM public."${table}"`);

      result[table] = {
        columns: colsResult.rows,
        sample: sampleResult.rows,
        rowCount: (countResult.rows[0] as any).total,
      };
    }

    conn.release();
    await pool.end();

    const jsonStr = JSON.stringify({ tables, details: result }, (_, v) =>
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
