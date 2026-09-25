'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import type { Role } from '@/lib/types';

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
    phone: data.phone || null,
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
  if (data.phone !== undefined) profilePayload.phone = data.phone || null;
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
