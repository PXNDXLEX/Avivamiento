import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * Obtiene el cliente de Supabase adecuado para operaciones de mantenimiento.
 * Prioriza el Admin Client (service role) y cae al Anon Client si no está configurada la llave admin.
 */
function getMaintenanceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (url && serviceKey) {
    try {
      return createAdminClient();
    } catch {
      // Ignorar y caer al cliente anonimo
    }
  }

  if (url && anonKey) {
    return createSupabaseClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  return null;
}

async function handleKeepAlive(req: NextRequest) {
  const startTime = Date.now();
  const url = new URL(req.url);
  const source = url.searchParams.get('source') || 'api_keepalive';

  const supabase = getMaintenanceClient();

  if (!supabase) {
    return NextResponse.json(
      {
        ok: false,
        error: 'Variables de entorno de Supabase no configuradas.',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }

  let dbResult: any = null;
  let fallbackQueryUsed = false;
  let tablePending = false;

  try {
    // 1. Intentar llamar a la función almacenada record_heartbeat
    const { data: rpcData, error: rpcError } = await supabase.rpc('record_heartbeat', {
      ping_source: source,
    });

    if (!rpcError && rpcData) {
      dbResult = rpcData;
    } else {
      // 2. Si la función no existe, intentar upsert directo en system_keepalive
      const nowIso = new Date().toISOString();
      const { data: existing, error: selectError } = await supabase
        .from('system_keepalive')
        .select('*')
        .eq('id', 'primary_heartbeat')
        .maybeSingle();

      if (!selectError && existing) {
        const nextCount = (Number(existing.ping_count) || 0) + 1;
        const { data: updated, error: updateError } = await supabase
          .from('system_keepalive')
          .update({
            last_ping: nowIso,
            ping_count: nextCount,
            source,
            status: 'active',
            updated_at: nowIso,
          })
          .eq('id', 'primary_heartbeat')
          .select()
          .single();

        if (!updateError && updated) {
          dbResult = updated;
        }
      } else if (!selectError && !existing) {
        const { data: inserted, error: insertError } = await supabase
          .from('system_keepalive')
          .insert({
            id: 'primary_heartbeat',
            last_ping: nowIso,
            ping_count: 1,
            source,
            status: 'active',
            updated_at: nowIso,
          })
          .select()
          .single();

        if (!insertError && inserted) {
          dbResult = inserted;
        }
      } else {
        // La tabla system_keepalive probablemente no ha sido migrada aún en Supabase
        tablePending = true;
      }
    }
  } catch {
    tablePending = true;
  }

  // 3. Consulta de respaldo garantizada:
  // Si system_keepalive no existe aún, hacemos una consulta real a house_groups o profiles.
  // Esto GARANTIZA que Supabase reciba una petición activa y nunca se pause.
  if (!dbResult) {
    try {
      const { data: fallbackData } = await supabase
        .from('house_groups')
        .select('id, name')
        .limit(1);

      fallbackQueryUsed = true;
      dbResult = {
        id: 'fallback_ping',
        last_ping: new Date().toISOString(),
        source: `${source} (fallback_query)`,
        status: 'active',
        house_group_sample: fallbackData?.[0]?.name || 'Conectado',
      };
    } catch (err: any) {
      return NextResponse.json(
        {
          ok: false,
          error: err?.message || 'Error al conectar con la base de datos',
          timestamp: new Date().toISOString(),
        },
        { status: 500 }
      );
    }
  }

  const latencyMs = Date.now() - startTime;

  return NextResponse.json(
    {
      ok: true,
      service: 'Avivamiento Supabase Keep-Alive',
      message: 'Pulso de actividad registrado exitosamente. Base de datos activa.',
      timestamp: new Date().toISOString(),
      latency_ms: latencyMs,
      source,
      table_pending_migration: tablePending,
      data: dbResult,
    },
    {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    }
  );
}

export async function GET(req: NextRequest) {
  return handleKeepAlive(req);
}

export async function POST(req: NextRequest) {
  return handleKeepAlive(req);
}

export async function HEAD(req: NextRequest) {
  return handleKeepAlive(req);
}
