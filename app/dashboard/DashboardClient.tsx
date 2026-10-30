'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { signOut, adminCreateUser, adminUpdateUserRole, adminUpdateUser, adminDeleteUser } from '@/app/actions';
import type { Profile, Member, Role, HouseGroup, Attendance, HouseGroupMeeting, MemberFollowUp, FollowUpType } from '@/lib/types';
import { MUNICIPIOS_NUEVA_ESPARTA } from '@/lib/types';
import { formatearFecha, formatearFechaCorta, getRandomVersiculo, formatearTelefono, getWhatsAppUrl, formatearFechaInteraccion } from '@/lib/utils';
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
  Phone,
  MessageCircle,
  UserCheck,
  Bell,
  Send,
  Copy,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  FileText,
  TrendingUp,
  Clock,
} from 'lucide-react';
import MemberFollowUpSheet from '@/app/components/MemberFollowUpSheet';

/* ─── Types & Constants ─────────────────────────────────── */
interface Props {
  profile: Profile;
}

const STATUS_COLORS: Record<string, string> = {
  Nuevo: 'var(--color-nuevo)',
  Reconciliado: 'var(--color-reconciliado)',
  Visitante: 'var(--color-visitante)',
  Consolidado: '#10b981',
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

const FOLLOW_UP_TYPE_CONFIG: Record<
  FollowUpType,
  { label: string; icon: any; color: string; bg: string }
> = {
  llamada: {
    label: 'Llamada',
    icon: Phone,
    color: '#3b82f6',
    bg: 'rgba(59, 130, 246, 0.15)',
  },
  visita: {
    label: 'Visita',
    icon: Home,
    color: '#10b981',
    bg: 'rgba(16, 185, 129, 0.15)',
  },
  mensaje: {
    label: 'WhatsApp',
    icon: MessageCircle,
    color: '#25D366',
    bg: 'rgba(37, 211, 102, 0.15)',
  },
  otro: {
    label: 'Nota / Otro',
    icon: FileText,
    color: '#8b5cf6',
    bg: 'rgba(139, 92, 246, 0.15)',
  },
};

const ROLE_LABELS: Record<Role, string> = {
  principal: 'Principal',
  admin: 'Administrador',
  user: 'Consolidador',
  pastor: 'Pastor',
};

type ActiveTab = 'home' | 'members' | 'seguimiento' | 'reports' | 'casas' | 'users' | 'equipo';

const TWENTY_MINUTES_MS = 20 * 60 * 1000;

function getUserOnlineStatus(lastSeenAt?: string | null): {
  isOnline: boolean;
  label: string;
  timeFormatted: string;
} {
  if (!lastSeenAt) {
    return {
      isOnline: false,
      label: 'Desconectado',
      timeFormatted: 'Sin registro',
    };
  }

  const lastSeenDate = new Date(lastSeenAt);
  const now = new Date();
  const diffMs = now.getTime() - lastSeenDate.getTime();

  if (isNaN(diffMs)) {
    return {
      isOnline: false,
      label: 'Desconectado',
      timeFormatted: 'Desconocido',
    };
  }

  const isOnline = diffMs >= 0 && diffMs < TWENTY_MINUTES_MS;
  const diffMinutes = Math.max(0, Math.floor(diffMs / (60 * 1000)));
  const diffHours = Math.floor(diffMinutes / 60);

  let timeFormatted = '';
  if (diffMinutes < 1) {
    timeFormatted = 'Ahora mismo';
  } else if (diffMinutes < 60) {
    timeFormatted = `Hace ${diffMinutes} min`;
  } else if (diffHours < 24) {
    timeFormatted = `Hoy a las ${lastSeenDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  } else {
    timeFormatted = `${lastSeenDate.toLocaleDateString([], { day: '2-digit', month: '2-digit' })} ${lastSeenDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  }

  return {
    isOnline,
    label: isOnline ? 'En línea' : 'Desconectado',
    timeFormatted,
  };
}

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
        zIndex: 9999,
        background: 'rgba(0,0,0,0.78)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        animation: 'fade-in 0.2s ease',
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
          borderRadius: '16px',
          border: '1px solid var(--border-gold)',
          boxShadow: '0 25px 60px rgba(0,0,0,0.75)',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '1.5rem',
            paddingBottom: '0.75rem',
            borderBottom: '1px solid var(--border-subtle)',
          }}
        >
          <h2 className="font-cinzel" style={{ fontSize: '1.25rem', margin: 0, color: 'var(--text-gold)' }}>
            {title}
          </h2>
          <button
            onClick={onClose}
            className="btn btn-secondary btn-icon"
            aria-label="Cerrar"
            style={{ width: 34, height: 34, borderRadius: '8px' }}
            title="Cerrar ventana"
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
  const [activeTab, setActiveTab] = useState<ActiveTab>(profile.role === 'pastor' ? 'reports' : 'home');
  const [reportsTab, setReportsTab] = useState<'general' | 'seguimiento'>('general');
  const [casasSubTab, setCasasSubTab] = useState<'gestionar' | 'asignar'>('gestionar');
  const [casasChartType, setCasasChartType] = useState<'bar' | 'line'>('bar');

  /* Follow-ups state for report */
  const [allFollowUps, setAllFollowUps] = useState<MemberFollowUp[]>([]);
  const [loadingFollowUps, setLoadingFollowUps] = useState(false);
  const [reportFollowUpTypeFilter, setReportFollowUpTypeFilter] = useState<string>('all');

  /* Asignar Miembros state */
  const [assignSearch, setAssignSearch] = useState('');
  const [assignSelectedCasa, setAssignSelectedCasa] = useState('');
  const [assigningMember, setAssigningMember] = useState<string | null>(null);

  /* Date Filter */
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'week' | 'month' | 'year'>('all');

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
    consolidator_id: profile.id,
    house_group_id: '',
  };
  const [memberForm, setMemberForm] = useState(emptyMemberForm);
  const [savingMember, setSavingMember] = useState(false);
  const [memberError, setMemberError] = useState('');
  const [assigningConsolidatorId, setAssigningConsolidatorId] = useState<string | null>(null);
  const [assignNotificationModal, setAssignNotificationModal] = useState<{
    open: boolean;
    memberName: string;
    consolidatorName: string;
    consolidatorPhone: string | null;
    memberPhone: string | null;
    memberMunicipio: string | null;
    status: string;
  } | null>(null);

  /* Follow-up / Seguimiento state */
  const [selectedFollowUpMember, setSelectedFollowUpMember] = useState<Member | null>(null);
  const [seguimientoConsolidatorFilter, setSeguimientoConsolidatorFilter] = useState<string>('all');
  const [seguimientoStatusFilter, setSeguimientoStatusFilter] = useState<string>('all');

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
  const [deleteUserConfirm, setDeleteUserConfirm] = useState<string | null>(null);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [showTeamStatus, setShowTeamStatus] = useState(false);

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
    let query = supabase
      .from('members')
      .select('*')
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    // Si es consolidador, solo consultar sus registros propios
    if (profile.role === 'user') {
      query = query.eq('consolidator_id', profile.id);
    }

    const { data } = await query;
    setMembers(data ?? []);
    setLoadingMembers(false);
  }, [supabase, profile.id, profile.role]);

  const fetchProfiles = useCallback(async () => {
    // Si es consolidador, no ver usuarios ni perfiles ajenos
    if (profile.role === 'user') {
      setProfiles([profile]);
      setLoadingProfiles(false);
      return;
    }
    setLoadingProfiles(true);
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .is('deleted_at', null)
      .order('created_at', { ascending: false });
    setProfiles(data ?? []);
    setLoadingProfiles(false);
  }, [supabase, profile]);

  const fetchCasasData = useCallback(async () => {
    // El consolidador no gestiona ni ve Casas de Dios
    if (profile.role === 'user') return;
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
  }, [supabase, profile.role]);

  const fetchAllFollowUps = useCallback(async () => {
    // El consolidador no ve seguimientos generales
    if (profile.role === 'user') return;
    setLoadingFollowUps(true);
    let loadedRecords: MemberFollowUp[] = [];
    try {
      const { data, error } = await supabase
        .from('member_follow_ups')
        .select('*')
        .order('date', { ascending: false });

      if (!error && data && data.length > 0) {
        loadedRecords = data;
      }
    } catch {
      // Ignorar si la tabla no está creada aún o falla la conexión
    }

    // Merge con datos guardados localmente (avivamiento_followups_*)
    if (typeof window !== 'undefined') {
      try {
        const localRecords: MemberFollowUp[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith('avivamiento_followups_')) {
            const raw = localStorage.getItem(key);
            if (raw) {
              const parsed = JSON.parse(raw);
              if (Array.isArray(parsed)) {
                localRecords.push(...parsed);
              }
            }
          }
        }
        if (localRecords.length > 0) {
          const map = new Map<string, MemberFollowUp>();
          loadedRecords.forEach((r) => map.set(r.id, r));
          localRecords.forEach((r) => {
            if (!map.has(r.id)) map.set(r.id, r);
          });
          loadedRecords = Array.from(map.values()).sort(
            (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
          );
        }
      } catch {
        // Ignorar errores de localStorage
      }
    }

    setAllFollowUps(loadedRecords);
    setLoadingFollowUps(false);
  }, [supabase]);

  useEffect(() => {
    fetchMembers();
    fetchCasasData();
    fetchAllFollowUps();
    fetchProfiles();
  }, [fetchMembers, fetchProfiles, fetchCasasData, fetchAllFollowUps]);

  useEffect(() => {
    if (activeTab === 'members' || activeTab === 'seguimiento' || activeTab === 'users' || activeTab === 'casas' || activeTab === 'equipo' || activeTab === 'reports') {
      fetchProfiles();
    }
    if (activeTab === 'home' || activeTab === 'members' || activeTab === 'reports' || activeTab === 'casas') {
      fetchCasasData();
    }
    if (activeTab === 'reports' || activeTab === 'seguimiento') {
      fetchAllFollowUps();
    }
  }, [activeTab, fetchProfiles, fetchCasasData, fetchAllFollowUps]);

  /* ── Registro de actividad del usuario (En línea / Desconectado) ── */
  const lastActivityRecordedRef = useRef<number>(0);

  const recordActivity = useCallback(async (force = false) => {
    const now = Date.now();
    if (!force && now - lastActivityRecordedRef.current < 45000) {
      return;
    }
    lastActivityRecordedRef.current = now;

    try {
      await supabase
        .from('profiles')
        .update({ last_seen_at: new Date().toISOString() })
        .eq('id', profile.id);
    } catch {
      // Silenciar si la columna no existe aún
    }
  }, [profile.id, supabase]);

  useEffect(() => {
    recordActivity(true);

    const handleInteraction = () => {
      recordActivity();
    };

    window.addEventListener('click', handleInteraction, { passive: true });
    window.addEventListener('keydown', handleInteraction, { passive: true });
    window.addEventListener('touchstart', handleInteraction, { passive: true });
    window.addEventListener('scroll', handleInteraction, { passive: true });

    const heartbeat = setInterval(() => {
      if (document.visibilityState === 'visible') {
        recordActivity(true);
      }
    }, 2 * 60 * 1000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        recordActivity(true);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('click', handleInteraction);
      window.removeEventListener('keydown', handleInteraction);
      window.removeEventListener('touchstart', handleInteraction);
      window.removeEventListener('scroll', handleInteraction);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearInterval(heartbeat);
    };
  }, [recordActivity]);

  useEffect(() => {
    recordActivity(true);
  }, [activeTab, recordActivity]);

  useEffect(() => {
    if (profile.role !== 'principal' && profile.role !== 'admin') return;
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchProfiles();
      }
    }, 45000);
    return () => clearInterval(interval);
  }, [profile.role, fetchProfiles]);

  /* ── Derived state ── */
  const filteredMembers = members.filter((m) => {
    // Si el rol es consolidador, NUNCA ver miembros ajenos
    if (profile.role === 'user' && m.consolidator_id !== profile.id) {
      return false;
    }

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
      } else if (dateFilter === 'year') {
        matchDate = created.getFullYear() === now.getFullYear();
      }
    }

    return matchSearch && matchStatus && matchDate;
  });

  const seguimientoMembers: Member[] = useMemo(() => {
    return members.filter((m) => {
      // Si el rol es consolidador, NUNCA ver miembros ajenos
      if (profile.role === 'user' && m.consolidator_id !== profile.id) {
        return false;
      }

      const q = search.toLowerCase();
      const matchSearch =
        m.full_name.toLowerCase().includes(q) ||
        (m.municipio ?? '').toLowerCase().includes(q) ||
        (m.phone ?? '').toLowerCase().includes(q) ||
        (m.consolidator_name || '').toLowerCase().includes(q);

      if (!matchSearch) return false;

      // Filtro por consolidador o asignación
      if (seguimientoConsolidatorFilter === 'mine') {
        if (m.consolidator_id !== profile.id) return false;
      } else if (seguimientoConsolidatorFilter === 'unassigned') {
        if (m.consolidator_id) return false;
      } else if (seguimientoConsolidatorFilter !== 'all') {
        if (m.consolidator_id !== seguimientoConsolidatorFilter) return false;
      }

      // Filtro por estatus
      if (seguimientoStatusFilter !== 'all') {
        if (seguimientoStatusFilter === 'pending') {
          if (m.is_consolidated) return false;
        } else if (seguimientoStatusFilter === 'consolidated') {
          if (!m.is_consolidated) return false;
        } else {
          if (m.status !== seguimientoStatusFilter) return false;
        }
      }

      return true;
    });
  }, [members, search, profile.role, profile.id, seguimientoConsolidatorFilter, seguimientoStatusFilter]);

  const stats = {
    total: members.length,
    nuevo: members.filter((m) => m.status === 'Nuevo').length,
    reconciliado: members.filter((m) => m.status === 'Reconciliado').length,
    visitante: members.filter((m) => m.status === 'Visitante').length,
    consolidado: members.filter((m) => m.status === 'Consolidado' || m.is_consolidated).length,
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
    {
      name: 'Consolidados',
      value: stats.consolidado,
      color: STATUS_COLORS.Consolidado,
    },
  ];

  const municipioChartData = Object.entries(
    filteredMembers.reduce((acc: Record<string, number>, m) => {
      if (m.status === 'Nuevo' || m.status === 'Reconciliado' || m.status === 'Visitante' || m.status === 'Consolidado') {
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

  const filteredMeetings = houseGroupMeetings.filter(meeting => {
    if (dateFilter === 'all') return true;
    const meetingDate = new Date(meeting.date + 'T12:00:00Z');
    const now = new Date();
    if (dateFilter === 'today') {
      return meetingDate.toDateString() === now.toDateString();
    } else if (dateFilter === 'week') {
      const diff = now.getDate() - now.getDay() + (now.getDay() === 0 ? -6 : 1);
      const startOfWeek = new Date(new Date().setDate(diff));
      startOfWeek.setHours(0, 0, 0, 0);
      return meetingDate >= startOfWeek;
    } else if (dateFilter === 'month') {
      return meetingDate.getMonth() === now.getMonth() && meetingDate.getFullYear() === now.getFullYear();
    } else if (dateFilter === 'year') {
      return meetingDate.getFullYear() === now.getFullYear();
    }
    return true;
  });

  filteredMeetings.forEach((meeting) => {
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

  /* ── Seguimiento General Data Calculations ── */
  const filteredFollowUps = useMemo(() => {
    return allFollowUps.filter((item) => {
      if (dateFilter === 'all') return true;
      const itemDate = new Date(item.date);
      const now = new Date();
      if (dateFilter === 'today') {
        return itemDate.toDateString() === now.toDateString();
      } else if (dateFilter === 'week') {
        const diff = now.getDate() - now.getDay() + (now.getDay() === 0 ? -6 : 1);
        const startOfWeek = new Date(new Date().setDate(diff));
        startOfWeek.setHours(0, 0, 0, 0);
        return itemDate >= startOfWeek;
      } else if (dateFilter === 'month') {
        return itemDate.getMonth() === now.getMonth() && itemDate.getFullYear() === now.getFullYear();
      } else if (dateFilter === 'year') {
        return itemDate.getFullYear() === now.getFullYear();
      }
      return true;
    });
  }, [allFollowUps, dateFilter]);

  const followUpMetrics = useMemo(() => {
    const total = filteredFollowUps.length;
    const llamadas = filteredFollowUps.filter((f) => f.type === 'llamada').length;
    const visitas = filteredFollowUps.filter((f) => f.type === 'visita').length;
    const mensajes = filteredFollowUps.filter((f) => f.type === 'mensaje').length;
    const otros = filteredFollowUps.filter((f) => f.type === 'otro').length;

    const contactedMemberIds = new Set(filteredFollowUps.map((f) => f.member_id));
    const totalMembers = members.length;
    const cobertura = totalMembers > 0 ? Math.round((contactedMemberIds.size / totalMembers) * 100) : 0;
    const consolidados = members.filter((m) => m.status === 'Consolidado').length;
    const efectividad = totalMembers > 0 ? Math.round((consolidados / totalMembers) * 100) : 0;

    return {
      total,
      llamadas,
      visitas,
      mensajes,
      otros,
      contactedCount: contactedMemberIds.size,
      totalMembers,
      cobertura,
      consolidados,
      efectividad,
    };
  }, [filteredFollowUps, members]);

  const followUpTypeChartData = useMemo(() => {
    return [
      { name: 'Llamadas Telefónicas', value: followUpMetrics.llamadas, color: '#3b82f6' },
      { name: 'Visitas Presenciales', value: followUpMetrics.visitas, color: '#10b981' },
      { name: 'Mensajes WhatsApp', value: followUpMetrics.mensajes, color: '#25D366' },
      { name: 'Otros / Notas', value: followUpMetrics.otros, color: '#8b5cf6' },
    ];
  }, [followUpMetrics]);

  const consolidatorPerformanceData = useMemo(() => {
    return profiles
      .map((p) => {
        const userFollowUps = filteredFollowUps.filter(
          (f) => f.user_id === p.id || f.user_name?.toLowerCase() === p.full_name?.toLowerCase()
        );
        const llamadas = userFollowUps.filter((f) => f.type === 'llamada').length;
        const visitas = userFollowUps.filter((f) => f.type === 'visita').length;
        const mensajes = userFollowUps.filter((f) => f.type === 'mensaje').length;
        const total = userFollowUps.length;

        const assignedMembers = members.filter((m) => m.consolidator_id === p.id);
        const assignedCount = assignedMembers.length;
        const consolidatedCount = assignedMembers.filter((m) => m.status === 'Consolidado').length;
        const conversionRate = assignedCount > 0 ? Math.round((consolidatedCount / assignedCount) * 100) : 0;

        return {
          id: p.id,
          fullName: p.full_name,
          shortName: p.full_name.split(' ')[0],
          username: p.username,
          role: p.role,
          lastSeenAt: p.last_seen_at,
          llamadas,
          visitas,
          mensajes,
          total,
          assignedCount,
          consolidatedCount,
          conversionRate,
        };
      })
      .sort((a, b) => b.total - a.total || b.assignedCount - a.assignedCount);
  }, [profiles, filteredFollowUps, members]);

  const followUpTimelineData = useMemo(() => {
    const grouped: Record<
      string,
      { date: string; displayDate: string; Llamadas: number; Visitas: number; Mensajes: number; Total: number }
    > = {};

    const sorted = [...filteredFollowUps].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    sorted.forEach((item) => {
      const dateKey = item.date.slice(0, 10);
      if (!grouped[dateKey]) {
        grouped[dateKey] = {
          date: dateKey,
          displayDate: formatearFechaCorta(dateKey),
          Llamadas: 0,
          Visitas: 0,
          Mensajes: 0,
          Total: 0,
        };
      }
      if (item.type === 'llamada') grouped[dateKey].Llamadas += 1;
      else if (item.type === 'visita') grouped[dateKey].Visitas += 1;
      else if (item.type === 'mensaje') grouped[dateKey].Mensajes += 1;
      grouped[dateKey].Total += 1;
    });

    return Object.values(grouped);
  }, [filteredFollowUps]);

  /* ── Member CRUD ── */
  function openAddMember() {
    if (profiles.length === 0) fetchProfiles();
    if (houseGroups.length === 0) fetchCasasData();
    setMemberForm({
      ...emptyMemberForm,
      consolidator_id: profile.id,
      house_group_id: '',
    });
    setMemberError('');
    setMemberModal({ open: true });
  }

  function openEditMember(member: Member) {
    if (profiles.length === 0) fetchProfiles();
    if (houseGroups.length === 0) fetchCasasData();
    setMemberForm({
      full_name: member.full_name,
      age: member.age?.toString() ?? '',
      gender: member.gender ?? '',
      municipio: member.municipio ?? '',
      address: member.address ?? '',
      phone: formatearTelefono(member.phone),
      status: member.status,
      consolidator_id: member.consolidator_id || profile.id,
      house_group_id: member.house_group_id || '',
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

    const chosenConsolidator = profiles.find((p) => p.id === memberForm.consolidator_id) || profile;

    const payload = {
      full_name: memberForm.full_name.trim(),
      age: memberForm.age ? parseInt(memberForm.age) : null,
      gender: memberForm.gender || null,
      municipio: memberForm.municipio || null,
      address: memberForm.address || null,
      phone: memberForm.phone ? formatearTelefono(memberForm.phone) : null,
      status: memberForm.status,
      is_consolidated: memberForm.status === 'Consolidado',
      house_group_id: memberForm.house_group_id || null,
      consolidator_id: chosenConsolidator.id,
      consolidator_name: chosenConsolidator.full_name,
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
        const { error } = await supabase.from('members').insert(payload);
        if (error) throw error;
        showToast(
          chosenConsolidator.id === profile.id
            ? 'Miembro registrado correctamente.'
            : `Miembro registrado y asignado a ${chosenConsolidator.full_name}.`
        );
        if (chosenConsolidator.id !== profile.id) {
          setAssignNotificationModal({
            open: true,
            memberName: payload.full_name,
            consolidatorName: chosenConsolidator.full_name,
            consolidatorPhone: chosenConsolidator.phone,
            memberPhone: payload.phone,
            memberMunicipio: payload.municipio,
            status: payload.status,
          });
        }
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

  async function toggleConsolidado(member: Member) {
    try {
      const isNowConsolidated = member.status !== 'Consolidado' && !member.is_consolidated;
      const newStatus: Member['status'] = isNowConsolidated ? 'Consolidado' : 'Nuevo';
      const { error } = await supabase
        .from('members')
        .update({
          status: newStatus,
          is_consolidated: isNowConsolidated,
        })
        .eq('id', member.id);
      if (error) throw error;
      showToast(isNowConsolidated ? 'Miembro marcado como Consolidado.' : 'Marca de consolidado removida.');
      fetchMembers();
    } catch (err: any) {
      showToast('Error al actualizar estado.', 'error');
    }
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
        const result = await adminUpdateUser(userModal.userId, userForm);
        if (result && 'error' in result) {
          setUserError(result.error);
          return;
        }
        showToast('Usuario actualizado exitosamente.');
      } else {
        const result = await adminCreateUser(userForm);
        if (result && 'error' in result) {
          setUserError(result.error);
          return;
        }
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
      const result = await adminUpdateUserRole(userId, role);
      if (result && 'error' in result) {
        showToast(result.error, 'error');
        return;
      }
      showToast('Rol actualizado.');
      fetchProfiles();
    } catch {
      showToast('Error al actualizar el rol.', 'error');
    }
  }

  async function handleDeleteUser(userId: string) {
    if (profile.role !== 'principal') {
      showToast('Solo el Principal puede eliminar usuarios.', 'error');
      return;
    }
    setDeletingUserId(userId);
    try {
      const result = await adminDeleteUser(userId);
      if (result && 'error' in result) {
        showToast(result.error, 'error');
        return;
      }
      showToast('Usuario eliminado permanentemente.');
      setDeleteUserConfirm(null);
      fetchProfiles();
      fetchMembers();
    } catch (err: any) {
      showToast(err?.message || 'Error al eliminar usuario.', 'error');
    } finally {
      setDeletingUserId(null);
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

  /* ── Tabs config ── */
  const tabs = profile.role === 'pastor' ? [
    { key: 'reports' as ActiveTab, icon: <BarChart2 size={15} />, label: 'Reportes' },
    { key: 'equipo' as ActiveTab, icon: <Users size={15} />, label: 'Equipo' },
  ] : profile.role === 'user' ? [
    { key: 'home' as ActiveTab, icon: <Home size={15} />, label: 'Inicio' },
    { key: 'members' as ActiveTab, icon: <Users size={15} />, label: 'Mis Registros' },
    { key: 'seguimiento' as ActiveTab, icon: <Phone size={15} />, label: 'Seguimiento' },
  ] : [
    { key: 'home' as ActiveTab, icon: <Home size={15} />, label: 'Inicio' },
    { key: 'members' as ActiveTab, icon: <Users size={15} />, label: 'Miembros' },
    { key: 'seguimiento' as ActiveTab, icon: <Phone size={15} />, label: 'Seguimiento' },
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

  /* Guardia para rol user: no permitir pestañas no autorizadas */
  useEffect(() => {
    if (profile.role === 'user' && (activeTab === 'reports' || activeTab === 'casas' || activeTab === 'users' || activeTab === 'equipo')) {
      setActiveTab('home');
    }
  }, [profile.role, activeTab]);

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
              <option value="year">📅 Este Año</option>
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

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
              <h2 className="font-cinzel" style={{ fontSize: '1.2rem', margin: 0 }}>Resumen de Registros</h2>
              <button
                onClick={openAddMember}
                className="btn btn-primary"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', padding: '0.55rem 1rem', fontSize: '0.85rem', fontWeight: 600 }}
              >
                <Plus size={16} />
                <span>Nuevo Miembro</span>
              </button>
            </div>
            <div className="grid-5" style={{ marginBottom: '2rem' }}>
              <StatCard label="Total Miembros" value={stats.total} icon="👥" color="var(--gold-primary)" />
              <StatCard label="Nuevos" value={stats.nuevo} icon="✨" color={STATUS_COLORS.Nuevo} />
              <StatCard label="Reconciliados" value={stats.reconciliado} icon="🕊️" color={STATUS_COLORS.Reconciliado} />
              <StatCard label="Visitantes" value={stats.visitante} icon="🚶" color={STATUS_COLORS.Visitante} />
              <StatCard label="Consolidados" value={stats.consolidado} icon="🛡️" color={STATUS_COLORS.Consolidado} />
            </div>

            {/* Casas de Dios y Asistencia en Vista Principal (solo admin, pastor y principal) */}
            {profile.role !== 'user' && (
              <div style={{ marginTop: '2.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                  <div>
                    <h2 className="font-cinzel" style={{ fontSize: '1.2rem', margin: 0, color: 'var(--text-primary)' }}>
                      Asistencia en Casas de Dios
                    </h2>
                    <p className="text-muted" style={{ fontSize: '0.8rem', marginTop: '0.2rem' }}>
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

                {/* Metricas Rápidas Casas */}
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
                  <StatCard label="Casas de Dios Activas" value={houseGroups.length} icon="🏠" color="var(--gold-primary)" />
                  <StatCard label="Miembros Regulares" value={activeRegularMembers} icon="👥" color="#3498db" />
                </div>

                {/* Attendance Chart - Por Casa y Fecha */}
                <div className="card" style={{ padding: '1.5rem' }}>
                  {houseGroups.length === 0 ? (
                    <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '3.5rem 0' }}>
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
                        No hay registros de actividades o servicios registrados para este período.
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


        {/* ── Members Tab ── */}
        {activeTab === 'members' && (
          <div className="animate-fade-in">
            {/* Buscador optimizado de ancho completo */}
            <div style={{ marginBottom: '1.5rem', width: '100%' }}>
              <div style={{ position: 'relative', width: '100%' }}>
                <Search
                  size={18}
                  style={{
                    position: 'absolute',
                    left: '1.2rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--gold-primary)',
                    pointerEvents: 'none',
                  }}
                />
                <input
                  className="form-input"
                  id="member-search"
                  type="text"
                  placeholder="Búsqueda rápida por nombre, teléfono o municipio..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={{ 
                    padding: '0.8rem 1rem 0.8rem 3rem', 
                    fontSize: '1rem', 
                    width: '100%',
                    borderRadius: '8px',
                    border: '1px solid var(--border-gold)',
                    background: 'var(--bg-secondary)',
                  }}
                />
              </div>
            </div>

            {/* Toolbar secundaria (Filtros y Acción) */}
            <div
              style={{
                display: 'flex',
                gap: '0.75rem',
                marginBottom: '1.5rem',
                flexWrap: 'wrap',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                {['all', 'Nuevo', 'Reconciliado', 'Visitante', 'Consolidado'].map((s) => (
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

              <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
                {(profile.role === 'principal' || profile.role === 'admin') && (
                  <button
                    type="button"
                    onClick={() => setShowTeamStatus((prev) => !prev)}
                    className={`btn ${showTeamStatus ? 'btn-primary' : 'btn-secondary'}`}
                    style={{
                      padding: '0.55rem 0.85rem',
                      fontSize: '0.8rem',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.45rem',
                    }}
                    id="toggle-team-status-btn"
                    title="Ver estado de conexión del equipo"
                  >
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        backgroundColor: profiles.some((p) => getUserOnlineStatus(p.last_seen_at).isOnline)
                          ? '#10b981'
                          : '#6b7280',
                        boxShadow: profiles.some((p) => getUserOnlineStatus(p.last_seen_at).isOnline)
                          ? '0 0 6px #10b981'
                          : 'none',
                        display: 'inline-block',
                      }}
                    />
                    <span>
                      Equipo ({profiles.filter((p) => getUserOnlineStatus(p.last_seen_at).isOnline).length} en línea)
                    </span>
                    {showTeamStatus ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>
                )}

                <button
                  onClick={openAddMember}
                  className="btn btn-primary"
                  id="add-member-btn"
                  style={{ whiteSpace: 'nowrap' }}
                >
                  <Plus size={16} />
                  Nuevo Miembro
                </button>
              </div>
            </div>

            {/* Panel de Estado de Conexión del Equipo (solo admin y principal) */}
            {showTeamStatus && (profile.role === 'principal' || profile.role === 'admin') && (
              <div
                className="card animate-fade-in"
                style={{
                  marginBottom: '1.5rem',
                  padding: '1.25rem',
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-gold)',
                  borderRadius: '12px',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '1rem',
                    flexWrap: 'wrap',
                    gap: '0.5rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <Activity size={18} style={{ color: 'var(--gold-primary)' }} />
                    <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600 }}>
                      Estado de Conexión de Perfiles y Consolidadores
                    </h4>
                    <span
                      className="badge"
                      style={{
                        background: 'rgba(16, 185, 129, 0.15)',
                        color: '#10b981',
                        border: '1px solid rgba(16, 185, 129, 0.3)',
                        fontSize: '0.75rem',
                        padding: '0.15rem 0.55rem',
                      }}
                    >
                      {profiles.filter((p) => getUserOnlineStatus(p.last_seen_at).isOnline).length} de {profiles.length} en línea
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      fetchProfiles();
                      showToast('Estados actualizados');
                    }}
                    className="btn btn-secondary"
                    style={{ fontSize: '0.75rem', padding: '0.35rem 0.65rem' }}
                    title="Actualizar estados ahora"
                  >
                    Actualizar ahora
                  </button>
                </div>

                {profiles.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No hay perfiles disponibles.</p>
                ) : (
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                      gap: '0.75rem',
                    }}
                  >
                    {profiles.map((p) => {
                      const status = getUserOnlineStatus(p.last_seen_at);
                      return (
                        <div
                          key={p.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.75rem',
                            padding: '0.7rem 0.9rem',
                            borderRadius: '8px',
                            background: status.isOnline ? 'rgba(16, 185, 129, 0.05)' : 'var(--bg-card)',
                            border: status.isOnline
                              ? '1px solid rgba(16, 185, 129, 0.3)'
                              : '1px solid var(--border-subtle)',
                          }}
                        >
                          <div style={{ position: 'relative' }}>
                            <div
                              className="avatar-placeholder"
                              style={{ width: 38, height: 38, fontSize: '0.9rem' }}
                            >
                              {p.full_name ? p.full_name.charAt(0).toUpperCase() : '?'}
                            </div>
                            <span
                              style={{
                                position: 'absolute',
                                bottom: -2,
                                right: -2,
                                width: 10,
                                height: 10,
                                borderRadius: '50%',
                                backgroundColor: status.isOnline ? '#10b981' : '#6b7280',
                                border: '2px solid var(--bg-card)',
                                boxShadow: status.isOnline ? '0 0 6px #10b981' : 'none',
                              }}
                              title={status.label}
                            />
                          </div>

                          <div style={{ overflow: 'hidden', flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                              <p
                                style={{
                                  margin: 0,
                                  fontWeight: 600,
                                  fontSize: '0.85rem',
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                }}
                              >
                                {p.full_name}
                              </p>
                              {p.id === profile.id && (
                                <span style={{ fontSize: '0.7rem', color: 'var(--gold-primary)' }}>(Tú)</span>
                              )}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.15rem' }}>
                              <span
                                className={`badge badge-${p.role}`}
                                style={{ fontSize: '0.65rem', padding: '0.1rem 0.4rem' }}
                              >
                                {ROLE_LABELS[p.role]}
                              </span>
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                @{p.username}
                              </span>
                            </div>
                            <p
                              style={{
                                margin: '0.25rem 0 0',
                                fontSize: '0.72rem',
                                color: status.isOnline ? '#10b981' : 'var(--text-muted)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.3rem',
                              }}
                            >
                              <span
                                style={{
                                  width: 6,
                                  height: 6,
                                  borderRadius: '50%',
                                  backgroundColor: status.isOnline ? '#10b981' : '#6b7280',
                                  display: 'inline-block',
                                }}
                              />
                              {status.isOnline ? `En línea (${status.timeFormatted})` : `Desconectado (${status.timeFormatted})`}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

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
                      <th>Estado</th>
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
                          {formatearTelefono(member.phone) || '—'}
                        </td>
                        <td style={{ minWidth: '180px' }}>
                          {profile.role === 'principal' || profile.role === 'admin' ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                              <select
                                className="form-select"
                                style={{
                                  width: '100%',
                                  padding: '0.3rem 1.75rem 0.3rem 0.6rem',
                                  fontSize: '0.8rem',
                                  background: 'var(--bg-secondary)',
                                  borderColor: 'var(--border-subtle)',
                                  borderRadius: '6px',
                                }}
                                value={member.consolidator_id || ''}
                                disabled={assigningConsolidatorId === member.id}
                                onChange={async (e) => {
                                  const targetId = e.target.value;
                                  const chosen = profiles.find((p) => p.id === targetId);
                                  if (!chosen) return;
                                  setAssigningConsolidatorId(member.id);
                                  try {
                                    const { error } = await supabase
                                      .from('members')
                                      .update({
                                        consolidator_id: chosen.id,
                                        consolidator_name: chosen.full_name,
                                      })
                                      .eq('id', member.id);
                                    if (error) throw error;
                                    showToast(`Asignado a ${chosen.full_name}`);
                                    fetchMembers();
                                    if (chosen.id !== profile.id) {
                                      setAssignNotificationModal({
                                        open: true,
                                        memberName: member.full_name,
                                        consolidatorName: chosen.full_name,
                                        consolidatorPhone: chosen.phone,
                                        memberPhone: member.phone,
                                        memberMunicipio: member.municipio,
                                        status: member.status,
                                      });
                                    }
                                  } catch (err: any) {
                                    showToast(err.message || 'Error al reasignar.', 'error');
                                  } finally {
                                    setAssigningConsolidatorId(null);
                                  }
                                }}
                              >
                                {member.consolidator_id && !profiles.some((p) => p.id === member.consolidator_id) && (
                                  <option value={member.consolidator_id}>
                                    {member.consolidator_name || 'Consolidador previo'}
                                  </option>
                                )}
                                {profiles.map((p) => {
                                  const status = getUserOnlineStatus(p.last_seen_at);
                                  return (
                                    <option key={p.id} value={p.id}>
                                      {status.isOnline ? '🟢' : '⚪'} {p.full_name} ({p.role === 'user' ? 'Consolidador' : p.role})
                                    </option>
                                  );
                                })}
                              </select>
                              {member.consolidator_id && member.consolidator_id !== profile.id && (() => {
                                const currentConsolidator = profiles.find((p) => p.id === member.consolidator_id);
                                if (!currentConsolidator?.phone) return null;
                                const msg = `Hola ${currentConsolidator.full_name}, Dios te bendiga 🙏. Te recuerdo el seguimiento asignado para el miembro: ${member.full_name} (Tel: ${formatearTelefono(member.phone) || 'No registrado'}, Municipio: ${member.municipio || 'No especificado'}).`;
                                return (
                                  <a
                                    href={getWhatsAppUrl(currentConsolidator.phone, msg)}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="btn btn-secondary btn-icon"
                                    style={{ width: '28px', height: '28px', color: '#25D366', flexShrink: 0 }}
                                    title="Notificar por WhatsApp a este consolidador"
                                  >
                                    <MessageCircle size={13} />
                                  </a>
                                );
                              })()}
                            </div>
                            {member.consolidator_id && (() => {
                              const currentConsolidator = profiles.find((p) => p.id === member.consolidator_id);
                              if (!currentConsolidator) return null;
                              const status = getUserOnlineStatus(currentConsolidator.last_seen_at);
                              return (
                                <div
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.3rem',
                                    marginTop: '0.2rem',
                                    fontSize: '0.72rem',
                                    color: status.isOnline ? '#10b981' : 'var(--text-muted)',
                                  }}
                                  title={status.label + ' - ' + status.timeFormatted}
                                >
                                  <span
                                    style={{
                                      width: 6,
                                      height: 6,
                                      borderRadius: '50%',
                                      backgroundColor: status.isOnline ? '#10b981' : '#6b7280',
                                      boxShadow: status.isOnline ? '0 0 4px #10b981' : 'none',
                                    }}
                                  />
                                  <span>{status.isOnline ? 'En línea' : status.timeFormatted}</span>
                                </div>
                              );
                            })()}
                            </div>
                          ) : (
                            <span className="text-secondary">{member.consolidator_name}</span>
                          )}
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

                            <button
                              onClick={() => {
                                setSelectedFollowUpMember(member);
                                setActiveTab('seguimiento');
                              }}
                              className="btn btn-secondary btn-icon"
                              title="Ficha de Seguimiento e Histórico"
                              aria-label="Ficha de seguimiento"
                              style={{ color: 'var(--gold-primary)', borderColor: 'var(--border-gold)' }}
                            >
                              <ClipboardList size={13} />
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

        {/* ── Seguimiento Tab ── */}
        {activeTab === 'seguimiento' && (
          selectedFollowUpMember ? (
            <MemberFollowUpSheet
              member={selectedFollowUpMember}
              profile={profile}
              profiles={profiles}
              onBack={() => setSelectedFollowUpMember(null)}
              onMemberUpdated={() => {
                fetchMembers();
                fetchAllFollowUps();
              }}
            />
          ) : (
            <div className="animate-fade-in">
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '1.5rem',
                  flexWrap: 'wrap',
                  gap: '1rem',
                }}
              >
                <div>
                  <h2 className="font-cinzel" style={{ fontSize: '1.3rem', margin: 0, color: 'var(--text-gold)' }}>
                    Gestión y Seguimiento de Miembros
                  </h2>
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                    Registra y consulta el histórico de llamadas, visitas presenciales y mensajes de seguimiento pastoral.
                  </p>
                </div>
              </div>

              {/* Filtros de Seguimiento */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: '1rem',
                  marginBottom: '1.5rem',
                }}
              >
                {/* Buscador optimizado */}
                <div style={{ position: 'relative', width: '100%' }}>
                  <Search
                    size={16}
                    style={{
                      position: 'absolute',
                      left: '1rem',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: 'var(--gold-primary)',
                      pointerEvents: 'none',
                    }}
                  />
                  <input
                    className="form-input"
                    type="text"
                    placeholder="Buscar por nombre, teléfono o municipio..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    style={{
                      padding: '0.7rem 1rem 0.7rem 2.7rem',
                      fontSize: '0.88rem',
                      width: '100%',
                      borderRadius: '8px',
                      border: '1px solid var(--border-gold)',
                      background: 'var(--bg-secondary)',
                    }}
                  />
                </div>

                {/* Filtro por consolidador / asignación (solo admin, pastor y principal) */}
                {profile.role !== 'user' && (
                  <select
                    className="form-select"
                    value={seguimientoConsolidatorFilter}
                    onChange={(e) => setSeguimientoConsolidatorFilter(e.target.value)}
                    style={{
                      padding: '0.7rem 1rem',
                      fontSize: '0.88rem',
                      borderRadius: '8px',
                      border: '1px solid var(--border-subtle)',
                      background: 'var(--bg-secondary)',
                      color: 'var(--text-primary)',
                    }}
                  >
                    <option value="all">Todos los miembros</option>
                    <option value="mine">Mis miembros asignados</option>
                    <option value="unassigned">Sin asignar</option>
                    {profiles.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.full_name} ({p.role === 'user' ? 'Consolidador' : p.role})
                      </option>
                    ))}
                  </select>
                )}

                {/* Filtro por estatus de consolidación */}
                <select
                  className="form-select"
                  value={seguimientoStatusFilter}
                  onChange={(e) => setSeguimientoStatusFilter(e.target.value)}
                  style={{
                    padding: '0.7rem 1rem',
                    fontSize: '0.88rem',
                    borderRadius: '8px',
                    border: '1px solid var(--border-subtle)',
                    background: 'var(--bg-secondary)',
                    color: 'var(--text-primary)',
                  }}
                >
                  <option value="all">Todos los estados</option>
                  <option value="pending">Pendientes de Consolidar</option>
                  <option value="consolidated">Ya Consolidados</option>
                  <option value="Nuevo">Nuevos</option>
                  <option value="Reconciliado">Reconciliados</option>
                  <option value="Visitante">Visitantes</option>
                </select>
              </div>

              <div className="card" style={{ padding: '1.5rem' }}>
                {seguimientoMembers.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                    <Phone size={48} style={{ margin: '0 auto 1rem', opacity: 0.25, display: 'block' }} />
                    <p>No se encontraron miembros con los filtros seleccionados.</p>
                  </div>
                ) : (
                  <div className="table-wrapper">
                    <table>
                      <thead>
                        <tr>
                          <th>Miembro</th>
                          <th>Estado</th>
                          <th>Teléfono</th>
                          <th>Consolidador</th>
                          <th style={{ textAlign: 'center' }}>WhatsApp</th>
                          <th style={{ textAlign: 'center' }}>Estatus Consolidación</th>
                          <th style={{ textAlign: 'center' }}>Histórico / Ficha</th>
                        </tr>
                      </thead>
                      <tbody>
                        {seguimientoMembers.map((member: Member) => (
                          <tr key={member.id}>
                            <td>
                              <div
                                onClick={() => setSelectedFollowUpMember(member)}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.65rem',
                                  cursor: 'pointer',
                                }}
                                title="Click para abrir Ficha de Seguimiento"
                              >
                                <div
                                  className="avatar-placeholder"
                                  style={{
                                    width: 32,
                                    height: 32,
                                    fontSize: '0.75rem',
                                    flexShrink: 0,
                                    border: '1px solid var(--border-gold)',
                                  }}
                                >
                                  {member.full_name.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                  <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                                    {member.full_name}
                                  </span>
                                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                    {member.municipio || 'Nueva Esparta'}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td>
                              <span className={`badge badge-${member.status.toLowerCase()}`}>
                                {member.status}
                              </span>
                            </td>
                            <td className="text-secondary">{formatearTelefono(member.phone) || '—'}</td>
                            <td>
                              <span className="text-secondary" style={{ fontSize: '0.85rem' }}>
                                {member.consolidator_name || 'Sin asignar'}
                              </span>
                            </td>
                            <td>
                              <div style={{ display: 'flex', justifyContent: 'center' }}>
                                {member.phone ? (
                                  <a
                                    href={getWhatsAppUrl(
                                      member.phone,
                                      `Hola ${member.full_name}, Dios te bendiga 🙏. Te escribo de la Iglesia Avivamiento León de la Tribu de Judá.`
                                    )}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="btn btn-primary btn-icon"
                                    style={{ background: '#25D366', borderColor: '#25D366', color: '#fff' }}
                                    title="Enviar WhatsApp"
                                  >
                                    <MessageCircle size={14} />
                                  </a>
                                ) : (
                                  <span className="text-muted" style={{ fontSize: '0.8rem' }}>N/A</span>
                                )}
                              </div>
                            </td>
                            <td>
                              <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem' }}>
                                {member.is_consolidated ? (
                                  <button
                                    onClick={() => toggleConsolidado(member)}
                                    className="btn btn-secondary"
                                    style={{
                                      fontSize: '0.75rem',
                                      padding: '0.3rem 0.6rem',
                                      color: '#10b981',
                                      borderColor: '#10b981',
                                    }}
                                  >
                                    <CheckCircle size={14} style={{ marginRight: '0.3rem' }} />
                                    Consolidado
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => toggleConsolidado(member)}
                                    className="btn btn-secondary"
                                    style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem' }}
                                  >
                                    Marcar Consolidado
                                  </button>
                                )}
                              </div>
                            </td>
                            <td>
                              <div style={{ display: 'flex', justifyContent: 'center' }}>
                                <button
                                  onClick={() => setSelectedFollowUpMember(member)}
                                  className="btn btn-primary"
                                  style={{
                                    fontSize: '0.78rem',
                                    padding: '0.35rem 0.8rem',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.4rem',
                                    borderRadius: '6px',
                                    fontWeight: 600,
                                  }}
                                  title="Ver ficha de seguimiento e historial"
                                >
                                  <ClipboardList size={13} />
                                  Ficha
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )
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
                onClick={() => setReportsTab('seguimiento')}
                className={`btn ${reportsTab === 'seguimiento' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ borderRadius: '20px', padding: '0.4rem 1.2rem' }}
              >
                Seguimiento General
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
                <div className="card" style={{ padding: '1.5rem', overflow: 'hidden' }}>
                  <h3
                    className="font-cinzel"
                    style={{ fontSize: '0.95rem', marginBottom: '1rem' }}
                  >
                    Distribución por Estado
                  </h3>
                  {/* Donut chart sin labels flotantes + leyenda manual debajo */}
                  <div style={{ position: 'relative' }}>
                    <ResponsiveContainer width="100%" height={220}>
                      <PieChart>
                        <Pie
                          data={statusChartData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={95}
                          paddingAngle={4}
                          dataKey="value"
                          isAnimationActive={true}
                        >
                          {statusChartData.map((entry, i) => (
                            <Cell key={i} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            background: '#1a1a2e',
                            border: '1px solid #c9a84c',
                            borderRadius: '8px',
                            color: '#f0e6c8',
                            fontSize: '0.82rem',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                          }}
                          itemStyle={{ color: '#f0e6c8' }}
                          labelStyle={{ color: '#c9a84c', fontWeight: 600 }}
                          formatter={(value: number, name: string) => [value, name]}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  {/* Leyenda manual en grid 2x2 para evitar overflow */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem 1rem', marginTop: '1rem' }}>
                    {statusChartData.map((entry) => (
                      <div key={entry.name} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
                        <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: entry.color, flexShrink: 0, display: 'inline-block' }} />
                        <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {entry.name}: <strong style={{ color: 'var(--text-primary)' }}>{entry.value}</strong>
                        </span>
                      </div>
                    ))}
                  </div>
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
              /* ── RESUMEN DE SEGUIMIENTO GENERAL ── */
              <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                {/* Encabezado descriptivo */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
                  <div>
                    <h2 className="font-cinzel" style={{ fontSize: '1.25rem', margin: 0, color: 'var(--text-gold)' }}>
                      Resumen de Seguimiento Pastoral y Consolidación
                    </h2>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>
                      Métricas ejecutivas de llamadas, visitas presenciales y mensajes de seguimiento registrados por el equipo.
                    </p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--bg-secondary)', padding: '0.4rem 0.9rem', borderRadius: '8px', border: '1px solid var(--border-subtle)', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    <Calendar size={14} style={{ color: 'var(--gold-primary)' }} />
                    <span>Filtro activo: <strong>{dateFilter === 'all' ? 'Histórico Completo' : dateFilter === 'today' ? 'Hoy' : dateFilter === 'week' ? 'Esta Semana' : dateFilter === 'month' ? 'Este Mes' : 'Este Año'}</strong></span>
                  </div>
                </div>

                {/* KPI Metrics Grid (6 tarjetas) */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
                  <StatCard
                    label="Total Interacciones"
                    value={followUpMetrics.total}
                    icon="📋"
                    color="var(--gold-primary)"
                  />
                  <StatCard
                    label="Llamadas"
                    value={followUpMetrics.llamadas}
                    icon="📞"
                    color="#3b82f6"
                  />
                  <StatCard
                    label="Visitas Presenciales"
                    value={followUpMetrics.visitas}
                    icon="🏠"
                    color="#10b981"
                  />
                  <StatCard
                    label="Mensajes WhatsApp"
                    value={followUpMetrics.mensajes}
                    icon="💬"
                    color="#25D366"
                  />
                  <StatCard
                    label="Miembros Atendidos"
                    value={followUpMetrics.contactedCount}
                    icon="👥"
                    color="#06b6d4"
                  />
                  <StatCard
                    label="Consolidados"
                    value={followUpMetrics.consolidados}
                    icon="🛡️"
                    color="#f59e0b"
                  />
                </div>

                {/* Gráficas Principales: Distribución por Canal & Actividad por Consolidador */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.5rem' }}>
                  {/* Gráfica Donut: Distribución de Contactos */}
                  <div className="card" style={{ padding: '1.5rem' }}>
                    <h3 className="font-cinzel" style={{ fontSize: '0.95rem', marginBottom: '0.3rem' }}>
                      Distribución por Tipo de Interacción
                    </h3>
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
                      Canales utilizados para el contacto pastoral
                    </p>

                    {followUpMetrics.total === 0 ? (
                      <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
                        <Phone size={36} style={{ margin: '0 auto 0.75rem', opacity: 0.3, display: 'block' }} />
                        <p style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.3rem' }}>Sin interacciones en este período</p>
                        <p style={{ fontSize: '0.82rem' }}>Registra llamadas o visitas desde la pestaña de Seguimiento.</p>
                      </div>
                    ) : (
                      <>
                        <div style={{ position: 'relative' }}>
                          <ResponsiveContainer width="100%" height={220}>
                            <PieChart>
                              <Pie
                                data={followUpTypeChartData.filter(d => d.value > 0)}
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={95}
                                paddingAngle={4}
                                dataKey="value"
                                isAnimationActive={true}
                              >
                                {followUpTypeChartData.filter(d => d.value > 0).map((entry, i) => (
                                  <Cell key={i} fill={entry.color} />
                                ))}
                              </Pie>
                              <Tooltip
                                contentStyle={{
                                  background: '#1a1a2e',
                                  border: '1px solid #c9a84c',
                                  borderRadius: '8px',
                                  color: '#f0e6c8',
                                  fontSize: '0.82rem',
                                  boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                                }}
                                itemStyle={{ color: '#f0e6c8' }}
                                labelStyle={{ color: '#c9a84c', fontWeight: 600 }}
                                formatter={(value: number, name: string) => [
                                  `${value} (${followUpMetrics.total > 0 ? Math.round((value / followUpMetrics.total) * 100) : 0}%)`,
                                  name
                                ]}
                              />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>

                        {/* Leyenda 2x2 */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem 1rem', marginTop: '1rem' }}>
                          {followUpTypeChartData.map((entry) => {
                            const pct = followUpMetrics.total > 0 ? Math.round((entry.value / followUpMetrics.total) * 100) : 0;
                            return (
                              <div key={entry.name} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
                                <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: entry.color, flexShrink: 0, display: 'inline-block' }} />
                                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {entry.name}: <strong style={{ color: 'var(--text-primary)' }}>{entry.value}</strong> <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>({pct}%)</span>
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </>
                    )}
                  </div>

                  {/* Gráfica de Barras: Rendimiento por Consolidador */}
                  <div className="card" style={{ padding: '1.5rem' }}>
                    <h3 className="font-cinzel" style={{ fontSize: '0.95rem', marginBottom: '0.3rem' }}>
                      Actividad por Consolidador
                    </h3>
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
                      Comparativa de interacciones realizadas por cada líder
                    </p>

                    {consolidatorPerformanceData.filter(c => c.total > 0).length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
                        <Users size={36} style={{ margin: '0 auto 0.75rem', opacity: 0.3, display: 'block' }} />
                        <p style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.3rem' }}>Sin actividad de consolidación</p>
                        <p style={{ fontSize: '0.82rem' }}>Aún no hay llamadas o visitas registradas por el equipo.</p>
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height={260}>
                        <BarChart
                          data={consolidatorPerformanceData.filter(c => c.total > 0).slice(0, 7)}
                          margin={{ top: 10, right: 10, left: -20, bottom: 20 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
                          <XAxis dataKey="shortName" stroke="var(--text-muted)" tick={{ fontSize: 11 }} />
                          <YAxis stroke="var(--text-muted)" tick={{ fontSize: 11 }} allowDecimals={false} />
                          <Tooltip
                            contentStyle={{
                              background: 'var(--bg-card)',
                              border: '1px solid var(--border-gold)',
                              borderRadius: '8px',
                              color: 'var(--text-primary)',
                              fontSize: '0.82rem',
                            }}
                          />
                          <Legend wrapperStyle={{ fontSize: '0.78rem', paddingTop: '0.5rem' }} />
                          <Bar dataKey="Llamadas" stackId="a" fill="#3b82f6" />
                          <Bar dataKey="Visitas" stackId="a" fill="#10b981" />
                          <Bar dataKey="Mensajes" stackId="a" fill="#25D366" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </div>

                {/* Gráfica de Tendencia / Evolución en el Tiempo */}
                {followUpTimelineData.length > 1 && (
                  <div className="card" style={{ padding: '1.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <div>
                        <h3 className="font-cinzel" style={{ fontSize: '0.95rem', margin: 0 }}>
                          Evolución del Seguimiento en el Tiempo
                        </h3>
                        <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                          Volumen diario de interacciones pastorales
                        </p>
                      </div>
                    </div>
                    <ResponsiveContainer width="100%" height={240}>
                      <AreaChart data={followUpTimelineData}>
                        <defs>
                          <linearGradient id="colorFollowUpTotal" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="var(--gold-primary)" stopOpacity={0.7} />
                            <stop offset="95%" stopColor="var(--gold-primary)" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
                        <XAxis dataKey="displayDate" stroke="var(--text-muted)" tick={{ fontSize: 11 }} />
                        <YAxis stroke="var(--text-muted)" tick={{ fontSize: 11 }} allowDecimals={false} />
                        <Tooltip
                          contentStyle={{
                            background: 'var(--bg-card)',
                            border: '1px solid var(--border-gold)',
                            borderRadius: '8px',
                            color: 'var(--text-primary)',
                            fontSize: '0.82rem',
                          }}
                        />
                        <Legend wrapperStyle={{ fontSize: '0.78rem' }} />
                        <Area type="monotone" dataKey="Total" stroke="var(--gold-primary)" fillOpacity={1} fill="url(#colorFollowUpTotal)" strokeWidth={2} />
                        <Area type="monotone" dataKey="Visitas" stroke="#10b981" fillOpacity={0} strokeWidth={2} />
                        <Area type="monotone" dataKey="Llamadas" stroke="#3b82f6" fillOpacity={0} strokeWidth={2} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* Tabla: Rendimiento del Equipo de Consolidación */}
                <div className="card" style={{ padding: '1.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                    <div>
                      <h3 className="font-cinzel" style={{ fontSize: '1rem', margin: 0 }}>
                        Rendimiento del Equipo de Consolidación
                      </h3>
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                        Detalle de miembros asignados, contactos realizados y tasa de consolidación por líder
                      </p>
                    </div>
                  </div>

                  <div className="table-wrapper">
                    <table>
                      <thead>
                        <tr>
                          <th>Consolidador</th>
                          <th style={{ textAlign: 'center' }}>Asignados</th>
                          <th style={{ textAlign: 'center' }}>📞 Llamadas</th>
                          <th style={{ textAlign: 'center' }}>🏠 Visitas</th>
                          <th style={{ textAlign: 'center' }}>💬 Mensajes</th>
                          <th style={{ textAlign: 'center' }}>Total Acciones</th>
                          <th style={{ textAlign: 'center' }}>Consolidados</th>
                          <th style={{ textAlign: 'center' }}>Efectividad</th>
                        </tr>
                      </thead>
                      <tbody>
                        {consolidatorPerformanceData.map((item) => {
                          const onlineStatus = getUserOnlineStatus(item.lastSeenAt);
                          return (
                            <tr key={item.id}>
                              <td>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                                  <div
                                    className="avatar-placeholder"
                                    style={{
                                      width: 32,
                                      height: 32,
                                      fontSize: '0.75rem',
                                      flexShrink: 0,
                                    }}
                                  >
                                    {item.fullName.charAt(0).toUpperCase()}
                                  </div>
                                  <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                      <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.88rem' }}>
                                        {item.fullName}
                                      </span>
                                      {item.id === profile.id && (
                                        <span style={{ fontSize: '0.7rem', color: 'var(--gold-primary)' }}>(Tú)</span>
                                      )}
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.1rem' }}>
                                      <span className={`badge badge-${item.role}`} style={{ fontSize: '0.62rem', padding: '0.05rem 0.35rem' }}>
                                        {ROLE_LABELS[item.role]}
                                      </span>
                                      <span style={{ fontSize: '0.7rem', color: onlineStatus.isOnline ? '#10b981' : 'var(--text-muted)' }}>
                                        {onlineStatus.isOnline ? '● En línea' : '○ Desconectado'}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </td>
                              <td style={{ textAlign: 'center', fontWeight: 600 }}>
                                {item.assignedCount}
                              </td>
                              <td style={{ textAlign: 'center', color: '#3b82f6', fontWeight: 600 }}>
                                {item.llamadas}
                              </td>
                              <td style={{ textAlign: 'center', color: '#10b981', fontWeight: 600 }}>
                                {item.visitas}
                              </td>
                              <td style={{ textAlign: 'center', color: '#25D366', fontWeight: 600 }}>
                                {item.mensajes}
                              </td>
                              <td style={{ textAlign: 'center' }}>
                                <span style={{
                                  background: item.total > 0 ? 'rgba(201, 168, 76, 0.15)' : 'var(--bg-secondary)',
                                  color: item.total > 0 ? 'var(--gold-primary)' : 'var(--text-muted)',
                                  padding: '0.2rem 0.6rem',
                                  borderRadius: '12px',
                                  fontWeight: 700,
                                  fontSize: '0.82rem',
                                  border: item.total > 0 ? '1px solid var(--border-gold)' : '1px solid var(--border-subtle)',
                                }}>
                                  {item.total}
                                </span>
                              </td>
                              <td style={{ textAlign: 'center', fontWeight: 600, color: '#f59e0b' }}>
                                {item.consolidatedCount}
                              </td>
                              <td style={{ textAlign: 'center' }}>
                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                                  <span style={{
                                    fontSize: '0.8rem',
                                    fontWeight: 700,
                                    color: item.conversionRate >= 50 ? '#10b981' : item.conversionRate > 0 ? 'var(--gold-primary)' : 'var(--text-muted)',
                                  }}>
                                    {item.conversionRate}%
                                  </span>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Tabla: Bitácora de Últimas Interacciones de Seguimiento */}
                <div className="card" style={{ padding: '1.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                    <div>
                      <h3 className="font-cinzel" style={{ fontSize: '1rem', margin: 0 }}>
                        Registro Reciente de Interacciones
                      </h3>
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                        Histórico auditado de contactos realizados a miembros de la iglesia
                      </p>
                    </div>

                    {/* Filtros rápidos de tipo */}
                    <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                      <button
                        onClick={() => setReportFollowUpTypeFilter('all')}
                        className={`btn ${reportFollowUpTypeFilter === 'all' ? 'btn-primary' : 'btn-secondary'}`}
                        style={{ padding: '0.25rem 0.7rem', fontSize: '0.75rem', borderRadius: '15px' }}
                      >
                        Todos
                      </button>
                      <button
                        onClick={() => setReportFollowUpTypeFilter('llamada')}
                        className={`btn ${reportFollowUpTypeFilter === 'llamada' ? 'btn-primary' : 'btn-secondary'}`}
                        style={{ padding: '0.25rem 0.7rem', fontSize: '0.75rem', borderRadius: '15px' }}
                      >
                        📞 Llamadas
                      </button>
                      <button
                        onClick={() => setReportFollowUpTypeFilter('visita')}
                        className={`btn ${reportFollowUpTypeFilter === 'visita' ? 'btn-primary' : 'btn-secondary'}`}
                        style={{ padding: '0.25rem 0.7rem', fontSize: '0.75rem', borderRadius: '15px' }}
                      >
                        🏠 Visitas
                      </button>
                      <button
                        onClick={() => setReportFollowUpTypeFilter('mensaje')}
                        className={`btn ${reportFollowUpTypeFilter === 'mensaje' ? 'btn-primary' : 'btn-secondary'}`}
                        style={{ padding: '0.25rem 0.7rem', fontSize: '0.75rem', borderRadius: '15px' }}
                      >
                        💬 WhatsApp
                      </button>
                    </div>
                  </div>

                  {filteredFollowUps.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '3.5rem 1rem', color: 'var(--text-muted)' }}>
                      <Phone size={36} style={{ margin: '0 auto 0.75rem', opacity: 0.3, display: 'block' }} />
                      <p style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.3rem' }}>
                        No hay interacciones registradas para este período
                      </p>
                      <p style={{ fontSize: '0.82rem' }}>
                        Las llamadas, visitas y mensajes registrados en Seguimiento se reflejarán aquí.
                      </p>
                    </div>
                  ) : (
                    <div className="table-wrapper">
                      <table>
                        <thead>
                          <tr>
                            <th>Fecha</th>
                            <th>Miembro</th>
                            <th>Consolidador</th>
                            <th>Tipo</th>
                            <th>Detalle / Resultado</th>
                            <th style={{ textAlign: 'center' }}>Acción</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredFollowUps
                            .filter(f => reportFollowUpTypeFilter === 'all' || f.type === reportFollowUpTypeFilter)
                            .slice(0, 15)
                            .map((item) => {
                              const targetMember = members.find(m => m.id === item.member_id);
                              const typeCfg = FOLLOW_UP_TYPE_CONFIG[item.type] || FOLLOW_UP_TYPE_CONFIG.otro;
                              const IconComponent = typeCfg.icon;

                              return (
                                <tr key={item.id}>
                                  <td style={{ fontSize: '0.8rem', whiteSpace: 'nowrap', color: 'var(--text-muted)' }}>
                                    {formatearFechaInteraccion(item.date)}
                                  </td>
                                  <td>
                                    {targetMember ? (
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <div
                                          className="avatar-placeholder"
                                          style={{ width: 28, height: 28, fontSize: '0.7rem', flexShrink: 0 }}
                                        >
                                          {targetMember.full_name.charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                          <p style={{ margin: 0, fontWeight: 600, fontSize: '0.85rem' }}>
                                            {targetMember.full_name}
                                          </p>
                                          <span className={`badge badge-${targetMember.status.toLowerCase()}`} style={{ fontSize: '0.6rem' }}>
                                            {targetMember.status}
                                          </span>
                                        </div>
                                      </div>
                                    ) : (
                                      <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Miembro registrado</span>
                                    )}
                                  </td>
                                  <td style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                    {item.user_name || 'Consolidador'}
                                  </td>
                                  <td>
                                    <span
                                      style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '0.35rem',
                                        padding: '0.2rem 0.6rem',
                                        borderRadius: '12px',
                                        fontSize: '0.75rem',
                                        fontWeight: 600,
                                        backgroundColor: typeCfg.bg,
                                        color: typeCfg.color,
                                        border: `1px solid ${typeCfg.color}40`,
                                      }}
                                    >
                                      <IconComponent size={12} />
                                      {typeCfg.label}
                                    </span>
                                  </td>
                                  <td style={{ maxWidth: '320px' }}>
                                    {item.result_status && (
                                      <p style={{ margin: '0 0 0.2rem', fontWeight: 600, fontSize: '0.8rem', color: 'var(--text-primary)' }}>
                                        {item.result_status}
                                      </p>
                                    )}
                                    <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                      {item.detail || 'Sin notas adicionales.'}
                                    </p>
                                  </td>
                                  <td style={{ textAlign: 'center' }}>
                                    {targetMember && (
                                      <button
                                        onClick={() => {
                                          setSelectedFollowUpMember(targetMember);
                                          setActiveTab('seguimiento');
                                        }}
                                        className="btn btn-secondary btn-icon"
                                        title="Ver historial completo del miembro"
                                        aria-label="Ver historial"
                                        style={{ color: 'var(--gold-primary)', borderColor: 'var(--border-gold)', width: 30, height: 30 }}
                                      >
                                        <ClipboardList size={13} />
                                      </button>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                        </tbody>
                      </table>
                    </div>
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
                            {formatearTelefono(p.phone)}
                          </p>
                        )}
                        <p
                          className="text-muted"
                          style={{ fontSize: '0.75rem' }}
                          suppressHydrationWarning
                        >
                          Desde {formatearFecha(p.created_at)}
                        </p>
                        {(() => {
                          const status = getUserOnlineStatus(p.last_seen_at);
                          return (
                            <p
                              style={{
                                margin: '0.2rem 0 0',
                                fontSize: '0.73rem',
                                color: status.isOnline ? '#10b981' : 'var(--text-muted)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.3rem',
                              }}
                            >
                              <span
                                style={{
                                  width: 6,
                                  height: 6,
                                  borderRadius: '50%',
                                  backgroundColor: status.isOnline ? '#10b981' : '#6b7280',
                                  boxShadow: status.isOnline ? '0 0 5px #10b981' : 'none',
                                  display: 'inline-block',
                                }}
                              />
                              {status.isOnline ? `En línea (${status.timeFormatted})` : `Desconectado (${status.timeFormatted})`}
                            </p>
                          );
                        })()}
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
                          <option value="pastor">Pastor</option>
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

                      {profile.role === 'principal' && p.id !== profile.id && (
                        deleteUserConfirm === p.id ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                            <button
                              onClick={() => handleDeleteUser(p.id)}
                              className="btn btn-danger btn-icon"
                              title="Confirmar eliminación permanente"
                              disabled={deletingUserId === p.id}
                            >
                              {deletingUserId === p.id ? (
                                <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />
                              ) : (
                                <Check size={13} />
                              )}
                            </button>
                            <button
                              onClick={() => setDeleteUserConfirm(null)}
                              className="btn btn-secondary btn-icon"
                              title="Cancelar"
                              disabled={deletingUserId === p.id}
                            >
                              <X size={13} />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setDeleteUserConfirm(p.id)}
                            className="btn btn-secondary btn-icon"
                            style={{ color: 'var(--red-primary)' }}
                            title="Eliminar Usuario (solo Principal)"
                          >
                            <Trash2 size={13} />
                          </button>
                        )
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        {/* ── Equipo Tab (pastor) ── */}
        {activeTab === 'equipo' && profile.role === 'pastor' && (
          <div className="animate-fade-in">
            <h2 className="font-cinzel" style={{ fontSize: '1.2rem', marginBottom: '1.5rem' }}>
              Equipo de Trabajo
            </h2>
            <div style={{ display: 'grid', gap: '2rem', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
              
              {/* Lista de Consolidadores */}
              <div className="card" style={{ padding: '1.5rem' }}>
                <h3 className="font-cinzel" style={{ fontSize: '1rem', marginBottom: '1rem', color: 'var(--gold-primary)' }}>
                  Lista de Consolidadores
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {profiles.filter(p => p.role === 'user').map(p => (
                    <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
                      <div className="avatar-placeholder" style={{ width: 32, height: 32 }}>
                        {p.full_name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p style={{ fontWeight: 600, fontSize: '0.9rem' }}>{p.full_name}</p>
                        <p className="text-muted" style={{ fontSize: '0.75rem' }}>{formatearTelefono(p.phone) || 'Sin teléfono'}</p>
                      </div>
                    </div>
                  ))}
                  {profiles.filter(p => p.role === 'user').length === 0 && (
                    <p className="text-muted" style={{ fontSize: '0.85rem' }}>No hay consolidadores registrados.</p>
                  )}
                </div>
              </div>

              {/* Lista de Líderes */}
              <div className="card" style={{ padding: '1.5rem' }}>
                <h3 className="font-cinzel" style={{ fontSize: '1rem', marginBottom: '1rem', color: 'var(--gold-primary)' }}>
                  Lista de Líderes
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {houseGroups.map(hg => {
                    const leader = profiles.find(p => p.id === hg.leader_id);
                    return (
                      <div key={hg.id} style={{ display: 'flex', flexDirection: 'column', padding: '0.75rem', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
                        <p style={{ fontWeight: 600, fontSize: '0.9rem' }}>{leader ? leader.full_name : 'Sin líder asignado'}</p>
                        <p className="text-muted" style={{ fontSize: '0.75rem' }}>{hg.name} • {hg.municipio || 'Sin municipio'}</p>
                      </div>
                    );
                  })}
                  {houseGroups.length === 0 && (
                    <p className="text-muted" style={{ fontSize: '0.85rem' }}>No hay Casas de Dios registradas.</p>
                  )}
                </div>
              </div>

            </div>
          </div>
        )}
      </main>

      {/* ── Member Modal ── */}
      {memberModal.open && (
        <Modal
          title={memberModal.member ? 'Editar Miembro' : 'Nuevo Miembro'}
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

            <div className="form-group" style={{ marginBottom: '1rem' }}>
              <label className="form-label" style={{ marginBottom: '0.5rem', display: 'block' }}>
                Estado / Condición del Miembro *
              </label>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0 0 0.5rem' }}>
                {memberForm.status === 'Nuevo' && '✨ Nuevo creyente o asistente'}
                {memberForm.status === 'Reconciliado' && '🕊️ Persona reconciliada con el Señor'}
                {memberForm.status === 'Visitante' && '🚶 Visitante a consolidar'}
                {memberForm.status === 'Consolidado' && '🛡️ Miembro activo consolidado'}
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.4rem' }}>
                {[
                  { key: 'Nuevo', label: 'Nuevo', icon: '✨' },
                  { key: 'Reconciliado', label: 'Reconciliado', icon: '🕊️' },
                  { key: 'Visitante', label: 'Visitante', icon: '🚶' },
                  { key: 'Consolidado', label: 'Consolidado', icon: '🛡️' },
                ].map((st) => {
                  const isSel = memberForm.status === st.key;
                  return (
                    <button
                      key={st.key}
                      type="button"
                      onClick={() => setMemberForm((f) => ({ ...f, status: st.key as Member['status'] }))}
                      className={`btn ${isSel ? 'btn-primary' : 'btn-secondary'}`}
                      style={{
                        padding: '0.55rem 0.5rem',
                        fontSize: '0.82rem',
                        fontWeight: isSel ? 600 : 400,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.35rem',
                        borderColor: isSel ? 'var(--gold-primary)' : undefined,
                        boxShadow: isSel ? '0 0 8px rgba(201, 168, 76, 0.3)' : 'none',
                        width: '100%',
                      }}
                    >
                      <span>{st.icon}</span>
                      <span>{st.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid-2">
              <div className="form-group">
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
            </div>

            <div className="grid-2">
              <div className="form-group">
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <UserCheck size={14} style={{ color: 'var(--gold-primary)' }} />
                  Consolidador Asignado *
                </label>
                <select
                  className="form-select"
                  value={memberForm.consolidator_id}
                  onChange={(e) =>
                    setMemberForm((f) => ({ ...f, consolidator_id: e.target.value }))
                  }
                >
                  <option value={profile.id}>Yo mismo ({profile.full_name})</option>
                  {profiles
                    .filter((p) => p.id !== profile.id)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.full_name} ({p.role === 'user' ? 'Consolidador' : p.role})
                      </option>
                    ))}
                </select>
                <span className="text-muted" style={{ fontSize: '0.72rem', marginTop: '0.25rem', display: 'block' }}>
                  El visitante se cargará en la vista del consolidador.
                </span>
              </div>

              <div className="form-group">
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Flame size={14} style={{ color: 'var(--gold-primary)' }} />
                  Casa de Dios
                </label>
                <select
                  className="form-select"
                  value={memberForm.house_group_id}
                  onChange={(e) =>
                    setMemberForm((f) => ({ ...f, house_group_id: e.target.value }))
                  }
                >
                  <option value="">-- Sin Casa de Dios --</option>
                  {houseGroups.map((hg) => (
                    <option key={hg.id} value={hg.id}>
                      {hg.name} {hg.municipio ? `(${hg.municipio})` : ''}
                    </option>
                  ))}
                </select>
                <span className="text-muted" style={{ fontSize: '0.72rem', marginTop: '0.25rem', display: 'block' }}>
                  Opcional: vincular a Casa de Dios.
                </span>
              </div>
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
                onBlur={() =>
                  setMemberForm((f) => ({ ...f, phone: formatearTelefono(f.phone) }))
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
                onBlur={() =>
                  setUserForm((f) => ({ ...f, phone: formatearTelefono(f.phone) }))
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
                <option value="pastor">Pastor (Solo lectura)</option>
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

      {/* ── Modal de Notificación de Asignación a Consolidador ── */}
      {assignNotificationModal?.open && (
        <Modal
          title="Miembro Asignado a Consolidador"
          onClose={() => setAssignNotificationModal(null)}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{
              background: 'linear-gradient(135deg, rgba(212, 175, 55, 0.15), rgba(0, 0, 0, 0.35))',
              border: '1px solid var(--border-gold)',
              borderRadius: '12px',
              padding: '1.25rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.4rem'
            }}>
              <p style={{ margin: 0, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                Se ha asignado a <strong style={{ color: 'var(--gold-primary)' }}>{assignNotificationModal.memberName}</strong> al consolidador <strong style={{ color: 'var(--text-primary)' }}>{assignNotificationModal.consolidatorName}</strong>.
              </p>
              <p className="text-secondary" style={{ fontSize: '0.82rem', margin: 0 }}>
                El miembro ya está cargado en la vista personal del consolidador para su seguimiento y llamada.
              </p>
            </div>

            {(() => {
              const formattedMemberPhone = formatearTelefono(assignNotificationModal.memberPhone);
              const whatsappText = `Hola ${assignNotificationModal.consolidatorName}, Dios te bendiga 🙏. Te escribo de la Iglesia Avivamiento León de la Tribu de Judá.\n\nSe te ha asignado un nuevo miembro para consolidación y seguimiento:\n\n👤 *Nombre:* ${assignNotificationModal.memberName}\n📞 *Teléfono:* ${formattedMemberPhone || 'No registrado'}\n📍 *Municipio:* ${assignNotificationModal.memberMunicipio || 'No especificado'}\n🏷 *Estatus:* ${assignNotificationModal.status}\n\nPor favor comunícate con él/ella para darle la bienvenida y acompañarle en su proceso de fe. ¡Muchas bendiciones!`;
              const whatsappUrl = getWhatsAppUrl(assignNotificationModal.consolidatorPhone, whatsappText);

              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div>
                    <label className="form-label" style={{ fontSize: '0.8rem', marginBottom: '0.35rem' }}>
                      Mensaje de Notificación sugerido:
                    </label>
                    <div style={{
                      background: 'var(--bg-secondary)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: '8px',
                      padding: '0.75rem 1rem',
                      fontSize: '0.82rem',
                      color: 'var(--text-secondary)',
                      whiteSpace: 'pre-line',
                      maxHeight: '150px',
                      overflowY: 'auto'
                    }}>
                      {whatsappText}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', flexWrap: 'wrap', alignItems: 'center' }}>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(whatsappText);
                        showToast('Mensaje copiado al portapapeles.');
                      }}
                      className="btn btn-secondary"
                      style={{ fontSize: '0.82rem', gap: '0.35rem' }}
                    >
                      <Copy size={14} />
                      Copiar Mensaje
                    </button>

                    {whatsappUrl ? (
                      <a
                        href={whatsappUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="btn btn-primary"
                        style={{
                          background: '#25D366',
                          borderColor: '#25D366',
                          color: '#fff',
                          fontSize: '0.82rem',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.4rem',
                          textDecoration: 'none'
                        }}
                        onClick={() => setAssignNotificationModal(null)}
                      >
                        <MessageCircle size={15} />
                        Enviar WhatsApp al Consolidador
                      </a>
                    ) : (
                      <span className="text-muted" style={{ fontSize: '0.75rem' }}>
                        (El consolidador no tiene teléfono guardado)
                      </span>
                    )}

                    <button
                      onClick={() => setAssignNotificationModal(null)}
                      className="btn btn-secondary"
                      style={{ fontSize: '0.82rem' }}
                    >
                      Listo
                    </button>
                  </div>
                </div>
              );
            })()}
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
