import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import RegistroClient from './RegistroClient';
import type { Profile } from '@/lib/types';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Registro de Miembros — Avivamiento León de la Tribu de Judá',
  description: 'Registra nuevos miembros y visitantes de la congregación.',
};

export default async function RegistroPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

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

  return <RegistroClient profile={profile as Profile} />;
}
