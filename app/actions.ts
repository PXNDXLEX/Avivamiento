'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import type { Role } from '@/lib/types';
import { validarTelefonoVenezolano } from '@/lib/utils';

/** Email interno oculto — los usuarios solo ven su username */
function usernameToEmail(username: string) {
  return `${username.toLowerCase().trim()}@avivamiento.internal`;
}

/* ─── AUTH ──────────────────────────────────────────────── */

export async function login(username: string, password: string) {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: usernameToEmail(username),
    password,
  });

  if (error) {
    return { error: 'Usuario o contraseña incorrectos.' };
  }

  redirect('/dashboard');
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}

/* ─── Guard: admin o principal ─────────────────────────────── */

async function assertAdminOrPrincipal(): Promise<{ error: string } | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'No autenticado' };

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'principal' && profile?.role !== 'admin') {
    return { error: 'Sin permisos suficientes' };
  }

  return null;
}

/* ─── USUARIOS (solo principal) ─────────────────────────── */

export async function adminCreateUser(data: {
  username: string;
  password: string;
  full_name: string;
  phone: string;
  role: Role;
}): Promise<{ error: string } | void> {
  const guardError = await assertAdminOrPrincipal();
  if (guardError) return guardError;

  let cleanPhone: string | null = null;
  if (data.phone && data.phone.trim()) {
    const phoneVal = validarTelefonoVenezolano(data.phone);
    if (!phoneVal.isValid) {
      return { error: phoneVal.error || 'Número de teléfono inválido.' };
    }
    cleanPhone = phoneVal.cleanPhone;
  }

  const admin = createAdminClient();
  const email = usernameToEmail(data.username);

  const { data: newUser, error } = await admin.auth.admin.createUser({
    email,
    password: data.password,
    email_confirm: true,
  });

  if (error) return { error: error.message };

  const { error: profileError } = await admin.from('profiles').upsert({
    id: newUser.user.id,
    username: data.username.toLowerCase().trim(),
    full_name: data.full_name,
    phone: cleanPhone,
    role: data.role,
  }, { onConflict: 'id' });

  if (profileError) return { error: profileError.message };

  revalidatePath('/dashboard');
}

export async function adminUpdateUserRole(
  userId: string,
  role: Role
): Promise<{ error: string } | void> {
  const guardError = await assertAdminOrPrincipal();
  if (guardError) return guardError;

  const supabase = await createClient();
  const { error } = await supabase
    .from('profiles')
    .update({ role })
    .eq('id', userId);

  if (error) return { error: error.message };
  revalidatePath('/dashboard');
}

export async function adminUpdateUser(
  userId: string,
  data: {
    username?: string;
    password?: string;
    full_name?: string;
    phone?: string;
    role?: Role;
  }
): Promise<{ error: string } | void> {
  const guardError = await assertAdminOrPrincipal();
  if (guardError) return guardError;

  const admin = createAdminClient();

  // Update Auth if needed
  const authPayload: { email?: string; password?: string } = {};
  if (data.username) authPayload.email = usernameToEmail(data.username);
  if (data.password) authPayload.password = data.password;

  if (Object.keys(authPayload).length > 0) {
    const { error: authError } = await admin.auth.admin.updateUserById(
      userId,
      authPayload
    );
    if (authError) return { error: authError.message };
  }

  // Update profile
  const profilePayload: any = {};
  if (data.username) profilePayload.username = data.username.toLowerCase().trim();
  if (data.full_name !== undefined) profilePayload.full_name = data.full_name;
  if (data.phone !== undefined) {
    if (data.phone && data.phone.trim()) {
      const phoneVal = validarTelefonoVenezolano(data.phone);
      if (!phoneVal.isValid) {
        return { error: phoneVal.error || 'Número de teléfono inválido.' };
      }
      profilePayload.phone = phoneVal.cleanPhone;
    } else {
      profilePayload.phone = null;
    }
  }
  if (data.role) profilePayload.role = data.role;

  if (Object.keys(profilePayload).length > 0) {
    const { error: profileError } = await admin
      .from('profiles')
      .update(profilePayload)
      .eq('id', userId);
    if (profileError) return { error: profileError.message };
  }

  revalidatePath('/dashboard');
}

export async function adminDeleteUser(userId: string): Promise<{ error: string } | void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'No autenticado' };

  const { data: currentProfile } = await supabase
    .from('profiles')
    .select('id, role, full_name')
    .eq('id', user.id)
    .single();

  if (currentProfile?.role !== 'principal') {
    return { error: 'Solo el usuario Principal tiene permisos para eliminar usuarios. Los administradores no pueden borrar usuarios.' };
  }

  if (user.id === userId) {
    return { error: 'No puedes eliminar tu propia cuenta.' };
  }

  const admin = createAdminClient();

  // 1. Reasignar líderes de casas a null si estaban asignados al usuario que se va a borrar
  await admin
    .from('house_groups')
    .update({ leader_id: null })
    .eq('leader_id', userId);

  // 2. Reasignar miembros que tenían a este usuario como consolidador al usuario principal
  await admin
    .from('members')
    .update({
      consolidator_id: user.id,
      consolidator_name: currentProfile.full_name || 'Principal',
    })
    .eq('consolidator_id', userId);

  // 3. Eliminar de public.profiles
  const { error: profileError } = await admin
    .from('profiles')
    .delete()
    .eq('id', userId);

  if (profileError) return { error: profileError.message };

  // 4. Eliminar de auth.users
  const { error: authError } = await admin.auth.admin.deleteUser(userId);
  if (authError) return { error: authError.message };

  revalidatePath('/dashboard');
}

export async function updateUserActivity(): Promise<void> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    await supabase
      .from('profiles')
      .update({ last_seen_at: new Date().toISOString() })
      .eq('id', user.id);
  } catch {
    // Si la columna aún no existe o hay algún error de red, silenciar
  }
}

/* ─── KEEPALIVE / PREVENCIÓN DE PAUSA EN SUPABASE ─────────── */

export async function getKeepAliveStatusAction(): Promise<{
  last_ping: string | null;
  ping_count: number;
  source: string;
  status: string;
}> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from('system_keepalive')
      .select('last_ping, ping_count, source, status')
      .eq('id', 'primary_heartbeat')
      .maybeSingle();

    if (data) {
      return {
        last_ping: data.last_ping,
        ping_count: Number(data.ping_count) || 0,
        source: data.source || 'sistema',
        status: data.status || 'active',
      };
    }
  } catch {
    // Si la tabla aún no existe
  }

  return {
    last_ping: null,
    ping_count: 0,
    source: 'No configurado',
    status: 'pending_migration',
  };
}

export async function recordKeepAliveAction(source: string = 'manual_dashboard'): Promise<{
  success: boolean;
  message: string;
  last_ping: string;
  ping_count: number;
}> {
  const nowIso = new Date().toISOString();
  try {
    const supabase = await createClient();

    // Intentar invocar función RPC si existe
    const { data: rpcData, error: rpcError } = await supabase.rpc('record_heartbeat', {
      ping_source: source,
    });

    if (!rpcError && rpcData) {
      return {
        success: true,
        message: 'Pulso de actividad registrado exitosamente',
        last_ping: rpcData.last_ping || nowIso,
        ping_count: Number(rpcData.ping_count) || 1,
      };
    }

    // Si no, intentar upsert directo
    const { data: existing } = await supabase
      .from('system_keepalive')
      .select('*')
      .eq('id', 'primary_heartbeat')
      .maybeSingle();

    if (existing) {
      const nextCount = (Number(existing.ping_count) || 0) + 1;
      await supabase
        .from('system_keepalive')
        .update({
          last_ping: nowIso,
          ping_count: nextCount,
          source,
          status: 'active',
          updated_at: nowIso,
        })
        .eq('id', 'primary_heartbeat');

      return {
        success: true,
        message: 'Pulso registrado exitosamente',
        last_ping: nowIso,
        ping_count: nextCount,
      };
    } else {
      await supabase
        .from('system_keepalive')
        .insert({
          id: 'primary_heartbeat',
          last_ping: nowIso,
          ping_count: 1,
          source,
          status: 'active',
          updated_at: nowIso,
        });

      return {
        success: true,
        message: 'Primer registro de pulso creado exitosamente',
        last_ping: nowIso,
        ping_count: 1,
      };
    }
  } catch {
    // Si la tabla aún no existe, ejecutamos un query de fallback para registrar actividad en Supabase
    try {
      const admin = createAdminClient();
      await admin.from('house_groups').select('id').limit(1);
    } catch {}

    return {
      success: true,
      message: 'Consulta enviada a Supabase (tabla system_keepalive pendiente de migración)',
      last_ping: nowIso,
      ping_count: 1,
    };
  }
}


