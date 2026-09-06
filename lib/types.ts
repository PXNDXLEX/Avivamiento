export type Role = 'principal' | 'admin' | 'user';

export const MUNICIPIOS_NUEVA_ESPARTA = [
  'Antolín del Campo',
  'Arismendi',
  'Díaz',
  'García',
  'Gómez',
  'Maneiro',
  'Marcano',
  'Mariño',
  'Península de Macanao',
  'Tubores',
  'Villalba',
] as const;

export interface Profile {
  id: string;
  username: string;
  full_name: string;
  phone: string | null;
  avatar_url: string | null;
  role: Role;
  created_at: string;
  deleted_at: string | null;
}

export interface Member {
  id: string;
  full_name: string;
  gender: 'Masculino' | 'Femenino' | null;
  age: number | null;
  municipio: string | null;
  address: string | null;
  phone: string | null;
  status: 'Nuevo' | 'Reconciliado' | 'Visitante';
  house_group_id: string | null;
  consolidator_id: string | null;
  consolidator_name: string;
  created_at: string;
  deleted_at: string | null;
}

export interface MemberWithProfile extends Member {
  profiles?: Profile | null;
}

export interface HouseGroup {
  id: string;
  name: string;
  address: string | null;
  municipio: string | null;
  leader_id: string | null;
  created_at: string;
}

export interface HouseGroupMeeting {
  id: string;
  house_group_id: string;
  topic: string | null;
  date: string;
  start_time: string | null;
  end_time: string | null;
  created_at: string;
}

export interface Attendance {
  id: string;
  meeting_id: string;
  member_id: string;
  created_at: string;
}
