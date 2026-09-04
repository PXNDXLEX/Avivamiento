export type Role = 'principal' | 'admin' | 'user';

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
  age: number | null;
  city: string | null;
  address: string | null;
  phone: string | null;
  status: 'Nuevo' | 'Reconciliado' | 'Visitante';
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
  leader_id: string | null;
  created_at: string;
}

export interface Attendance {
  id: string;
  house_group_id: string;
  member_id: string;
  meeting_date: string;
  created_at: string;
}
