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

/* ─── Guard: solo principal ─────────────────────────────── */

async function assertPrincipal() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('No autenticado');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'principal') throw new Error('Sin permisos suficientes');
}

/* ─── USUARIOS (solo principal) ─────────────────────────── */

export async function adminCreateUser(data: {
  username: string;
  password: string;
  full_name: string;
  phone: string;
  role: Role;
}) {
  await assertPrincipal();

  const admin = createAdminClient();

  const email = usernameToEmail(data.username);

  const { data: newUser, error } = await admin.auth.admin.createUser({
    email,
    password: data.password,
    email_confirm: true,
  });

  if (error) throw new Error(error.message);

  const { error: profileError } = await admin.from('profiles').insert({
    id: newUser.user.id,
    username: data.username.toLowerCase().trim(),
    full_name: data.full_name,
    phone: data.phone || null,
    role: data.role,
  });

  if (profileError) throw new Error(profileError.message);
  revalidatePath('/dashboard');
}

export async function adminUpdateUserRole(userId: string, role: Role) {
  await assertPrincipal();

  const supabase = await createClient();
  const { error } = await supabase
    .from('profiles')
    .update({ role })
    .eq('id', userId);

  if (error) throw new Error(error.message);
  revalidatePath('/dashboard');
}
