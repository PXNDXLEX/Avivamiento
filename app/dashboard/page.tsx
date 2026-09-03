import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import DashboardClient from './DashboardClient';
import type { Profile } from '@/lib/types';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Panel de Control — Avivamiento León de la Tribu de Judá',
  description: 'Gestión de miembros y estadísticas de la congregación.',
};

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (!user) {
    const authErrMsg = authError ? authError.message : 'NoUserFound';
    redirect(`/login?error=auth&msg=${encodeURIComponent(authErrMsg)}`);
  }

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (!profile) {
    await supabase.auth.signOut();
    const errMsg = error ? error.message : 'Not_Found';
    redirect(`/login?error=noprofile&uid=${user.id}&err=${encodeURIComponent(errMsg)}`);
  }

  return <DashboardClient profile={profile as Profile} />;
}
