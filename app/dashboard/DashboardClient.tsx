'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { signOut, adminCreateUser, adminUpdateUserRole, adminUpdateUser } from '@/app/actions';
import type { Profile, Member, Role, HouseGroup, Attendance, HouseGroupMeeting } from '@/lib/types';
import { MUNICIPIOS_NUEVA_ESPARTA } from '@/lib/types';
import { formatearFecha, formatearFechaCorta, getRandomVersiculo } from '@/lib/utils';
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  LineChart,
  Line,
  AreaChart,
  Area,
} from 'recharts';
import {
  Users,
  UserPlus,
  BarChart2,
  LogOut,
  Search,
  Plus,
  Edit2,
  Trash2,
  X,
  Shield,
  User,
  Crown,
  Loader2,
  MapPin,
  AlertTriangle,
  CheckCircle,
  Check,
  Filter,
  Flame,
  Home,
  Calendar,
  BookOpen,
  Activity,
  CalendarDays,
} from 'lucide-react';

/* ─── Types & Constants ─────────────────────────────────── */
interface Props {
  profile: Profile;
}

const STATUS_COLORS: Record<string, string> = {
  Nuevo: 'var(--color-nuevo)',
  Reconciliado: 'var(--color-reconciliado)',
  Visitante: 'var(--color-visitante)',
};

const CASA_COLORS = [
  '#C9A84C', // Dorado distintivo
  '#3b82f6', // Azul real
  '#10b981', // Verde esmeralda
  '#f59e0b', // Ámbar
  '#8b5cf6', // Violeta
  '#ec4899', // Rosa vibrante
  '#06b6d4', // Cyan
  '#f97316', // Naranja
  '#14b8a6', // Teal
  '#6366f1', // Indigo
];

const ROLE_LABELS: Record<Role, string> = {
  principal: 'Principal',
  admin: 'Administrador',
  user: 'Consolidador',
};

type ActiveTab = 'home' | 'members' | 'reports' | 'users' | 'casas';

/* ─── Sub-components ────────────────────────────────────── */

function StatCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: number;
  icon: string;
  color: string;
}) {
  return (
    <div className="card-metric">
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
        }}
      >
        <div>
          <p
            style={{
              fontSize: '0.75rem',
              color: 'var(--text-muted)',
              fontWeight: 600,
              marginBottom: '0.5rem',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
            }}
          >
            {label}
          </p>
          <p
            className="font-cinzel"
            style={{
              fontSize: '2.4rem',
              fontWeight: 700,
              color,
              lineHeight: 1,
            }}
          >
            {value}
          </p>
        </div>
        <span style={{ fontSize: '1.8rem' }}>{icon}</span>
      </div>
    </div>
  );
}

function Toast({
  msg,
  type,
}: {
  msg: string;
  type: 'success' | 'error';
}) {
  return (
    <div
      role="alert"
      className={`toast toast-${type === 'success' ? 'success' : 'error'}`}
      style={{
        position: 'fixed',
        top: '1.5rem',
        right: '1.5rem',
        zIndex: 9999,
        animation: 'slide-in-right 0.3s ease',
      }}
    >
      {type === 'success' ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
      {msg}
    </div>
  );
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 300,
        background: 'rgba(0,0,0,0.75)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="card-glass animate-bounce-in"
        style={{
          width: '100%',
          maxWidth: '520px',
          padding: '1.75rem',
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '1.5rem',
          }}
        >
          <h2 className="font-cinzel" style={{ fontSize: '1.1rem' }}>
            {title}
          </h2>
          <button
            onClick={onClose}
            className="btn btn-secondary btn-icon"
            aria-label="Cerrar"
          >
            <X size={16} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ─── Main Component ────────────────────────────────────── */

export default function DashboardClient({ profile }: Props) {
  const supabase = createClient();

  /* Tab */
  const [activeTab, setActiveTab] = useState<ActiveTab>('home');
  const [reportsTab, setReportsTab] = useState<'general' | 'casas'>('general');
  const [casasSubTab, setCasasSubTab] = useState<'gestionar' | 'asignar'>('gestionar');
  const [casasChartType, setCasasChartType] = useState<'bar' | 'line'>('bar');

  /* Asignar Miembros state */
  const [assignSearch, setAssignSearch] = useState('');
  const [assignSelectedCasa, setAssignSelectedCasa] = useState('');
  const [assigningMember, setAssigningMember] = useState<string | null>(null);

  /* Date Filter */
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'week' | 'month'>('all');

  /* Daily Verse */
  const [versiculo, setVersiculo] = useState<{ texto: string; referencia: string } | null>(null);

  useEffect(() => {
    setVersiculo(getRandomVersiculo());
  }, []);

  /* Members */
  const [members, setMembers] = useState<Member[]>([]);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [loadingMembers, setLoadingMembers] = useState(true);

  /* Profiles (users) */
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loadingProfiles, setLoadingProfiles] = useState(false);

  /* Casas de Dios y Asistencias */
  const [houseGroups, setHouseGroups] = useState<HouseGroup[]>([]);
  const [attendances, setAttendances] = useState<Attendance[]>([]);
  const [houseGroupMeetings, setHouseGroupMeetings] = useState<HouseGroupMeeting[]>([]);

  /* Member modal */
  const [memberModal, setMemberModal] = useState<{
    open: boolean;
    member?: Member;
  }>({ open: false });
  const emptyMemberForm = {
    full_name: '',
    age: '',
    gender: '' as string,
    municipio: '',
    address: '',
    phone: '',
    status: 'Nuevo' as Member['status'],
  };
  const [memberForm, setMemberForm] = useState(emptyMemberForm);
  const [savingMember, setSavingMember] = useState(false);
  const [memberError, setMemberError] = useState('');

  /* User modal */
  const [userModal, setUserModal] = useState<{ open: boolean; userId?: string }>({ open: false });
  const emptyUserForm = {
    username: '',
    password: '',
    full_name: '',
    phone: '',
    role: 'user' as Role,
  };
  const [userForm, setUserForm] = useState(emptyUserForm);
  const [savingUser, setSavingUser] = useState(false);
  const [userError, setUserError] = useState('');

  /* Delete confirm */
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  /* Casa modal */
  const [casaModal, setCasaModal] = useState<{
    open: boolean;
    casa?: HouseGroup;
  }>({ open: false });
  const emptyCasaForm = {
    name: '',
    address: '',
    municipio: '',
    leader_id: '',
  };
  const [casaForm, setCasaForm] = useState(emptyCasaForm);
  const [savingCasa, setSavingCasa] = useState(false);
  const [casaError, setCasaError] = useState('');

  /* Service History Modal */
  const [historyModal, setHistoryModal] = useState<{ open: boolean; houseGroupId?: string; houseGroupName?: string }>({ open: false });

  /* Service Control Modal */
  const [serviceModal, setServiceModal] = useState<{ open: boolean; houseGroupId?: string }>({ open: false });
  const emptyServiceForm = {
    topic: '',
    date: new Date().toISOString().split('T')[0],
    start_time: '',
    end_time: '',
    attendeeIds: [] as string[],
  };
  const [serviceForm, setServiceForm] = useState(emptyServiceForm);
  const [savingService, setSavingService] = useState(false);
  const [serviceError, setServiceError] = useState('');
  const [serviceSearch, setServiceSearch] = useState('');

  /* Fast New Member Modal inside Service */
  const [fastNewMemberOpen, setFastNewMemberOpen] = useState(false);
  const emptyFastMember = { full_name: '', phone: '' };
  const [fastMemberForm, setFastMemberForm] = useState(emptyFastMember);
  const [savingFastMember, setSavingFastMember] = useState(false);
  const [deleteCasaConfirm, setDeleteCasaConfirm] = useState<string | null>(null);

  /* Toast */
  const [toast, setToast] = useState<{
    msg: string;
    type: 'success' | 'error';
  } | null>(null);

  function showToast(msg: string, type: 'success' | 'error' = 'success') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }

  /* ── Data fetching ── */
  const fetchMembers = useCallback(async () => {
    setLoadingMembers(true);
    const { data } = await supabase
      .from('members')
      .select('*')
      .is('deleted_at', null)
      .order('created_at', { ascending: false });
    setMembers(data ?? []);
    setLoadingMembers(false);
  }, [supabase]);

  const fetchProfiles = useCallback(async () => {
    if (profile.role !== 'principal' && profile.role !== 'admin') return;
    setLoadingProfiles(true);
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .is('deleted_at', null)
      .order('created_at', { ascending: false });
    setProfiles(data ?? []);
    setLoadingProfiles(false);
  }, [supabase, profile.role]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  const fetchCasasData = useCallback(async () => {
    try {
      const [{ data: hgData }, { data: attData }, { data: meetData }] = await Promise.all([
        supabase.from('house_groups').select('*'),
        supabase.from('attendances').select('*'),
        supabase.from('house_group_meetings').select('*')
      ]);
      setHouseGroups(hgData ?? []);
      setAttendances(attData ?? []);
      setHouseGroupMeetings(meetData ?? []);
    } catch (e) {
      // Ignorar de forma silenciosa si las tablas no existen todavía
    }
  }, [supabase]);

  useEffect(() => {
    if (activeTab === 'users' || activeTab === 'casas') fetchProfiles();
    if (activeTab === 'reports' || activeTab === 'casas') fetchCasasData();
  }, [activeTab, fetchProfiles, fetchCasasData]);

  /* ── Derived state ── */
  const filteredMembers = members.filter((m) => {
    const q = search.toLowerCase();
    const matchSearch =
      m.full_name.toLowerCase().includes(q) ||
      (m.municipio ?? '').toLowerCase().includes(q) ||
      (m.phone ?? '').toLowerCase().includes(q) ||
      (m.consolidator_name || '').toLowerCase().includes(q);
    const matchStatus = filterStatus === 'all' || m.status === filterStatus;
    
    // 2. Date filter
    let matchDate = true;
    if (dateFilter !== 'all' && m.created_at) {
      const created = new Date(m.created_at);
      const now = new Date();
      
      if (dateFilter === 'today') {
        matchDate = created.toDateString() === now.toDateString();
      } else if (dateFilter === 'week') {
        const diff = now.getDate() - now.getDay() + (now.getDay() === 0 ? -6 : 1);
        const startOfWeek = new Date(now.setDate(diff));
        startOfWeek.setHours(0, 0, 0, 0);
        matchDate = created >= startOfWeek;
      } else if (dateFilter === 'month') {
        matchDate = created.getMonth() === now.getMonth() && created.getFullYear() === now.getFullYear();
      }
    }

    return matchSearch && matchStatus && matchDate;
  });

  const stats = {
    total: members.length,
    nuevo: members.filter((m) => m.status === 'Nuevo').length,
    reconciliado: members.filter((m) => m.status === 'Reconciliado').length,
    visitante: members.filter((m) => m.status === 'Visitante').length,
  };

  const statusChartData = [
    { name: 'Nuevos', value: stats.nuevo, color: STATUS_COLORS.Nuevo },
    {
      name: 'Reconciliados',
      value: stats.reconciliado,
      color: STATUS_COLORS.Reconciliado,
    },
    {
      name: 'Visitantes',
      value: stats.visitante,
      color: STATUS_COLORS.Visitante,
    },
  ];

  const municipioChartData = Object.entries(
    filteredMembers.reduce((acc: Record<string, number>, m) => {
      if (m.status === 'Nuevo' || m.status === 'Reconciliado' || m.status === 'Visitante') {
        if (m.municipio) {
          acc[m.municipio] = (acc[m.municipio] ?? 0) + 1;
        }
      }
      return acc;
    }, {})
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, value]) => ({ name, value }));

  /* Growth Chart Data */
  const growthChartData = members.reduce((acc, m) => {
    if (m.created_at) {
      const date = new Date(m.created_at);
      const monthYear = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const existing = acc.find(item => item.name === monthYear);
      if (existing) {
        existing.value += 1;
      } else {
        acc.push({ name: monthYear, value: 1 });
      }
    }
    return acc;
  }, [] as { name: string; value: number }[])
  .sort((a, b) => a.name.localeCompare(b.name));

  let cumulative = 0;
  const growthChartCumulative = growthChartData.map(item => {
    cumulative += item.value;
    return { name: item.name, 'Nuevos': item.value, 'Total': cumulative };
  });

  /* Casas de Dios Data - Asistencias agrupadas por fecha y por Casa de Dios */
  const attendanceByDateAndHouse: Record<string, Record<string, number>> = {};

  houseGroupMeetings.forEach((meeting) => {
    const dateKey = meeting.date;
    const attendeesCount = attendances.filter((a) => a.meeting_id === meeting.id).length;
    if (!attendanceByDateAndHouse[dateKey]) {
      attendanceByDateAndHouse[dateKey] = {};
    }
    attendanceByDateAndHouse[dateKey][meeting.house_group_id] =
      (attendanceByDateAndHouse[dateKey][meeting.house_group_id] || 0) + attendeesCount;
  });

  const sortedMeetingDates = Object.keys(attendanceByDateAndHouse).sort(
    (a, b) => new Date(a).getTime() - new Date(b).getTime()
  );

  const casasTimelineData = sortedMeetingDates.map((dateKey) => {
    const point: Record<string, any> = {
      fecha: formatearFechaCorta(dateKey),
      rawDate: dateKey,
    };
    houseGroups.forEach((hg) => {
      point[hg.name] = attendanceByDateAndHouse[dateKey][hg.id] ?? 0;
    });
    return point;
  });

  const activeRegularMembers = new Set(attendances.map(a => a.member_id)).size;

  /* ── Member CRUD ── */
  function openAddMember() {
    setMemberForm(emptyMemberForm);
    setMemberError('');
    setMemberModal({ open: true });
  }

  function openEditMember(member: Member) {
    setMemberForm({
      full_name: member.full_name,
      age: member.age?.toString() ?? '',
      gender: member.gender ?? '',
      municipio: member.municipio ?? '',
      address: member.address ?? '',
      phone: member.phone ?? '',
      status: member.status,
    });
    setMemberError('');
    setMemberModal({ open: true, member });
  }

  async function saveMember() {
    if (!memberForm.full_name.trim()) {
      setMemberError('El nombre completo es requerido.');
      return;
    }
    setSavingMember(true);
    setMemberError('');

    const payload = {
      full_name: memberForm.full_name.trim(),
      age: memberForm.age ? parseInt(memberForm.age) : null,
      gender: memberForm.gender || null,
      municipio: memberForm.municipio || null,
      address: memberForm.address || null,
      phone: memberForm.phone || null,
      status: memberForm.status,
      house_group_id: null,
    };

    try {
      if (memberModal.member) {
        const { error } = await supabase
          .from('members')
          .update(payload)
          .eq('id', memberModal.member.id);
        if (error) throw error;
        showToast('Miembro actualizado correctamente.');
      } else {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        const { error } = await supabase.from('members').insert({
          ...payload,
          consolidator_id: user?.id,
          consolidator_name: profile.full_name,
        });
        if (error) throw error;
        showToast('Miembro registrado correctamente.');
      }
      setMemberModal({ open: false });
      fetchMembers();
    } catch (err: unknown) {
      setMemberError(
        err instanceof Error ? err.message : 'Error al guardar.'
      );
    } finally {
      setSavingMember(false);
    }
  }

  async function confirmDelete(id: string) {
    const { error } = await supabase
      .from('members')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);
    if (error) {
      showToast('Error al eliminar el miembro.', 'error');
    } else {
      showToast('Miembro eliminado.');
      fetchMembers();
    }
    setDeleteConfirm(null);
  }

  /* ── User management ── */
  async function saveUser() {
    if (!userModal.userId && (!userForm.username || !userForm.password || !userForm.full_name)) {
      setUserError('Usuario, contraseña y nombre son requeridos para un nuevo usuario.');
      return;
    }
    if (userModal.userId && (!userForm.username || !userForm.full_name)) {
      setUserError('Usuario y nombre son requeridos para editar.');
      return;
    }
    setSavingUser(true);
    setUserError('');
    try {
      if (userModal.userId) {
        await adminUpdateUser(userModal.userId, userForm);
        showToast('Usuario actualizado exitosamente.');
      } else {
        await adminCreateUser(userForm);
        showToast('Usuario creado exitosamente.');
      }
      setUserModal({ open: false });
      setUserForm(emptyUserForm);
      fetchProfiles();
    } catch (err: unknown) {
      setUserError(
        err instanceof Error ? err.message : 'Error al guardar usuario.'
      );
    } finally {
      setSavingUser(false);
    }
  }

  async function updateRole(userId: string, role: Role) {
    try {
      await adminUpdateUserRole(userId, role);
      showToast('Rol actualizado.');
      fetchProfiles();
    } catch {
      showToast('Error al actualizar el rol.', 'error');
    }
  }

  /* ── Casas management ── */
  async function saveCasa() {
    if (!casaForm.name.trim()) {
      setCasaError('El nombre es requerido.');
      return;
    }
    setSavingCasa(true);
    setCasaError('');

    const payload = {
      name: casaForm.name.trim(),
      address: casaForm.address || null,
      municipio: casaForm.municipio || null,
      leader_id: casaForm.leader_id || null,
    };

    try {
      if (casaModal.casa) {
        const { error } = await supabase
          .from('house_groups')
          .update(payload)
          .eq('id', casaModal.casa.id);
        if (error) throw error;
        showToast('Casa de Dios actualizada.');
      } else {
        const { error } = await supabase.from('house_groups').insert(payload);
        if (error) throw error;
        showToast('Casa de Dios registrada.');
      }
      setCasaModal({ open: false });
      fetchCasasData();
    } catch (err: unknown) {
      setCasaError(err instanceof Error ? err.message : 'Error al guardar.');
    } finally {
      setSavingCasa(false);
    }
  }

  async function confirmDeleteCasa(id: string) {
    const { error } = await supabase.from('house_groups').delete().eq('id', id);
    if (error) {
      showToast('Error al eliminar (puede tener asistencias asociadas).', 'error');
    } else {
      showToast('Casa de Dios eliminada.');
      fetchCasasData();
    }
    setDeleteCasaConfirm(null);
  }

  /* ── Service Control ── */
  async function saveServiceControl() {
    if (!serviceForm.topic.trim()) {
      setServiceError('El título de la enseñanza es requerido.');
      return;
    }
    if (!serviceForm.start_time || !serviceForm.end_time) {
      setServiceError('Las horas de inicio y fin son requeridas.');
      return;
    }
    setSavingService(true);
    setServiceError('');

    try {
      const { data: meetingData, error: meetingError } = await supabase
        .from('house_group_meetings')
        .insert({
          house_group_id: serviceModal.houseGroupId,
          topic: serviceForm.topic.trim(),
          date: serviceForm.date,
          start_time: serviceForm.start_time,
          end_time: serviceForm.end_time,
        })
        .select('id')
        .single();
      
      if (meetingError) throw meetingError;

      if (serviceForm.attendeeIds.length > 0) {
        const attendancePayload = serviceForm.attendeeIds.map(memberId => ({
          meeting_id: meetingData.id,
          member_id: memberId,
        }));
        
        const { error: attError } = await supabase
          .from('attendances')
          .insert(attendancePayload);
          
        if (attError) throw attError;
      }
      
      showToast('Control de servicio guardado correctamente.');
      setServiceModal({ open: false });
      fetchCasasData();
    } catch (err: any) {
      console.error(err);
      setServiceError(err.message || 'Error al guardar el control de servicio.');
    } finally {
      setSavingService(false);
    }
  }

  async function saveFastMember() {
    if (!fastMemberForm.full_name.trim()) return;
    setSavingFastMember(true);
    try {
      const { data: inserted, error } = await supabase.from('members').insert({
        full_name: fastMemberForm.full_name.trim(),
        phone: fastMemberForm.phone || null,
        status: 'Nuevo',
        house_group_id: serviceModal.houseGroupId,
        consolidator_id: profile?.id,
        consolidator_name: profile?.full_name,
      }).select('id').single();

      if (error) throw error;
      
      setServiceForm(prev => ({
        ...prev,
        attendeeIds: [...prev.attendeeIds, inserted.id]
      }));
      
      setFastNewMemberOpen(false);
      setFastMemberForm(emptyFastMember);
      fetchMembers();
    } catch (err) {
      console.error(err);
    } finally {
      setSavingFastMember(false);
    }
  }

  /* ── Tabs config ── */
  const tabs = [
    { key: 'home' as ActiveTab, icon: <Home size={15} />, label: 'Inicio' },
    { key: 'members' as ActiveTab, icon: <Users size={15} />, label: 'Miembros' },
    { key: 'reports' as ActiveTab, icon: <BarChart2 size={15} />, label: 'Reportes' },
    { key: 'casas' as ActiveTab, icon: <Flame size={15} />, label: 'Casa de Dios' },
    ...(profile.role === 'principal' || profile.role === 'admin'
      ? [
          {
            key: 'users' as ActiveTab,
            icon: <Shield size={15} />,
            label: 'Usuarios',
          },
        ]
      : []),
  ];

  /* ══════════════════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════════════════ */
  return (
    <div className="app-layout">
      {/* Toast */}
      {toast && <Toast msg={toast.msg} type={toast.type} />}

      {/* ── Sidebar (Desktop) ── */}
      <aside className="sidebar hide-on-mobile" style={{ padding: '2rem 1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '3rem' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '50%', overflow: 'hidden', border: '1px solid var(--border-gold)', background: 'var(--bg-primary)', flexShrink: 0 }}>
            <img src="/logo.jpg" alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
          <div>
            <p className="font-cinzel" style={{ fontSize: '1rem', color: 'var(--text-primary)' }}>Avivamiento</p>
            <p className="text-gold" style={{ fontSize: '0.7rem' }}>León de la Tribu de Judá</p>
          </div>
        </div>

        <div style={{ marginBottom: '2rem' }}>
          <p className="text-muted" style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '0.75rem' }}>Mi Perfil</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div className="avatar-placeholder" style={{ width: 40, height: 40, fontSize: '1rem' }}>
              {profile.full_name.charAt(0).toUpperCase()}
            </div>
            <div>
              <p style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>{profile.full_name}</p>
              <span className={`badge badge-${profile.role}`} style={{ fontSize: '0.65rem' }}>{ROLE_LABELS[profile.role]}</span>
            </div>
          </div>
        </div>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
          {tabs.map((t) => (
            <button key={t.key} onClick={() => setActiveTab(t.key)} className={`btn ${activeTab === t.key ? 'btn-primary' : 'btn-secondary'}`} style={{ justifyContent: 'flex-start', padding: '0.75rem 1rem' }}>
              {t.icon}
              {t.label}
            </button>
          ))}
        </nav>

        <form action={signOut} style={{ marginTop: 'auto' }}>
            <button type="submit" className="btn btn-secondary" style={{ width: '100%', gap: '0.5rem' }}>
            <LogOut size={16} />
            Cerrar Sesión
            </button>
        </form>
      </aside>

      {/* ── Main ── */}
      <main className="main-content">
        {/* Mobile Header (Hidden on Desktop) */}
        <div className="hide-on-desktop" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div className="avatar-placeholder" style={{ width: 36, height: 36, fontSize: '0.9rem' }}>
              {profile.full_name.charAt(0).toUpperCase()}
            </div>
            <div>
              <p style={{ fontSize: '0.9rem', fontWeight: 600 }}>{profile.full_name}</p>
              <span className={`badge badge-${profile.role}`} style={{ fontSize: '0.6rem' }}>{ROLE_LABELS[profile.role]}</span>
            </div>
          </div>
          <form action={signOut}>
            <button type="submit" className="btn btn-secondary btn-icon" style={{ width: 36, height: 36 }}>
                <LogOut size={16} />
            </button>
          </form>
        </div>

        {/* Page title and Date Filter */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' }}>
          <div>
            <h1
              className="font-cinzel animate-slide-up"
              style={{ fontSize: 'clamp(1.4rem, 3vw, 2rem)' }}
            >
              Panel de Control
            </h1>
            <p
              className="text-muted animate-fade-in"
              style={{ fontSize: '0.875rem', marginTop: '0.3rem' }}
            >
              Gestión de miembros y estadísticas de la congregación
            </p>
          </div>

          <div className="animate-fade-in">
            <select
              className="form-select"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value as any)}
              style={{ padding: '0.6rem 2.5rem 0.6rem 1rem', fontSize: '0.85rem', width: 'auto', background: 'var(--bg-secondary)', border: '1px solid var(--border-gold)' }}
            >
              <option value="all">📅 Todos los tiempos</option>
              <option value="today">📅 Hoy</option>
              <option value="week">📅 Esta Semana</option>
              <option value="month">📅 Este Mes</option>
            </select>
          </div>
        </div>

        {/* ── Home Tab ── */}
        {activeTab === 'home' && (
          <div className="animate-fade-in">
            {versiculo && (
              <div className="verse-banner" style={{ marginBottom: '2rem' }}>
                <div style={{ position: 'absolute', top: '-10%', left: '-5%', opacity: 0.04 }}>
                  <BookOpen size={120} />
                </div>
                <BookOpen size={24} style={{ color: 'var(--gold-primary)', margin: '0 auto 1rem' }} />
                <p className="font-cinzel verse-text">
                  &ldquo;{versiculo.texto}&rdquo;
                </p>
                <p className="verse-ref">
                  — {versiculo.referencia}
                </p>
              </div>
            )}

            <h2 className="font-cinzel" style={{ fontSize: '1.2rem', marginBottom: '1rem' }}>Resumen de Registros</h2>
            <div className="grid-4" style={{ marginBottom: '2rem' }}>
              <StatCard label="Total Miembros" value={stats.total} icon="👥" color="var(--gold-primary)" />
              <StatCard label="Nuevos" value={stats.nuevo} icon="✨" color={STATUS_COLORS.Nuevo} />
              <StatCard label="Reconciliados" value={stats.reconciliado} icon="🕊️" color={STATUS_COLORS.Reconciliado} />
              <StatCard label="Visitantes" value={stats.visitante} icon="🚶" color={STATUS_COLORS.Visitante} />
            </div>
          </div>
        )}


        {/* ── Members Tab ── */}
        {activeTab === 'members' && (
          <div className="animate-fade-in">
            {/* Toolbar */}
            <div
              style={{
                display: 'flex',
                gap: '0.75rem',
                marginBottom: '1rem',
                flexWrap: 'wrap',
              }}
            >
              <div
                style={{ flex: 1, minWidth: '200px', position: 'relative' }}
              >
                <Search
                  size={15}
                  style={{
                    position: 'absolute',
                    left: '1rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--text-muted)',
                    pointerEvents: 'none',
                  }}
                />
                <input
                  className="form-input"
                  id="member-search"
                  type="text"
                  placeholder="Buscar por nombre, ciudad o consolidador..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={{ paddingLeft: '2.5rem' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                {['all', 'Nuevo', 'Reconciliado', 'Visitante'].map((s) => (
                  <button
                    key={s}
                    onClick={() => setFilterStatus(s)}
                    className={`btn ${
                      filterStatus === s ? 'btn-primary' : 'btn-secondary'
                    }`}
                    style={{
                      padding: '0.55rem 0.85rem',
                      fontSize: '0.8rem',
                    }}
                  >
                    {s === 'all' ? 'Todos' : s}
                  </button>
                ))}
              </div>

              <button
                onClick={openAddMember}
                className="btn btn-primary"
                id="add-member-btn"
                style={{ whiteSpace: 'nowrap' }}
              >
                <Plus size={16} />
                Agregar Miembro
              </button>
            </div>

            {/* Table */}
            {loadingMembers ? (
              <div
                style={{
                  textAlign: 'center',
                  padding: '5rem',
                  color: 'var(--text-muted)',
                }}
              >
                <Loader2
                  size={32}
                  style={{
                    margin: '0 auto 1rem',
                    animation: 'spin 1s linear infinite',
                    display: 'block',
                  }}
                />
                <p>Cargando miembros...</p>
              </div>
            ) : filteredMembers.length === 0 ? (
              <div
                style={{
                  textAlign: 'center',
                  padding: '5rem',
                  color: 'var(--text-muted)',
                }}
              >
                <Users
                  size={48}
                  style={{ margin: '0 auto 1rem', opacity: 0.25, display: 'block' }}
                />
                <p>No se encontraron miembros.</p>
                {search && (
                  <button
                    className="btn btn-secondary"
                    style={{ marginTop: '1rem', fontSize: '0.85rem' }}
                    onClick={() => setSearch('')}
                  >
                    Limpiar búsqueda
                  </button>
                )}
              </div>
            ) : (
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Nombre</th>
                      <th>Miembro</th>
                      <th>Municipio</th>
                      <th>Teléfono</th>
                      <th>Consolidador</th>
                      <th>Registrado</th>
                      <th style={{ textAlign: 'center' }}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMembers.map((member) => (
                      <tr key={member.id}>
                        <td>
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.65rem',
                            }}
                          >
                            <div
                              className="avatar-placeholder"
                              style={{
                                width: 32,
                                height: 32,
                                fontSize: '0.75rem',
                                flexShrink: 0,
                              }}
                            >
                              {member.full_name.charAt(0).toUpperCase()}
                            </div>
                            <span style={{ fontWeight: 600 }}>
                              {member.full_name}
                            </span>
                          </div>
                        </td>
                        <td>
                          <span
                            className={`badge badge-${member.status.toLowerCase()}`}
                          >
                            {member.status}
                          </span>
                        </td>
                        <td className="text-secondary">
                          {member.municipio ?? '—'}
                        </td>
                        <td className="text-secondary">
                          {member.phone ?? '—'}
                        </td>
                        <td className="text-secondary">
                          {member.consolidator_name}
                        </td>
                        <td
                          className="text-muted"
                          style={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}
                          suppressHydrationWarning
                        >
                          {formatearFecha(member.created_at)}
                        </td>
                        <td>
                          <div
                            style={{
                              display: 'flex',
                              gap: '0.4rem',
                              justifyContent: 'center',
                            }}
                          >
                            <button
                              onClick={() => openEditMember(member)}
                              className="btn btn-secondary btn-icon"
                              title="Editar"
                              aria-label="Editar miembro"
                            >
                              <Edit2 size={13} />
                            </button>

                            {deleteConfirm === member.id ? (
                              <>
                                <button
                                  onClick={() => confirmDelete(member.id)}
                                  className="btn btn-danger btn-icon"
                                  title="Confirmar eliminación"
                                >
                                  <Check size={13} />
                                </button>
                                <button
                                  onClick={() => setDeleteConfirm(null)}
                                  className="btn btn-secondary btn-icon"
                                  title="Cancelar"
                                >
                                  <X size={13} />
                                </button>
                              </>
                            ) : (
                              <button
                                onClick={() => setDeleteConfirm(member.id)}
                                className="btn btn-danger btn-icon"
                                title="Eliminar"
                                aria-label="Eliminar miembro"
                              >
                                <Trash2 size={13} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {!loadingMembers && members.length > 0 && (
              <p
                className="text-muted"
                style={{
                  fontSize: '0.8rem',
                  marginTop: '0.75rem',
                  textAlign: 'right',
                }}
              >
                Mostrando {filteredMembers.length} de {members.length} miembros
              </p>
            )}
          </div>
        )}

        {/* ── Reports Tab ── */}
        {activeTab === 'reports' && (
          <div className="animate-fade-in">
            {/* Sub-tabs for Reports */}
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.5rem' }}>
              <button
                onClick={() => setReportsTab('general')}
                className={`btn ${reportsTab === 'general' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ borderRadius: '20px', padding: '0.4rem 1.2rem' }}
              >
                Reportes Generales
              </button>
              <button
                onClick={() => setReportsTab('casas')}
                className={`btn ${reportsTab === 'casas' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ borderRadius: '20px', padding: '0.4rem 1.2rem' }}
              >
                Casas de Dios
              </button>
            </div>

            {reportsTab === 'general' ? (
              <div
                style={{
                  display: 'grid',
                  gap: '1.5rem',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))',
                }}
              >
                {/* Growth Line Chart */}
                <div className="card" style={{ padding: '1.5rem', gridColumn: '1 / -1' }}>
                  <h3 className="font-cinzel" style={{ fontSize: '0.95rem', marginBottom: '1.5rem' }}>Crecimiento de Miembros</h3>
                  <ResponsiveContainer width="100%" height={280}>
                    <AreaChart data={growthChartCumulative}>
                      <defs>
                        <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="var(--gold-primary)" stopOpacity={0.8}/>
                          <stop offset="95%" stopColor="var(--gold-primary)" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                      <XAxis dataKey="name" stroke="var(--text-muted)" tick={{ fontSize: 11 }} />
                      <YAxis stroke="var(--text-muted)" tick={{ fontSize: 11 }} allowDecimals={false} />
                      <Tooltip
                        contentStyle={{
                          background: 'var(--bg-card)',
                          border: '1px solid var(--border-gold)',
                          borderRadius: '8px',
                          color: 'var(--text-primary)',
                        }}
                      />
                      <Legend />
                      <Area type="monotone" dataKey="Total" stroke="var(--gold-primary)" fillOpacity={1} fill="url(#colorTotal)" />
                      <Area type="monotone" dataKey="Nuevos" stroke="#2ecc71" fillOpacity={0} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                {/* Status pie chart */}
                <div className="card" style={{ padding: '1.5rem' }}>
                  <h3
                    className="font-cinzel"
                    style={{ fontSize: '0.95rem', marginBottom: '1.5rem' }}
                  >
                    Distribución por Estado
                  </h3>
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie
                        data={statusChartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={65}
                        outerRadius={105}
                        paddingAngle={4}
                        dataKey="value"
                        label={({ name, value }) => `${name}: ${value}`}
                        labelLine={false}
                      >
                        {statusChartData.map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          background: 'var(--bg-card)',
                          border: '1px solid var(--border-gold)',
                          borderRadius: '8px',
                          color: 'var(--text-primary)',
                          fontSize: '0.85rem',
                        }}
                      />
                      <Legend
                        formatter={(v) => (
                          <span
                            style={{
                              color: 'var(--text-secondary)',
                              fontSize: '0.85rem',
                            }}
                          >
                            {v}
                          </span>
                        )}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                {/* City bar chart */}
                <div className="card" style={{ padding: '1.5rem' }}>
                  <h3
                    className="font-cinzel"
                    style={{ fontSize: '0.95rem', marginBottom: '1.5rem' }}
                  >
                    Miembros agrupados por municipio
                  </h3>
                  {municipioChartData.length === 0 ? (
                    <div
                      style={{
                        textAlign: 'center',
                        color: 'var(--text-muted)',
                        padding: '4rem 0',
                      }}
                    >
                      <MapPin
                        size={36}
                        style={{
                          margin: '0 auto 0.75rem',
                          opacity: 0.3,
                          display: 'block',
                        }}
                      />
                      <p>Sin datos de ciudades registrados</p>
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart data={municipioChartData} layout="vertical">
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="rgba(255,255,255,0.05)"
                          horizontal={false}
                        />
                        <XAxis
                          type="number"
                          stroke="var(--text-muted)"
                          tick={{ fontSize: 11 }}
                          allowDecimals={false}
                        />
                        <YAxis
                          type="category"
                          dataKey="name"
                          width={90}
                          stroke="var(--text-muted)"
                          tick={{ fontSize: 11 }}
                        />
                        <Tooltip
                          contentStyle={{
                            background: 'var(--bg-card)',
                            border: '1px solid var(--border-gold)',
                            borderRadius: '8px',
                            color: 'var(--text-primary)',
                            fontSize: '0.85rem',
                          }}
                        />
                        <Bar
                          dataKey="value"
                          fill="var(--gold-primary)"
                          radius={[0, 4, 4, 0]}
                          name="Miembros"
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
            ) : (
              <div
                className="animate-fade-in"
                style={{
                  display: 'grid',
                  gap: '1.5rem',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))',
                }}
              >
                {/* Metricas Casas */}
                <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                  <StatCard label="Casas de Dios Activas" value={houseGroups.length} icon="🏠" color="var(--gold-primary)" />
                  <StatCard label="Miembros Regulares" value={activeRegularMembers} icon="👥" color="#3498db" />
                </div>

                {/* Attendance Chart - Por Casa y Fecha con Leyenda */}
                <div className="card" style={{ padding: '1.5rem', gridColumn: '1 / -1' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                    <div>
                      <h3 className="font-cinzel" style={{ fontSize: '1rem', marginBottom: '0.25rem' }}>
                        Asistencia por Casa de Dios y Fecha
                      </h3>
                      <p className="text-muted" style={{ fontSize: '0.8rem' }}>
                        Historial comparativo de participantes por servicio realizado
                      </p>
                    </div>
                    {casasTimelineData.length > 0 && (
                      <div style={{ display: 'flex', gap: '0.5rem', background: 'var(--bg-secondary)', padding: '0.25rem', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                        <button
                          onClick={() => setCasasChartType('bar')}
                          className={`btn ${casasChartType === 'bar' ? 'btn-primary' : 'btn-secondary'}`}
                          style={{ padding: '0.3rem 0.8rem', fontSize: '0.75rem', borderRadius: '6px' }}
                        >
                          Barras
                        </button>
                        <button
                          onClick={() => setCasasChartType('line')}
                          className={`btn ${casasChartType === 'line' ? 'btn-primary' : 'btn-secondary'}`}
                          style={{ padding: '0.3rem 0.8rem', fontSize: '0.75rem', borderRadius: '6px' }}
                        >
                          Líneas
                        </button>
                      </div>
                    )}
                  </div>

                  {houseGroups.length === 0 ? (
                    <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '4rem 0' }}>
                      <Activity size={36} style={{ margin: '0 auto 0.75rem', opacity: 0.3, display: 'block' }} />
                      <p>Las métricas de asistencia estarán disponibles cuando se configuren las Casas de Dios.</p>
                    </div>
                  ) : casasTimelineData.length === 0 ? (
                    <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '3.5rem 1rem' }}>
                      <Activity size={36} style={{ margin: '0 auto 0.75rem', opacity: 0.3, display: 'block' }} />
                      <p style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
                        Sin registros de servicios con fecha aún
                      </p>
                      <p style={{ fontSize: '0.85rem' }}>
                        Registra los servicios realizados desde <strong>Casa de Dios &gt; Gestionar Casas &gt; Control de Servicio</strong> para visualizar la comparativa por fecha.
                      </p>
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height={320}>
                      {casasChartType === 'bar' ? (
                        <BarChart data={casasTimelineData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
                          <XAxis dataKey="fecha" stroke="var(--text-muted)" tick={{ fontSize: 11 }} />
                          <YAxis stroke="var(--text-muted)" tick={{ fontSize: 11 }} allowDecimals={false} />
                          <Tooltip
                            contentStyle={{
                              background: 'var(--bg-card)',
                              border: '1px solid var(--border-gold)',
                              borderRadius: '8px',
                              color: 'var(--text-primary)',
                              fontSize: '0.85rem',
                            }}
                          />
                          <Legend
                            formatter={(value) => (
                              <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginRight: '0.5rem' }}>
                                {value}
                              </span>
                            )}
                          />
                          {houseGroups.map((hg, idx) => (
                            <Bar
                              key={hg.id}
                              dataKey={hg.name}
                              fill={CASA_COLORS[idx % CASA_COLORS.length]}
                              radius={[4, 4, 0, 0]}
                            />
                          ))}
                        </BarChart>
                      ) : (
                        <LineChart data={casasTimelineData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
                          <XAxis dataKey="fecha" stroke="var(--text-muted)" tick={{ fontSize: 11 }} />
                          <YAxis stroke="var(--text-muted)" tick={{ fontSize: 11 }} allowDecimals={false} />
                          <Tooltip
                            contentStyle={{
                              background: 'var(--bg-card)',
                              border: '1px solid var(--border-gold)',
                              borderRadius: '8px',
                              color: 'var(--text-primary)',
                              fontSize: '0.85rem',
                            }}
                          />
                          <Legend
                            formatter={(value) => (
                              <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginRight: '0.5rem' }}>
                                {value}
                              </span>
                            )}
                          />
                          {houseGroups.map((hg, idx) => (
                            <Line
                              key={hg.id}
                              type="monotone"
                              dataKey={hg.name}
                              stroke={CASA_COLORS[idx % CASA_COLORS.length]}
                              strokeWidth={2.5}
                              dot={{ r: 4 }}
                              activeDot={{ r: 6 }}
                            />
                          ))}
                        </LineChart>
                      )}
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Casas Tab ── */}
        {activeTab === 'casas' && (
          <div className="animate-fade-in">
            {/* Sub-tabs */}
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.5rem' }}>
              <button
                onClick={() => setCasasSubTab('gestionar')}
                className={`btn ${casasSubTab === 'gestionar' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ borderRadius: '20px', padding: '0.4rem 1.2rem' }}
              >
                Gestionar Casas
              </button>
              <button
                onClick={() => setCasasSubTab('asignar')}
                className={`btn ${casasSubTab === 'asignar' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ borderRadius: '20px', padding: '0.4rem 1.2rem' }}
              >
                Asignar Miembros
              </button>
            </div>

            {/* ── Sub-tab: Gestionar Casas ── */}
            {casasSubTab === 'gestionar' && (
              <div>
                {profile.role !== 'user' && (
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
                    <button
                      onClick={() => {
                        setCasaForm(emptyCasaForm);
                        setCasaError('');
                        setCasaModal({ open: true });
                      }}
                      className="btn btn-primary"
                    >
                      <Plus size={16} />
                      Nueva Casa de Dios
                    </button>
                  </div>
                )}

                {(() => {
                  const visibleHouseGroups = profile.role === 'user'
                    ? houseGroups.filter(hg => hg.leader_id === profile.id)
                    : houseGroups;
                  
                  if (visibleHouseGroups.length === 0) {
                    return (
                      <div style={{ textAlign: 'center', padding: '5rem', color: 'var(--text-muted)' }}>
                        <Home size={48} style={{ margin: '0 auto 1rem', opacity: 0.25, display: 'block' }} />
                        <p>No hay Casas de Dios registradas.</p>
                      </div>
                    );
                  }
                  
                  return (
                    <div className="table-wrapper">
                      <table>
                        <thead>
                          <tr>
                            <th>Nombre</th>
                            <th>Municipio</th>
                            <th>Dirección</th>
                            <th>Líder Asignado</th>
                            <th>Registrada</th>
                            <th style={{ textAlign: 'center' }}>Acciones</th>
                          </tr>
                        </thead>
                        <tbody>
                          {visibleHouseGroups.map((casa) => {
                            const leader = profiles.find((p) => p.id === casa.leader_id);
                          return (
                            <tr key={casa.id}>
                              <td><strong>{casa.name}</strong></td>
                              <td className="text-secondary">{casa.municipio || '—'}</td>
                              <td className="text-secondary">{casa.address || '—'}</td>
                              <td className="text-secondary">{leader ? leader.full_name : '—'}</td>
                              <td className="text-muted" style={{ fontSize: '0.8rem' }} suppressHydrationWarning>
                                {formatearFecha(casa.created_at)}
                              </td>
                              <td>
                                <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'center' }}>
                                  <button
                                    onClick={() => {
                                      setServiceForm(emptyServiceForm);
                                      setServiceSearch('');
                                      setServiceError('');
                                      setServiceModal({ open: true, houseGroupId: casa.id });
                                    }}
                                    className="btn btn-primary btn-icon"
                                    title="Control de Servicio"
                                  >
                                    <BookOpen size={13} />
                                  </button>
                                  
                                  <button
                                    onClick={() => setHistoryModal({ open: true, houseGroupId: casa.id, houseGroupName: casa.name })}
                                    className="btn btn-secondary btn-icon"
                                    title="Historial de Servicios"
                                  >
                                    <CalendarDays size={13} />
                                  </button>

                                  {profile.role !== 'user' && (
                                    <>
                                      <button
                                        onClick={() => {
                                          setCasaForm({
                                            name: casa.name,
                                            address: casa.address || '',
                                            municipio: casa.municipio || '',
                                            leader_id: casa.leader_id || '',
                                          });
                                          setCasaError('');
                                          setCasaModal({ open: true, casa });
                                        }}
                                        className="btn btn-secondary btn-icon"
                                        title="Editar"
                                      >
                                        <Edit2 size={13} />
                                      </button>

                                      {deleteCasaConfirm === casa.id ? (
                                        <>
                                          <button onClick={() => confirmDeleteCasa(casa.id)} className="btn btn-danger btn-icon">
                                            <Check size={13} />
                                          </button>
                                          <button onClick={() => setDeleteCasaConfirm(null)} className="btn btn-secondary btn-icon">
                                            <X size={13} />
                                          </button>
                                        </>
                                      ) : (
                                        <button onClick={() => setDeleteCasaConfirm(casa.id)} className="btn btn-danger btn-icon" title="Eliminar">
                                          <Trash2 size={13} />
                                        </button>
                                      )}
                                    </>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                          })}
                        </tbody>
                      </table>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* ── Sub-tab: Asignar Miembros ── */}
            {casasSubTab === 'asignar' && (
              <div>
                <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                  <div style={{ flex: 1, minWidth: '200px' }}>
                    <label className="form-label" style={{ marginBottom: '0.4rem' }}>Buscar miembro</label>
                    <div style={{ position: 'relative' }}>
                      <Search
                        size={15}
                        style={{
                          position: 'absolute',
                          left: '1rem',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          color: 'var(--text-muted)',
                          pointerEvents: 'none',
                        }}
                      />
                      <input
                        className="form-input"
                        type="text"
                        placeholder="Buscar por nombre..."
                        value={assignSearch}
                        onChange={(e) => setAssignSearch(e.target.value)}
                        style={{ paddingLeft: '2.5rem' }}
                      />
                    </div>
                  </div>
                  <div style={{ minWidth: '220px' }}>
                    <label className="form-label" style={{ marginBottom: '0.4rem' }}>Filtrar por Casa de Dios</label>
                    <select
                      className="form-select"
                      value={assignSelectedCasa}
                      onChange={(e) => setAssignSelectedCasa(e.target.value)}
                    >
                      <option value="">Todos los miembros</option>
                      <option value="sin_asignar">🔴 Sin casa asignada</option>
                      {houseGroups.map(hg => (
                        <option key={hg.id} value={hg.id}>{hg.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {(() => {
                  let filteredAssignMembers = members.filter(m => {
                    const q = assignSearch.toLowerCase();
                    const matchSearch = !q || m.full_name.toLowerCase().includes(q);
                    let matchCasa = true;
                    if (assignSelectedCasa === 'sin_asignar') {
                      matchCasa = !m.house_group_id;
                    } else if (assignSelectedCasa) {
                      matchCasa = m.house_group_id === assignSelectedCasa;
                    }
                    return matchSearch && matchCasa;
                  });

                  // Sort: sin asignar primero
                  filteredAssignMembers.sort((a, b) => {
                    if (!a.house_group_id && b.house_group_id) return -1;
                    if (a.house_group_id && !b.house_group_id) return 1;
                    return a.full_name.localeCompare(b.full_name);
                  });

                  if (filteredAssignMembers.length === 0) {
                    return (
                      <div style={{ textAlign: 'center', padding: '5rem', color: 'var(--text-muted)' }}>
                        <Users size={48} style={{ margin: '0 auto 1rem', opacity: 0.25, display: 'block' }} />
                        <p>No se encontraron miembros.</p>
                      </div>
                    );
                  }

                  return (
                    <div className="table-wrapper">
                      <table>
                        <thead>
                          <tr>
                            <th>Nombre</th>
                            <th>Miembro</th>
                            <th>Municipio</th>
                            <th>Casa de Dios Actual</th>
                            <th style={{ textAlign: 'center' }}>Asignar / Cambiar</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredAssignMembers.map((member) => {
                            const currentCasa = houseGroups.find(hg => hg.id === member.house_group_id);
                            return (
                              <tr key={member.id}>
                                <td>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                                    <div className="avatar-placeholder" style={{ width: 32, height: 32, fontSize: '0.75rem', flexShrink: 0 }}>
                                      {member.full_name.charAt(0).toUpperCase()}
                                    </div>
                                    <span style={{ fontWeight: 600 }}>{member.full_name}</span>
                                  </div>
                                </td>
                                <td>
                                  <span className={`badge badge-${member.status.toLowerCase()}`}>{member.status}</span>
                                </td>
                                <td className="text-secondary">{member.municipio || '—'}</td>
                                <td>
                                  {currentCasa ? (
                                    <span style={{ color: 'var(--gold-primary)', fontWeight: 600 }}>{currentCasa.name}</span>
                                  ) : (
                                    <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Sin casa asignada</span>
                                  )}
                                </td>
                                <td>
                                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', justifyContent: 'center' }}>
                                    <select
                                      className="form-select"
                                      style={{ width: 'auto', padding: '0.4rem 2rem 0.4rem 0.75rem', fontSize: '0.82rem', minWidth: '160px' }}
                                      value={member.house_group_id || ''}
                                      disabled={assigningMember === member.id}
                                      onChange={async (e) => {
                                        const newCasaId = e.target.value || null;
                                        setAssigningMember(member.id);
                                        try {
                                          const { error } = await supabase
                                            .from('members')
                                            .update({ house_group_id: newCasaId })
                                            .eq('id', member.id);
                                          if (error) throw error;
                                          showToast(newCasaId ? 'Miembro asignado a Casa de Dios.' : 'Miembro desasignado.');
                                          fetchMembers();
                                        } catch (err) {
                                          showToast('Error al asignar miembro.', 'error');
                                        } finally {
                                          setAssigningMember(null);
                                        }
                                      }}
                                    >
                                      <option value="">Sin asignar</option>
                                      {houseGroups.map(hg => (
                                        <option key={hg.id} value={hg.id}>{hg.name}</option>
                                      ))}
                                    </select>
                                    {assigningMember === member.id && (
                                      <Loader2 size={16} style={{ animation: 'spin 1s linear infinite', color: 'var(--gold-primary)' }} />
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                      <p className="text-muted" style={{ fontSize: '0.8rem', marginTop: '0.75rem', textAlign: 'right' }}>
                        Mostrando {filteredAssignMembers.length} de {members.length} miembros
                        {' • '}<strong style={{ color: 'var(--gold-primary)' }}>{members.filter(m => !m.house_group_id).length}</strong> sin casa asignada
                      </p>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        )}

        {/* ── Users Tab (principal & admin) ── */}
        {activeTab === 'users' && (profile.role === 'principal' || profile.role === 'admin') && (
          <div className="animate-fade-in">
            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                marginBottom: '1rem',
              }}
            >
              <button
                onClick={() => {
                  setUserForm(emptyUserForm);
                  setUserError('');
                  setUserModal({ open: true });
                }}
                className="btn btn-primary"
                id="add-user-btn"
              >
                <UserPlus size={16} />
                Nuevo Usuario
              </button>
            </div>

            {loadingProfiles ? (
              <div
                style={{
                  textAlign: 'center',
                  padding: '5rem',
                  color: 'var(--text-muted)',
                }}
              >
                <Loader2
                  size={32}
                  style={{
                    margin: '0 auto 1rem',
                    animation: 'spin 1s linear infinite',
                    display: 'block',
                  }}
                />
                <p>Cargando usuarios...</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {profiles.map((p) => (
                  <div
                    key={p.id}
                    className="card"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '1rem',
                      flexWrap: 'wrap',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.85rem',
                      }}
                    >
                      <div
                        className="avatar-placeholder"
                        style={{ width: 44, height: 44, fontSize: '1rem' }}
                      >
                        {p.full_name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p style={{ fontWeight: 600, marginBottom: '0.1rem' }}>
                          {p.full_name}
                        </p>
                        <p className="text-gold" style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                          @{p.username}
                        </p>
                        {p.phone && (
                          <p
                            className="text-muted"
                            style={{ fontSize: '0.8rem' }}
                          >
                            {p.phone}
                          </p>
                        )}
                        <p
                          className="text-muted"
                          style={{ fontSize: '0.75rem' }}
                          suppressHydrationWarning
                        >
                          Desde {formatearFecha(p.created_at)}
                        </p>
                      </div>
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        flexWrap: 'wrap',
                      }}
                    >
                      <span className={`badge badge-${p.role}`}>
                        {p.role === 'principal' ? (
                          <Crown size={10} style={{ marginRight: 3 }} />
                        ) : p.role === 'admin' ? (
                          <Shield size={10} style={{ marginRight: 3 }} />
                        ) : (
                          <User size={10} style={{ marginRight: 3 }} />
                        )}
                        {ROLE_LABELS[p.role]}
                      </span>

                      {p.id !== profile.id && profile.role === 'principal' && (
                        <select
                          className="form-select"
                          style={{
                            width: 'auto',
                            padding: '0.45rem 2.2rem 0.45rem 0.75rem',
                            fontSize: '0.82rem',
                          }}
                          value={p.role}
                          onChange={(e) =>
                            updateRole(p.id, e.target.value as Role)
                          }
                          aria-label={`Cambiar rol de ${p.full_name}`}
                        >
                          <option value="principal">Principal</option>
                          <option value="admin">Administrador</option>
                          <option value="user">Consolidador</option>
                        </select>
                      )}
                      <button
                        onClick={() => {
                          setUserForm({
                            username: p.username,
                            password: '',
                            full_name: p.full_name,
                            phone: p.phone || '',
                            role: p.role,
                          });
                          setUserError('');
                          setUserModal({ open: true, userId: p.id });
                        }}
                        className="btn btn-secondary btn-icon"
                        title="Editar Usuario"
                      >
                        <Edit2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* ── Member Modal ── */}
      {memberModal.open && (
        <Modal
          title={memberModal.member ? 'Editar Miembro' : 'Agregar Miembro'}
          onClose={() => setMemberModal({ open: false })}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Nombre completo *</label>
              <input
                className="form-input"
                type="text"
                placeholder="Nombre y apellido"
                value={memberForm.full_name}
                onChange={(e) =>
                  setMemberForm((f) => ({ ...f, full_name: e.target.value }))
                }
                autoFocus
              />
            </div>

            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Edad</label>
                <input
                  className="form-input"
                  type="number"
                  placeholder="25"
                  min="1"
                  max="120"
                  value={memberForm.age}
                  onChange={(e) =>
                    setMemberForm((f) => ({ ...f, age: e.target.value }))
                  }
                />
              </div>
              <div className="form-group">
                <label className="form-label">Género</label>
                <select
                  className="form-select"
                  value={memberForm.gender}
                  onChange={(e) =>
                    setMemberForm((f) => ({ ...f, gender: e.target.value }))
                  }
                >
                  <option value="">-- Seleccionar --</option>
                  <option>Masculino</option>
                  <option>Femenino</option>
                </select>
              </div>
            </div>

            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Miembro</label>
                <select
                  className="form-select"
                  value={memberForm.status}
                  onChange={(e) =>
                    setMemberForm((f) => ({
                      ...f,
                      status: e.target.value as Member['status'],
                    }))
                  }
                >
                  <option>Nuevo</option>
                  <option>Reconciliado</option>
                  <option>Visitante</option>
                </select>
              </div>
            </div>



              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Municipio</label>
                <select
                  className="form-select"
                  value={memberForm.municipio}
                  onChange={(e) =>
                    setMemberForm((f) => ({ ...f, municipio: e.target.value }))
                  }
                >
                  <option value="">-- Seleccionar Municipio --</option>
                  {MUNICIPIOS_NUEVA_ESPARTA.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>

            <div className="form-group">
              <label className="form-label">Dirección</label>
              <input
                className="form-input"
                type="text"
                placeholder="Urb. Las Palmas, casa #12..."
                value={memberForm.address}
                onChange={(e) =>
                  setMemberForm((f) => ({ ...f, address: e.target.value }))
                }
              />
            </div>

            <div className="form-group">
              <label className="form-label">Teléfono</label>
              <input
                className="form-input"
                type="tel"
                placeholder="0414-000-0000"
                value={memberForm.phone}
                onChange={(e) =>
                  setMemberForm((f) => ({ ...f, phone: e.target.value }))
                }
              />
            </div>

            {memberError && (
              <p className="form-error">{memberError}</p>
            )}

            <div
              style={{
                display: 'flex',
                gap: '0.75rem',
                justifyContent: 'flex-end',
                marginTop: '0.5rem',
              }}
            >
              <button
                onClick={() => setMemberModal({ open: false })}
                className="btn btn-secondary"
              >
                Cancelar
              </button>
              <button
                onClick={saveMember}
                className="btn btn-primary"
                disabled={savingMember}
                id="save-member-btn"
              >
                {savingMember ? 'Guardando...' : memberModal.member ? 'Guardar cambios' : 'Registrar'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── User Modal ── */}
      {userModal.open && (
        <Modal title={userModal.userId ? "Editar Usuario" : "Crear Nuevo Usuario"} onClose={() => setUserModal({ open: false })}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Nombre completo *</label>
              <input
                className="form-input"
                type="text"
                placeholder="Juan Pérez"
                value={userForm.full_name}
                onChange={(e) =>
                  setUserForm((f) => ({ ...f, full_name: e.target.value }))
                }
                autoFocus
              />
            </div>

            <div className="form-group">
              <label className="form-label">Usuario *</label>
              <input
                className="form-input"
                type="text"
                placeholder="juan_perez"
                value={userForm.username}
                onChange={(e) =>
                  setUserForm((f) => ({ ...f, username: e.target.value.toLowerCase().replace(/\s/g, '_') }))
                }
                autoCapitalize="none"
                spellCheck={false}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Contraseña {userModal.userId ? '(Opcional)' : '*'}</label>
              <input
                className="form-input"
                type="password"
                placeholder={userModal.userId ? "Dejar en blanco para mantener" : "Mínimo 6 caracteres"}
                value={userForm.password}
                onChange={(e) =>
                  setUserForm((f) => ({ ...f, password: e.target.value }))
                }
              />
            </div>

            <div className="form-group">
              <label className="form-label">Teléfono</label>
              <input
                className="form-input"
                type="tel"
                placeholder="0414-000-0000"
                value={userForm.phone}
                onChange={(e) =>
                  setUserForm((f) => ({ ...f, phone: e.target.value }))
                }
              />
            </div>

            <div className="form-group">
              <label className="form-label">Rol</label>
              <select
                className="form-select"
                value={userForm.role}
                onChange={(e) =>
                  setUserForm((f) => ({
                    ...f,
                    role: e.target.value as Role,
                  }))
                }
              >
                <option value="user">Consolidador</option>
                <option value="admin">Administrador</option>
                <option value="principal">Principal</option>
              </select>
            </div>

            {userError && <p className="form-error">{userError}</p>}

            <div
              style={{
                display: 'flex',
                gap: '0.75rem',
                justifyContent: 'flex-end',
                marginTop: '0.5rem',
              }}
            >
              <button
                onClick={() => setUserModal({ open: false })}
                className="btn btn-secondary"
              >
                Cancelar
              </button>
              <button
                onClick={saveUser}
                className="btn btn-primary"
                disabled={savingUser}
                id="save-user-btn"
              >
                {savingUser ? 'Guardando...' : userModal.userId ? 'Guardar cambios' : 'Crear usuario'}
              </button>
            </div>
          </div>
        </Modal>
      )}
      {/* ── Casa Modal ── */}
      {casaModal.open && (
        <Modal title={casaModal.casa ? 'Editar Casa de Dios' : 'Nueva Casa de Dios'} onClose={() => setCasaModal({ open: false })}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Nombre de la Casa *</label>
              <input
                className="form-input"
                type="text"
                placeholder="Ej. Casa Betania"
                value={casaForm.name}
                onChange={(e) => setCasaForm((f) => ({ ...f, name: e.target.value }))}
                autoFocus
              />
            </div>

            <div className="form-group">
              <label className="form-label">Municipio</label>
              <select
                className="form-select"
                value={casaForm.municipio}
                onChange={(e) => setCasaForm((f) => ({ ...f, municipio: e.target.value }))}
              >
                <option value="">-- Seleccionar --</option>
                {MUNICIPIOS_NUEVA_ESPARTA.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Dirección</label>
              <input
                className="form-input"
                type="text"
                placeholder="Urb. El Centro, Calle 2"
                value={casaForm.address}
                onChange={(e) => setCasaForm((f) => ({ ...f, address: e.target.value }))}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Líder Asignado</label>
              <select
                className="form-select"
                value={casaForm.leader_id}
                onChange={(e) => setCasaForm((f) => ({ ...f, leader_id: e.target.value }))}
              >
                <option value="">-- Seleccionar líder --</option>
                {profiles.map(p => (
                  <option key={p.id} value={p.id}>{p.full_name} ({ROLE_LABELS[p.role]})</option>
                ))}
              </select>
            </div>

            {casaError && <p className="form-error">{casaError}</p>}

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
              <button onClick={() => setCasaModal({ open: false })} className="btn btn-secondary">
                Cancelar
              </button>
              <button onClick={saveCasa} className="btn btn-primary" disabled={savingCasa}>
                {savingCasa ? 'Guardando...' : casaModal.casa ? 'Guardar cambios' : 'Crear Casa'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Service Control Modal ── */}
      {serviceModal.open && (
        <Modal title="Control de Servicio" onClose={() => {
          setServiceModal({ open: false });
          setFastNewMemberOpen(false);
        }}>
          {fastNewMemberOpen ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <h3 style={{ fontSize: '1.1rem', marginBottom: '0.5rem', color: 'var(--gold-primary)' }}>Registrar Nuevo Asistente</h3>
              <div className="form-group">
                <label className="form-label">Nombre Completo *</label>
                <input
                  className="form-input"
                  type="text"
                  placeholder="Ej. Juan Pérez"
                  value={fastMemberForm.full_name}
                  onChange={(e) => setFastMemberForm(f => ({ ...f, full_name: e.target.value }))}
                  autoFocus
                />
              </div>
              <div className="form-group">
                <label className="form-label">Teléfono (Opcional)</label>
                <input
                  className="form-input"
                  type="text"
                  placeholder="Ej. 0414-1234567"
                  value={fastMemberForm.phone}
                  onChange={(e) => setFastMemberForm(f => ({ ...f, phone: e.target.value }))}
                />
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                <button onClick={() => setFastNewMemberOpen(false)} className="btn btn-secondary">
                  Atrás
                </button>
                <button onClick={saveFastMember} className="btn btn-primary" disabled={savingFastMember || !fastMemberForm.full_name.trim()}>
                  {savingFastMember ? 'Guardando...' : 'Crear y Añadir'}
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div className="form-group">
                <label className="form-label">Título de la enseñanza *</label>
                <input
                  className="form-input"
                  type="text"
                  placeholder="Ej. El poder de la fe"
                  value={serviceForm.topic}
                  onChange={(e) => setServiceForm(f => ({ ...f, topic: e.target.value }))}
                />
              </div>
              
              <div className="grid-3" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Fecha *</label>
                  <input
                    className="form-input"
                    type="date"
                    value={serviceForm.date}
                    onChange={(e) => setServiceForm(f => ({ ...f, date: e.target.value }))}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Hora Inicio *</label>
                  <input
                    className="form-input"
                    type="time"
                    value={serviceForm.start_time}
                    onChange={(e) => setServiceForm(f => ({ ...f, start_time: e.target.value }))}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Hora Fin *</label>
                  <input
                    className="form-input"
                    type="time"
                    value={serviceForm.end_time}
                    onChange={(e) => setServiceForm(f => ({ ...f, end_time: e.target.value }))}
                  />
                </div>
              </div>

              <div className="divider" style={{ height: '1px', background: 'var(--border-subtle)', margin: '0.5rem 0' }} />
              
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <label className="form-label" style={{ margin: 0 }}>Registro de Asistentes</label>
                  <button 
                    onClick={() => {
                      setFastMemberForm(emptyFastMember);
                      setFastNewMemberOpen(true);
                    }} 
                    className="btn btn-secondary" 
                    style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem' }}
                  >
                    + Nuevo Asistente
                  </button>
                </div>
                
                <div className="form-group">
                  <input
                    className="form-input"
                    type="text"
                    placeholder="Buscar participante..."
                    value={serviceSearch}
                    onChange={(e) => setServiceSearch(e.target.value)}
                  />
                </div>

                <div style={{ 
                  maxHeight: '200px', 
                  overflowY: 'auto', 
                  border: '1px solid var(--border-subtle)', 
                  borderRadius: 'var(--border-radius)',
                  padding: '0.5rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.25rem'
                }}>
                  {(() => {
                    const houseMembers = members.filter(m => m.house_group_id === serviceModal.houseGroupId);
                    const otherMembers = members.filter(m => m.house_group_id !== serviceModal.houseGroupId);
                    
                    let filtered = houseMembers.concat(otherMembers);
                    if (serviceSearch.trim()) {
                      const s = serviceSearch.toLowerCase();
                      filtered = filtered.filter(m => m.full_name.toLowerCase().includes(s));
                    }
                    
                    if (filtered.length === 0) {
                      return <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textAlign: 'center', padding: '1rem' }}>No se encontraron miembros.</p>;
                    }

                    return filtered.map(m => {
                      const isSelected = serviceForm.attendeeIds.includes(m.id);
                      return (
                        <label 
                          key={m.id} 
                          style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '0.75rem', 
                            padding: '0.5rem',
                            borderRadius: '4px',
                            background: isSelected ? 'var(--bg-card-hover)' : 'transparent',
                            cursor: 'pointer'
                          }}
                        >
                          <input 
                            type="checkbox" 
                            checked={isSelected}
                            onChange={(e) => {
                              setServiceForm(prev => {
                                const newIds = e.target.checked 
                                  ? [...prev.attendeeIds, m.id]
                                  : prev.attendeeIds.filter(id => id !== m.id);
                                return { ...prev, attendeeIds: newIds };
                              });
                            }}
                            style={{ width: '1.2rem', height: '1.2rem', accentColor: 'var(--gold-primary)' }}
                          />
                          <span style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>{m.full_name}</span>
                          {m.house_group_id === serviceModal.houseGroupId && (
                            <span style={{ fontSize: '0.7rem', color: 'var(--gold-primary)', background: 'var(--border-gold)', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>Asociado</span>
                          )}
                        </label>
                      );
                    });
                  })()}
                </div>
                <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Total seleccionados: <strong>{serviceForm.attendeeIds.length}</strong>
                </div>
              </div>

              {serviceError && <p className="form-error">{serviceError}</p>}

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                <button onClick={() => setServiceModal({ open: false })} className="btn btn-secondary">
                  Cancelar
                </button>
                <button onClick={saveServiceControl} className="btn btn-primary" disabled={savingService}>
                  {savingService ? 'Guardando...' : 'Guardar Control'}
                </button>
              </div>
            </div>
          )}
        </Modal>
      )}

      {/* ── Service History Modal ── */}
      {historyModal.open && (
        <Modal title={`Historial de Servicios - ${historyModal.houseGroupName || ''}`} onClose={() => setHistoryModal({ open: false })}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: '60vh', overflowY: 'auto' }}>
            {(() => {
              const meetings = houseGroupMeetings.filter(m => m.house_group_id === historyModal.houseGroupId).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
              
              if (meetings.length === 0) {
                return (
                  <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
                    <CalendarDays size={32} style={{ margin: '0 auto 1rem', opacity: 0.3 }} />
                    <p>No se han registrado servicios en esta Casa de Dios.</p>
                  </div>
                );
              }

              return (
                <div className="table-wrapper">
                  <table style={{ minWidth: '400px' }}>
                    <thead>
                      <tr>
                        <th>Fecha</th>
                        <th>Día</th>
                        <th>Tema / Enseñanza</th>
                        <th style={{ textAlign: 'center' }}>Asistentes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {meetings.map(meeting => {
                        const dateObj = new Date(meeting.date + 'T12:00:00Z');
                        const dayName = dateObj.toLocaleDateString('es-ES', { weekday: 'long' });
                        const dateString = dateObj.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
                        const attendeesCount = attendances.filter(a => a.meeting_id === meeting.id).length;
                        
                        return (
                          <tr key={meeting.id}>
                            <td suppressHydrationWarning>{dateString}</td>
                            <td suppressHydrationWarning style={{ textTransform: 'capitalize' }}>{dayName}</td>
                            <td><strong>{meeting.topic || 'Sin título'}</strong></td>
                            <td style={{ textAlign: 'center' }}>
                              <span style={{ 
                                background: 'var(--bg-card-hover)', 
                                padding: '0.2rem 0.6rem', 
                                borderRadius: '12px', 
                                fontSize: '0.85rem',
                                color: 'var(--gold-primary)'
                              }}>
                                {attendeesCount}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              );
            })()}
            
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
              <button onClick={() => setHistoryModal({ open: false })} className="btn btn-secondary">
                Cerrar
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Bottom Navigation (Mobile Only) ── */}
      <nav className="bottom-nav hide-on-desktop">
        {tabs.map((t) => (
          <div
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '0.2rem',
              color: activeTab === t.key ? 'var(--gold-primary)' : 'var(--text-muted)',
              cursor: 'pointer'
            }}
          >
            {t.icon}
            <span style={{ fontSize: '0.65rem', fontWeight: 600 }}>{t.label}</span>
          </div>
        ))}
      </nav>
    </div>
  );
}
