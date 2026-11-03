'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Member, Profile, ChurchService, ServiceAttendance } from '@/lib/types';
import { formatearFechaServicio, formatearFechaCorta, getWhatsAppUrl, formatearTelefono } from '@/lib/utils';
import {
  Calendar,
  CalendarCheck,
  Users,
  Search,
  Filter,
  Plus,
  Trash2,
  Edit2,
  ArrowLeft,
  Check,
  X,
  UserCheck,
  AlertCircle,
  Copy,
  Download,
  BarChart2,
  CheckSquare,
  Square,
  Phone,
  MessageCircle,
  Clock,
  Sparkles,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';

interface Props {
  profile: Profile;
  supabase: SupabaseClient;
  showToast: (msg: string, type?: 'success' | 'error') => void;
  onNavigateToMembers?: () => void;
}

interface ServiceWithCount extends ChurchService {
  attendees_count: number;
}

interface AttendeeItem {
  attendance_id: string;
  member_id: string;
  member: Member;
  created_at: string;
}

const COMMON_SERVICES = [
  'Servicio Dominical',
  'Servicio de Oración',
  'Servicio de Jóvenes',
  'Servicio de Damas',
  'Servicio de Caballeros',
  'Culto de Adoración',
  'Vigilia de Poder',
  'Servicio Especial',
];

const LOCAL_STORAGE_KEY_SERVICES = 'avivamiento_local_services';
const LOCAL_STORAGE_KEY_ATTENDANCES = 'avivamiento_local_service_attendances';

export default function ServiceAttendanceModule({ profile, supabase, showToast, onNavigateToMembers }: Props) {
  /* ── Mode / View ── */
  const [view, setView] = useState<'report' | 'register'>('report');

  /* ── Services data ── */
  const [services, setServices] = useState<ServiceWithCount[]>([]);
  const [loadingServices, setLoadingServices] = useState(true);
  const [dbTableMissing, setDbTableMissing] = useState(false);

  /* ── Members data (ALL members: active, inactive, consolidated, visitors, etc.) ── */
  const [allMembers, setAllMembers] = useState<Member[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);

  /* ── Register / Edit Form State ── */
  const [serviceDate, setServiceDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [serviceName, setServiceName] = useState('Servicio Dominical');
  const [customServiceName, setCustomServiceName] = useState('');
  const [isCustomName, setIsCustomName] = useState(false);
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);

  /* ── Attendance Selection State ── */
  const [selectedMemberIds, setSelectedMemberIds] = useState<Set<string>>(new Set());
  const [originalMemberIds, setOriginalMemberIds] = useState<Set<string>>(new Set());
  const [savingAttendance, setSavingAttendance] = useState(false);

  /* ── Search & Filter for Members ── */
  const [memberSearch, setMemberSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'Nuevo' | 'Reconciliado' | 'Visitante' | 'Consolidado'>('all');
  const [activeFilter, setActiveFilter] = useState<'all' | 'active_only' | 'inactive_only'>('all');
  const [selectionFilter, setSelectionFilter] = useState<'all' | 'selected' | 'unselected'>('all');

  /* ── Report Filter & Search ── */
  const [reportSearch, setReportSearch] = useState('');
  const [reportDateFilter, setReportDateFilter] = useState<'all' | 'month' | 'year'>('all');

  /* ── Modal: View Service Attendees ── */
  const [viewingService, setViewingService] = useState<ServiceWithCount | null>(null);
  const [serviceAttendees, setServiceAttendees] = useState<AttendeeItem[]>([]);
  const [loadingAttendees, setLoadingAttendees] = useState(false);
  const [attendeeSearch, setAttendeeSearch] = useState('');

  /* ── Modal: Delete Confirmation ── */
  const [serviceToDelete, setServiceToDelete] = useState<ServiceWithCount | null>(null);
  const [deletingService, setDeletingService] = useState(false);

  /* ── Modal: SQL helper ── */
  const [showSqlModal, setShowSqlModal] = useState(false);

  /* ── Effective service name ── */
  const effectiveServiceName = useMemo(() => {
    if (isCustomName) return customServiceName.trim() || 'Servicio General';
    return serviceName;
  }, [isCustomName, customServiceName, serviceName]);

  /* ── 1. Fetch All Members (Active AND Inactive, ALL statuses) ── */
  const fetchMembersList = useCallback(async () => {
    setLoadingMembers(true);
    try {
      // Nota: NO filtramos por deleted_at para incluir inactivos y dados de baja
      const { data, error } = await supabase
        .from('members')
        .select('*')
        .order('full_name', { ascending: true });

      if (error) {
        console.warn('Error fetching all members from Supabase, retrying without filter:', error);
      }
      setAllMembers(data ?? []);
    } catch (err) {
      console.error('Error fetching members:', err);
    } finally {
      setLoadingMembers(false);
    }
  }, [supabase]);

  /* ── 2. Fetch Services & Attendance counts ── */
  const fetchServicesList = useCallback(async () => {
    setLoadingServices(true);
    let supabaseSuccess = false;

    try {
      // Consultar servicios
      const { data: servicesData, error: sError } = await supabase
        .from('church_services')
        .select('*')
        .order('date', { ascending: false });

      if (!sError && servicesData) {
        supabaseSuccess = true;
        setDbTableMissing(false);

        // Consultar conteos de asistencia
        const { data: attendancesData, error: aError } = await supabase
          .from('service_attendances')
          .select('service_id');

        const countsMap: Record<string, number> = {};
        if (!aError && attendancesData) {
          attendancesData.forEach((att: { service_id: string }) => {
            countsMap[att.service_id] = (countsMap[att.service_id] || 0) + 1;
          });
        }

        const merged: ServiceWithCount[] = servicesData.map((s) => ({
          ...s,
          attendees_count: countsMap[s.id] || 0,
        }));

        setServices(merged);
      } else if (sError && (sError.code === '42P01' || sError.message?.includes('does not exist'))) {
        // La tabla no existe aún en Supabase
        setDbTableMissing(true);
      }
    } catch (err) {
      console.warn('Supabase church_services query exception:', err);
      setDbTableMissing(true);
    }

    // Fallback a LocalStorage si la tabla de Supabase aún no está creada
    if (!supabaseSuccess && typeof window !== 'undefined') {
      try {
        const rawServices = localStorage.getItem(LOCAL_STORAGE_KEY_SERVICES);
        const rawAtts = localStorage.getItem(LOCAL_STORAGE_KEY_ATTENDANCES);

        const localServices: ChurchService[] = rawServices ? JSON.parse(rawServices) : [];
        const localAtts: { service_id: string; member_id: string }[] = rawAtts ? JSON.parse(rawAtts) : [];

        const countsMap: Record<string, number> = {};
        localAtts.forEach((att) => {
          countsMap[att.service_id] = (countsMap[att.service_id] || 0) + 1;
        });

        const merged: ServiceWithCount[] = localServices.map((s) => ({
          ...s,
          attendees_count: countsMap[s.id] || 0,
        }));

        merged.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setServices(merged);
      } catch (e) {
        console.error('Error loading local storage fallback:', e);
      }
    }

    setLoadingServices(false);
  }, [supabase]);

  useEffect(() => {
    fetchMembersList();
    fetchServicesList();
  }, [fetchMembersList, fetchServicesList]);

  /* ── 3. Load attendance for a specific service into editor ── */
  const loadServiceForEditing = useCallback(async (service: ServiceWithCount) => {
    setEditingServiceId(service.id);
    setServiceDate(service.date);

    if (COMMON_SERVICES.includes(service.name)) {
      setServiceName(service.name);
      setIsCustomName(false);
      setCustomServiceName('');
    } else {
      setIsCustomName(true);
      setCustomServiceName(service.name);
    }

    // Cargar asistencias existentes para este servicio
    let memberIds = new Set<string>();
    try {
      const { data, error } = await supabase
        .from('service_attendances')
        .select('member_id')
        .eq('service_id', service.id);

      if (!error && data) {
        memberIds = new Set(data.map((d: { member_id: string }) => d.member_id));
      } else if (typeof window !== 'undefined') {
        // Fallback local
        const rawAtts = localStorage.getItem(LOCAL_STORAGE_KEY_ATTENDANCES);
        if (rawAtts) {
          const list: { service_id: string; member_id: string }[] = JSON.parse(rawAtts);
          memberIds = new Set(list.filter((a) => a.service_id === service.id).map((a) => a.member_id));
        }
      }
    } catch {
      // Ignorar error y usar fallback si hay
    }

    setSelectedMemberIds(memberIds);
    setOriginalMemberIds(new Set(memberIds));
    setView('register');
  }, [supabase]);

  /* ── 4. Open new service register ── */
  const startNewService = () => {
    setEditingServiceId(null);
    setServiceDate(new Date().toISOString().split('T')[0]);
    setServiceName('Servicio Dominical');
    setIsCustomName(false);
    setCustomServiceName('');
    setSelectedMemberIds(new Set());
    setOriginalMemberIds(new Set());
    setMemberSearch('');
    setStatusFilter('all');
    setActiveFilter('all');
    setSelectionFilter('all');
    setView('register');
  };

  /* ── 5. Check if service already exists when changing date or name in form ── */
  const existingServiceMatch = useMemo(() => {
    if (!effectiveServiceName || !serviceDate) return null;
    return services.find(
      (s) => s.name.trim().toLowerCase() === effectiveServiceName.trim().toLowerCase() && s.date === serviceDate
    );
  }, [services, effectiveServiceName, serviceDate]);

  /* ── 6. Filter Members list ── */
  const filteredMembers = useMemo(() => {
    return allMembers.filter((m) => {
      // Búsqueda por nombre o teléfono
      if (memberSearch.trim()) {
        const query = memberSearch.toLowerCase().trim();
        const matchesName = m.full_name?.toLowerCase().includes(query);
        const matchesPhone = m.phone?.toLowerCase().includes(query);
        const matchesMunicipio = m.municipio?.toLowerCase().includes(query);
        if (!matchesName && !matchesPhone && !matchesMunicipio) return false;
      }

      // Filtro por Estado (Nuevo, Reconciliado, Visitante, Consolidado)
      if (statusFilter !== 'all' && m.status !== statusFilter) {
        return false;
      }

      // Filtro por Activo / Inactivo
      const isInactive = Boolean(m.deleted_at);
      if (activeFilter === 'active_only' && isInactive) return false;
      if (activeFilter === 'inactive_only' && !isInactive) return false;

      // Filtro por Estado de Selección
      const isSelected = selectedMemberIds.has(m.id);
      if (selectionFilter === 'selected' && !isSelected) return false;
      if (selectionFilter === 'unselected' && isSelected) return false;

      return true;
    });
  }, [allMembers, memberSearch, statusFilter, activeFilter, selectionFilter, selectedMemberIds]);

  /* ── 7. Toggle member selection ── */
  const toggleMemberSelection = (memberId: string) => {
    setSelectedMemberIds((prev) => {
      const next = new Set(prev);
      if (next.has(memberId)) {
        next.delete(memberId);
      } else {
        next.add(memberId);
      }
      return next;
    });
  };

  /* ── Quick selection actions ── */
  const selectAllFiltered = () => {
    setSelectedMemberIds((prev) => {
      const next = new Set(prev);
      filteredMembers.forEach((m) => next.add(m.id));
      return next;
    });
  };

  const deselectAllFiltered = () => {
    setSelectedMemberIds((prev) => {
      const next = new Set(prev);
      filteredMembers.forEach((m) => next.delete(m.id));
      return next;
    });
  };

  const clearAllSelection = () => {
    setSelectedMemberIds(new Set());
  };

  /* ── 8. Save Attendance ── */
  const handleSaveAttendance = async () => {
    if (!effectiveServiceName.trim()) {
      showToast('Por favor ingresa un nombre para el servicio', 'error');
      return;
    }
    if (!serviceDate) {
      showToast('Por favor selecciona una fecha para el servicio', 'error');
      return;
    }

    setSavingAttendance(true);

    try {
      let targetServiceId = editingServiceId;

      // Si no estamos editando un ID específico, buscar o crear el servicio
      if (!targetServiceId) {
        // Verificar si ya existe en Supabase
        const { data: existing, error: findError } = await supabase
          .from('church_services')
          .select('id')
          .eq('name', effectiveServiceName.trim())
          .eq('date', serviceDate)
          .maybeSingle();

        if (existing?.id) {
          targetServiceId = existing.id;
        } else {
          // Crear nuevo servicio en Supabase
          const { data: created, error: createError } = await supabase
            .from('church_services')
            .insert({
              name: effectiveServiceName.trim(),
              date: serviceDate,
              created_by: profile.id,
            })
            .select('id')
            .single();

          if (!createError && created?.id) {
            targetServiceId = created.id;
          }
        }
      } else {
        // Actualizar servicio existente (si cambió nombre o fecha)
        await supabase
          .from('church_services')
          .update({
            name: effectiveServiceName.trim(),
            date: serviceDate,
          })
          .eq('id', targetServiceId);
      }

      // Si targetServiceId existe en Supabase, guardar asistencias en Supabase
      if (targetServiceId) {
        const toAdd = Array.from(selectedMemberIds).filter((id) => !originalMemberIds.has(id));
        const toRemove = Array.from(originalMemberIds).filter((id) => !selectedMemberIds.has(id));

        if (toRemove.length > 0) {
          await supabase
            .from('service_attendances')
            .delete()
            .eq('service_id', targetServiceId)
            .in('member_id', toRemove);
        }

        if (toAdd.length > 0) {
          const insertPayload = toAdd.map((memberId) => ({
            service_id: targetServiceId,
            member_id: memberId,
            created_by: profile.id,
          }));

          const { error: insertErr } = await supabase
            .from('service_attendances')
            .insert(insertPayload);

          if (insertErr) {
            console.warn('Error inserting attendances to Supabase:', insertErr);
          }
        }

        showToast(`¡Asistencia guardada con éxito! (${selectedMemberIds.size} personas registradas)`);
      } else {
        // Fallback a localStorage
        const localServiceId = editingServiceId || `local_serv_${Date.now()}`;
        const rawServices = localStorage.getItem(LOCAL_STORAGE_KEY_SERVICES);
        const listServices: ChurchService[] = rawServices ? JSON.parse(rawServices) : [];

        const existingIdx = listServices.findIndex((s) => s.id === localServiceId);
        const serviceObj: ChurchService = {
          id: localServiceId,
          name: effectiveServiceName.trim(),
          date: serviceDate,
          created_at: new Date().toISOString(),
          created_by: profile.id,
        };

        if (existingIdx >= 0) {
          listServices[existingIdx] = serviceObj;
        } else {
          listServices.push(serviceObj);
        }
        localStorage.setItem(LOCAL_STORAGE_KEY_SERVICES, JSON.stringify(listServices));

        // Actualizar asistencias en localStorage
        const rawAtts = localStorage.getItem(LOCAL_STORAGE_KEY_ATTENDANCES);
        let listAtts: { service_id: string; member_id: string; created_at: string }[] = rawAtts
          ? JSON.parse(rawAtts)
          : [];

        // Remover asistencias previas de este servicio
        listAtts = listAtts.filter((a) => a.service_id !== localServiceId);

        // Insertar seleccionadas
        selectedMemberIds.forEach((mId) => {
          listAtts.push({
            service_id: localServiceId,
            member_id: mId,
            created_at: new Date().toISOString(),
          });
        });

        localStorage.setItem(LOCAL_STORAGE_KEY_ATTENDANCES, JSON.stringify(listAtts));
        showToast(`Asistencia guardada localmente (${selectedMemberIds.size} personas). Recuerda ejecutar el script SQL en Supabase.`);
      }

      // Recargar lista y volver al reporte
      await fetchServicesList();
      setView('report');
    } catch (err: any) {
      console.error('Error guardando asistencia:', err);
      showToast('Ocurrió un error al guardar la asistencia', 'error');
    } finally {
      setSavingAttendance(false);
    }
  };

  /* ── 9. View Attendees Modal ── */
  const handleOpenAttendeesModal = async (service: ServiceWithCount) => {
    setViewingService(service);
    setLoadingAttendees(true);
    setAttendeeSearch('');

    try {
      const { data, error } = await supabase
        .from('service_attendances')
        .select(`
          id,
          member_id,
          created_at,
          member:members(*)
        `)
        .eq('service_id', service.id);

      if (!error && data) {
        const mapped: AttendeeItem[] = data.map((d: any) => ({
          attendance_id: d.id,
          member_id: d.member_id,
          member: d.member,
          created_at: d.created_at,
        }));
        setServiceAttendees(mapped);
      } else if (typeof window !== 'undefined') {
        // Fallback local
        const rawAtts = localStorage.getItem(LOCAL_STORAGE_KEY_ATTENDANCES);
        if (rawAtts) {
          const list: { id?: string; service_id: string; member_id: string; created_at?: string }[] = JSON.parse(rawAtts);
          const attsOfServ = list.filter((a) => a.service_id === service.id);
          const mapped: AttendeeItem[] = attsOfServ
            .map((a) => {
              const mem = allMembers.find((m) => m.id === a.member_id);
              if (!mem) return null;
              return {
                attendance_id: a.id || `att_${a.member_id}`,
                member_id: a.member_id,
                member: mem,
                created_at: a.created_at || new Date().toISOString(),
              };
            })
            .filter(Boolean) as AttendeeItem[];
          setServiceAttendees(mapped);
        }
      }
    } catch (e) {
      console.error('Error loading attendees:', e);
    } finally {
      setLoadingAttendees(false);
    }
  };

  /* ── 10. Delete Service ── */
  const handleDeleteService = async () => {
    if (!serviceToDelete) return;
    setDeletingService(true);

    try {
      const { error } = await supabase
        .from('church_services')
        .delete()
        .eq('id', serviceToDelete.id);

      if (error) {
        console.warn('Error deleting in Supabase, trying local fallback:', error);
      }

      // También limpiar de localStorage si existe
      if (typeof window !== 'undefined') {
        const rawServices = localStorage.getItem(LOCAL_STORAGE_KEY_SERVICES);
        if (rawServices) {
          const list: ChurchService[] = JSON.parse(rawServices);
          localStorage.setItem(LOCAL_STORAGE_KEY_SERVICES, JSON.stringify(list.filter((s) => s.id !== serviceToDelete.id)));
        }
        const rawAtts = localStorage.getItem(LOCAL_STORAGE_KEY_ATTENDANCES);
        if (rawAtts) {
          const list: { service_id: string }[] = JSON.parse(rawAtts);
          localStorage.setItem(LOCAL_STORAGE_KEY_ATTENDANCES, JSON.stringify(list.filter((a) => a.service_id !== serviceToDelete.id)));
        }
      }

      showToast(`Servicio "${serviceToDelete.name}" eliminado correctamente`);
      setServiceToDelete(null);
      await fetchServicesList();
    } catch (err) {
      showToast('Error al eliminar el servicio', 'error');
    } finally {
      setDeletingService(false);
    }
  };

  /* ── Filtered Report Services ── */
  const filteredServices = useMemo(() => {
    return services.filter((s) => {
      if (reportSearch.trim()) {
        const q = reportSearch.toLowerCase().trim();
        const matchName = s.name.toLowerCase().includes(q);
        const matchDate = s.date.includes(q);
        if (!matchName && !matchDate) return false;
      }

      if (reportDateFilter === 'month') {
        const now = new Date();
        const servDate = new Date(s.date + 'T12:00:00Z');
        if (servDate.getMonth() !== now.getMonth() || servDate.getFullYear() !== now.getFullYear()) {
          return false;
        }
      } else if (reportDateFilter === 'year') {
        const now = new Date();
        const servDate = new Date(s.date + 'T12:00:00Z');
        if (servDate.getFullYear() !== now.getFullYear()) {
          return false;
        }
      }

      return true;
    });
  }, [services, reportSearch, reportDateFilter]);

  /* ── Report KPI Calculations ── */
  const kpis = useMemo(() => {
    const totalServices = services.length;
    const totalAttendances = services.reduce((acc, s) => acc + s.attendees_count, 0);
    const avgAttendance = totalServices > 0 ? Math.round(totalAttendances / totalServices) : 0;
    const maxAttendanceService = services.reduce((max, s) => (s.attendees_count > (max?.attendees_count || 0) ? s : max), null as ServiceWithCount | null);

    return {
      totalServices,
      totalAttendances,
      avgAttendance,
      maxAttendanceService,
    };
  }, [services]);

  /* ── Filtered Attendees in Modal ── */
  const filteredAttendees = useMemo(() => {
    if (!attendeeSearch.trim()) return serviceAttendees;
    const q = attendeeSearch.toLowerCase().trim();
    return serviceAttendees.filter((item) => {
      const name = item.member?.full_name?.toLowerCase() || '';
      const phone = item.member?.phone?.toLowerCase() || '';
      const status = item.member?.status?.toLowerCase() || '';
      return name.includes(q) || phone.includes(q) || status.includes(q);
    });
  }, [serviceAttendees, attendeeSearch]);

  /* ── Copy Attendees list to clipboard ── */
  const copyAttendeesList = () => {
    if (!viewingService || serviceAttendees.length === 0) return;
    const lines = [
      `📋 ASISTENCIA: ${viewingService.name.toUpperCase()}`,
      `📅 Fecha: ${formatearFechaServicio(viewingService.date)}`,
      `👥 Total Asistentes: ${serviceAttendees.length}`,
      '──────────────────────────────',
      ...serviceAttendees.map((a, i) => `${i + 1}. ${a.member?.full_name || 'Miembro'} (${a.member?.status || 'Registrado'})`),
    ];
    navigator.clipboard.writeText(lines.join('\n'));
    showToast('¡Lista de asistentes copiada al portapapeles!');
  };

  /* ── Export Report to CSV ── */
  const exportReportCsv = () => {
    if (services.length === 0) {
      showToast('No hay servicios para exportar', 'error');
      return;
    }
    const headers = ['Fecha', 'Servicio', 'Cantidad de Asistentes'];
    const rows = services.map((s) => [`"${s.date}"`, `"${s.name}"`, s.attendees_count]);
    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `reporte_asistencia_servicios_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Reporte exportado en formato CSV');
  };

  /* ── SQL Script text for copy ── */
  const sqlScript = `-- Ejecuta este script en el Editor SQL de tu proyecto Supabase:

CREATE TABLE IF NOT EXISTS public.church_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  CONSTRAINT uq_church_service_name_date UNIQUE (name, date)
);

CREATE INDEX IF NOT EXISTS idx_church_services_date ON public.church_services(date DESC);

CREATE TABLE IF NOT EXISTS public.service_attendances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID NOT NULL REFERENCES public.church_services(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  CONSTRAINT uq_service_member_attendance UNIQUE (service_id, member_id)
);

CREATE INDEX IF NOT EXISTS idx_service_attendances_service_id ON public.service_attendances(service_id);
CREATE INDEX IF NOT EXISTS idx_service_attendances_member_id ON public.service_attendances(member_id);

ALTER TABLE public.church_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_attendances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir acceso church_services a autenticados"
  ON public.church_services FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Permitir acceso service_attendances a autenticados"
  ON public.service_attendances FOR ALL TO authenticated USING (true) WITH CHECK (true);`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem', width: '100%' }}>
      {/* ── Banner if Supabase table is not yet created ── */}
      {dbTableMissing && (
        <div
          className="card"
          style={{
            background: 'linear-gradient(135deg, rgba(234, 179, 8, 0.12), rgba(201, 168, 76, 0.08))',
            borderColor: 'rgba(234, 179, 8, 0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '1rem',
            padding: '1rem 1.25rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <AlertCircle size={22} color="var(--gold-primary)" style={{ flexShrink: 0 }} />
            <div>
              <p style={{ margin: 0, fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                Configuración en Supabase pendiente
              </p>
              <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                Las tablas de servicios y asistencia aún no existen en Supabase. El módulo está funcionando con guardado local de respaldo.
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowSqlModal(true)}
            className="btn btn-primary"
            style={{ fontSize: '0.8rem', padding: '0.45rem 0.9rem' }}
          >
            Ver Script SQL para Supabase
          </button>
        </div>
      )}

      {/* ── Header con Navegación de Vistas ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: '10px',
                background: 'linear-gradient(135deg, rgba(201,168,76,0.2) 0%, rgba(201,168,76,0.05) 100%)',
                border: '1px solid rgba(201,168,76,0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--gold-primary)',
              }}
            >
              <CalendarCheck size={20} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.45rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                Asistencia a Servicios
              </h2>
              <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                Control de asistencia e historial de servicios por fecha
              </p>
            </div>
          </div>
        </div>

        {/* Action button to switch view */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {view === 'report' ? (
            <button
              onClick={startNewService}
              className="btn btn-primary"
              style={{ gap: '0.5rem', padding: '0.65rem 1.25rem' }}
            >
              <Plus size={18} />
              Registrar Asistencia
            </button>
          ) : (
            <button
              onClick={() => setView('report')}
              className="btn btn-secondary"
              style={{ gap: '0.5rem', padding: '0.65rem 1.25rem' }}
            >
              <ArrowLeft size={16} />
              Volver al Reporte
            </button>
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          VISTA 1: REPORTE DE SERVICIOS (Historial, KPIs y Listado)
          ═══════════════════════════════════════════════════════════════ */}
      {view === 'report' && (
        <>
          {/* ── KPI Cards ── */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '1rem',
            }}
          >
            {/* Card 1: Servicios Realizados */}
            <div className="card-metric">
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Servicios Realizados
                  </span>
                  <span className="font-cinzel" style={{ fontSize: '2.4rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1 }}>
                    {kpis.totalServices}
                  </span>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    Historial registrado
                  </span>
                </div>
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: '12px',
                    background: 'rgba(201, 168, 76, 0.12)',
                    border: '1px solid rgba(201, 168, 76, 0.25)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--gold-primary)',
                    flexShrink: 0,
                  }}
                >
                  <CalendarCheck size={22} />
                </div>
              </div>
            </div>

            {/* Card 2: Asistencias Totales */}
            <div className="card-metric">
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Asistencias Totales
                  </span>
                  <span className="font-cinzel" style={{ fontSize: '2.4rem', fontWeight: 700, color: 'var(--gold-primary)', lineHeight: 1 }}>
                    {kpis.totalAttendances}
                  </span>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    Personas acumuladas
                  </span>
                </div>
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: '12px',
                    background: 'rgba(201, 168, 76, 0.12)',
                    border: '1px solid rgba(201, 168, 76, 0.25)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--gold-primary)',
                    flexShrink: 0,
                  }}
                >
                  <Users size={22} />
                </div>
              </div>
            </div>

            {/* Card 3: Promedio por Servicio */}
            <div className="card-metric">
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Promedio por Servicio
                  </span>
                  <span className="font-cinzel" style={{ fontSize: '2.4rem', fontWeight: 700, color: '#3b82f6', lineHeight: 1 }}>
                    {kpis.avgAttendance}
                  </span>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    Asistentes por reunión
                  </span>
                </div>
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: '12px',
                    background: 'rgba(59, 130, 246, 0.12)',
                    border: '1px solid rgba(59, 130, 246, 0.25)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#3b82f6',
                    flexShrink: 0,
                  }}
                >
                  <BarChart2 size={22} />
                </div>
              </div>
            </div>

            {/* Card 4: Mayor Asistencia */}
            <div className="card-metric">
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', minWidth: 0 }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Mayor Asistencia
                  </span>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.35rem' }}>
                    <span className="font-cinzel" style={{ fontSize: '2.4rem', fontWeight: 700, color: '#10b981', lineHeight: 1 }}>
                      {kpis.maxAttendanceService ? kpis.maxAttendanceService.attendees_count : 0}
                    </span>
                    <span style={{ fontSize: '0.9rem', color: '#10b981', fontWeight: 700 }}>pers.</span>
                  </div>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {kpis.maxAttendanceService ? kpis.maxAttendanceService.name : 'Sin registros'}
                  </span>
                </div>
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: '12px',
                    background: 'rgba(16, 185, 129, 0.12)',
                    border: '1px solid rgba(16, 185, 129, 0.25)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#10b981',
                    flexShrink: 0,
                  }}
                >
                  <Sparkles size={22} />
                </div>
              </div>
            </div>
          </div>

          {/* ── Filtros y Búsqueda del Reporte ── */}
          <div
            className="card"
            style={{
              padding: '1.25rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '0.75rem',
              }}
            >
              <div style={{ position: 'relative', flex: 1, minWidth: '240px' }}>
                <Search
                  size={16}
                  style={{
                    position: 'absolute',
                    left: '0.9rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--text-muted)',
                  }}
                />
                <input
                  type="text"
                  placeholder="Buscar servicio por nombre o fecha (ej: Dominical, 2026-11)..."
                  value={reportSearch}
                  onChange={(e) => setReportSearch(e.target.value)}
                  style={{
                    width: '100%',
                    paddingLeft: '2.5rem',
                    paddingRight: '1rem',
                    paddingTop: '0.65rem',
                    paddingBottom: '0.65rem',
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--border-radius)',
                    color: 'var(--text-primary)',
                    fontSize: '0.85rem',
                  }}
                />
              </div>

              {/* Botones de Filtro Temporal */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <button
                  onClick={() => setReportDateFilter('all')}
                  className={`btn ${reportDateFilter === 'all' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ fontSize: '0.8rem', padding: '0.5rem 0.85rem' }}
                >
                  Todos
                </button>
                <button
                  onClick={() => setReportDateFilter('month')}
                  className={`btn ${reportDateFilter === 'month' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ fontSize: '0.8rem', padding: '0.5rem 0.85rem' }}
                >
                  Este Mes
                </button>
                <button
                  onClick={() => setReportDateFilter('year')}
                  className={`btn ${reportDateFilter === 'year' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ fontSize: '0.8rem', padding: '0.5rem 0.85rem' }}
                >
                  Este Año
                </button>

                <button
                  onClick={exportReportCsv}
                  className="btn btn-secondary"
                  title="Exportar reporte a CSV"
                  style={{ fontSize: '0.8rem', padding: '0.5rem 0.85rem', gap: '0.35rem' }}
                >
                  <Download size={14} />
                  CSV
                </button>
              </div>
            </div>

            {/* ── Tabla de Reporte de Servicios ── */}
            {loadingServices ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 0.75rem' }} />
                <p style={{ margin: 0 }}>Cargando reporte de servicios...</p>
              </div>
            ) : filteredServices.length === 0 ? (
              <div
                style={{
                  padding: '3.5rem 1.5rem',
                  textAlign: 'center',
                  background: 'var(--bg-secondary)',
                  borderRadius: 'var(--border-radius)',
                  border: '1px dashed var(--border-subtle)',
                }}
              >
                <CalendarCheck size={40} color="var(--text-muted)" style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
                <h4 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-primary)' }}>
                  {services.length === 0 ? 'No hay servicios registrados aún' : 'No se encontraron servicios con este filtro'}
                </h4>
                <p style={{ margin: '0 0 1.25rem 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  {services.length === 0
                    ? 'Comienza registrando la asistencia del primer servicio que se haya llevado a cabo.'
                    : 'Prueba cambiando los términos de búsqueda o el filtro temporal.'}
                </p>
                {services.length === 0 && (
                  <button onClick={startNewService} className="btn btn-primary" style={{ gap: '0.5rem' }}>
                    <Plus size={16} />
                    Registrar Primer Servicio
                  </button>
                )}
              </div>
            ) : (
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Servicio</th>
                      <th style={{ textAlign: 'center' }}>Cantidad de Personas</th>
                      <th style={{ textAlign: 'right' }}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredServices.map((service) => (
                      <tr key={service.id}>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                              {formatearFechaServicio(service.date)}
                            </span>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              {service.date}
                            </span>
                          </div>
                        </td>

                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span
                              style={{
                                width: 8,
                                height: 8,
                                borderRadius: '50%',
                                background: 'var(--gold-primary)',
                                display: 'inline-block',
                              }}
                            />
                            <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.9rem' }}>
                              {service.name}
                            </span>
                          </div>
                        </td>

                        <td style={{ textAlign: 'center' }}>
                          <span
                            className="badge"
                            style={{
                              background: 'rgba(201, 168, 76, 0.15)',
                              color: 'var(--gold-primary)',
                              border: '1px solid rgba(201, 168, 76, 0.35)',
                              fontSize: '0.85rem',
                              padding: '0.35rem 0.85rem',
                              fontWeight: 700,
                              borderRadius: '20px',
                            }}
                          >
                            👥 {service.attendees_count} {service.attendees_count === 1 ? 'persona' : 'personas'}
                          </span>
                        </td>

                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.4rem' }}>
                            {/* Ver Lista de Asistentes */}
                            <button
                              onClick={() => handleOpenAttendeesModal(service)}
                              className="btn btn-secondary"
                              title="Ver lista de personas asistentes"
                              style={{ padding: '0.45rem 0.75rem', fontSize: '0.78rem', gap: '0.35rem' }}
                            >
                              <Users size={14} />
                              Ver Personas
                            </button>

                            {/* Modificar Asistencia */}
                            <button
                              onClick={() => loadServiceForEditing(service)}
                              className="btn btn-secondary"
                              title="Editar / Agregar personas a este servicio"
                              style={{ padding: '0.45rem 0.75rem', fontSize: '0.78rem', gap: '0.35rem' }}
                            >
                              <Edit2 size={14} />
                              Modificar
                            </button>

                            {/* Eliminar Servicio (solo roles autorizados o todos los usuarios según permisos) */}
                            <button
                              onClick={() => setServiceToDelete(service)}
                              className="btn btn-danger"
                              title="Eliminar este servicio"
                              style={{ padding: '0.45rem 0.6rem' }}
                            >
                              <Trash2 size={14} />
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
        </>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          VISTA 2: REGISTRO / EDICIÓN DE ASISTENCIA A UN SERVICIO
          ═══════════════════════════════════════════════════════════════ */}
      {view === 'register' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* ── Tarjeta: Identificación del Servicio (Servicio + Fecha) ── */}
          <div
            className="card"
            style={{
              padding: '1.5rem',
              borderTop: '3px solid var(--gold-primary)',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.25rem',
            }}
          >
            <div>
              <h3 style={{ margin: '0 0 0.35rem 0', fontSize: '1.15rem', color: 'var(--text-primary)' }}>
                {editingServiceId ? '✏️ Modificar Asistencia del Servicio' : '✨ Nuevo Registro de Asistencia'}
              </h3>
              <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                Identifica el servicio seleccionando el tipo de servicio y su fecha correspondiente.
              </p>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                gap: '1.25rem',
              }}
            >
              {/* Selector de Fecha */}
              <div>
                <label style={{ display: 'block', marginBottom: '0.45rem', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  📅 Fecha del Servicio
                </label>
                <input
                  type="date"
                  value={serviceDate}
                  onChange={(e) => setServiceDate(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.85rem',
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--border-radius)',
                    color: 'var(--text-primary)',
                    fontSize: '0.9rem',
                    fontWeight: 500,
                  }}
                />
                <p style={{ margin: '0.35rem 0 0 0', fontSize: '0.75rem', color: 'var(--gold-primary)' }}>
                  {formatearFechaServicio(serviceDate)}
                </p>
              </div>

              {/* Selector de Nombre del Servicio */}
              <div>
                <label style={{ display: 'block', marginBottom: '0.45rem', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  ⛪ Servicio
                </label>

                {!isCustomName ? (
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <select
                      value={serviceName}
                      onChange={(e) => {
                        if (e.target.value === '__custom__') {
                          setIsCustomName(true);
                          setCustomServiceName('');
                        } else {
                          setServiceName(e.target.value);
                        }
                      }}
                      style={{
                        flex: 1,
                        padding: '0.65rem 0.85rem',
                        background: 'var(--bg-secondary)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 'var(--border-radius)',
                        color: 'var(--text-primary)',
                        fontSize: '0.9rem',
                        fontWeight: 600,
                      }}
                    >
                      {COMMON_SERVICES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                      <option value="__custom__">✏️ Otro / Escribir nombre personalizado...</option>
                    </select>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <input
                      type="text"
                      placeholder="Ej: Culto Especial de Santa Cena, Conferencia..."
                      value={customServiceName}
                      onChange={(e) => setCustomServiceName(e.target.value)}
                      autoFocus
                      style={{
                        flex: 1,
                        padding: '0.65rem 0.85rem',
                        background: 'var(--bg-secondary)',
                        border: '1px solid var(--border-focus)',
                        borderRadius: 'var(--border-radius)',
                        color: 'var(--text-primary)',
                        fontSize: '0.9rem',
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setIsCustomName(false)}
                      className="btn btn-secondary"
                      title="Volver a lista de servicios comunes"
                      style={{ padding: '0.65rem' }}
                    >
                      <X size={16} />
                    </button>
                  </div>
                )}

                {/* Chips rápidos de servicios comunes */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginTop: '0.6rem' }}>
                  {COMMON_SERVICES.slice(0, 4).map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => {
                        setServiceName(chip);
                        setIsCustomName(false);
                      }}
                      style={{
                        border: '1px solid var(--border-subtle)',
                        background:
                          !isCustomName && serviceName === chip
                            ? 'rgba(201, 168, 76, 0.2)'
                            : 'var(--bg-tertiary)',
                        color:
                          !isCustomName && serviceName === chip
                            ? 'var(--gold-primary)'
                            : 'var(--text-secondary)',
                        padding: '0.2rem 0.55rem',
                        borderRadius: '12px',
                        fontSize: '0.72rem',
                        cursor: 'pointer',
                        fontWeight: !isCustomName && serviceName === chip ? 700 : 400,
                      }}
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Aviso si este servicio ya tiene registros previos cargados */}
            {existingServiceMatch && !editingServiceId && (
              <div
                style={{
                  background: 'rgba(59, 130, 246, 0.1)',
                  border: '1px solid rgba(59, 130, 246, 0.3)',
                  borderRadius: 'var(--border-radius)',
                  padding: '0.75rem 1rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '1rem',
                  fontSize: '0.82rem',
                  color: 'var(--text-primary)',
                }}
              >
                <span>
                  ℹ️ Ya existe un registro para <strong>{existingServiceMatch.name}</strong> el <strong>{existingServiceMatch.date}</strong> con {existingServiceMatch.attendees_count} asistentes.
                </span>
                <button
                  type="button"
                  onClick={() => loadServiceForEditing(existingServiceMatch)}
                  className="btn btn-primary"
                  style={{ fontSize: '0.75rem', padding: '0.35rem 0.75rem' }}
                >
                  Cargar y Editar
                </button>
              </div>
            )}
          </div>

          {/* ── Tarjeta: Selector y Búsqueda de Personas ── */}
          <div
            className="card"
            style={{
              padding: '1.5rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.25rem',
            }}
          >
            {/* Header del selector de personas */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '1rem',
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Users size={18} color="var(--gold-primary)" />
                  Seleccionar Personas Asistentes
                </h3>
                <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  Incluye miembros consolidados, nuevos, reconciliados, visitantes e inactivos.
                </p>
              </div>

              {/* Contador de seleccionados destacado */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  background: 'rgba(201, 168, 76, 0.12)',
                  border: '1px solid rgba(201, 168, 76, 0.35)',
                  borderRadius: '25px',
                  padding: '0.5rem 1.15rem',
                }}
              >
                <CheckSquare size={18} color="var(--gold-primary)" />
                <span style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {selectedMemberIds.size}{' '}
                  <span style={{ fontWeight: 500, color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
                    de {allMembers.length} seleccionadas
                  </span>
                </span>
              </div>
            </div>

            {/* Barra de Búsqueda y Filtros de Miembros */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ position: 'relative', width: '100%' }}>
                <Search
                  size={16}
                  style={{
                    position: 'absolute',
                    left: '0.9rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--text-muted)',
                  }}
                />
                <input
                  type="text"
                  placeholder="Buscar persona por nombre, teléfono o municipio..."
                  value={memberSearch}
                  onChange={(e) => setMemberSearch(e.target.value)}
                  style={{
                    width: '100%',
                    paddingLeft: '2.5rem',
                    paddingRight: memberSearch ? '2.5rem' : '1rem',
                    paddingTop: '0.7rem',
                    paddingBottom: '0.7rem',
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--border-radius)',
                    color: 'var(--text-primary)',
                    fontSize: '0.9rem',
                  }}
                />
                {memberSearch && (
                  <button
                    onClick={() => setMemberSearch('')}
                    style={{
                      position: 'absolute',
                      right: '0.75rem',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                    }}
                  >
                    <X size={16} />
                  </button>
                )}
              </div>

              {/* Filtros por Estado, Activo/Inactivo y Selección */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '0.65rem',
                }}
              >
                {/* Filtro por Estado */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                  {(['all', 'Nuevo', 'Reconciliado', 'Visitante', 'Consolidado'] as const).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setStatusFilter(st)}
                      style={{
                        padding: '0.3rem 0.65rem',
                        fontSize: '0.75rem',
                        borderRadius: '6px',
                        border: '1px solid',
                        borderColor: statusFilter === st ? 'var(--gold-primary)' : 'var(--border-subtle)',
                        background: statusFilter === st ? 'rgba(201, 168, 76, 0.18)' : 'var(--bg-secondary)',
                        color: statusFilter === st ? 'var(--gold-primary)' : 'var(--text-secondary)',
                        cursor: 'pointer',
                        fontWeight: statusFilter === st ? 600 : 400,
                      }}
                    >
                      {st === 'all' ? 'Todos los estados' : st}
                    </button>
                  ))}
                </div>

                {/* Filtro por Activo / Inactivo */}
                <div style={{ display: 'flex', gap: '0.35rem' }}>
                  <button
                    type="button"
                    onClick={() => setActiveFilter('all')}
                    style={{
                      padding: '0.3rem 0.6rem',
                      fontSize: '0.75rem',
                      borderRadius: '6px',
                      border: '1px solid',
                      borderColor: activeFilter === 'all' ? 'var(--gold-primary)' : 'var(--border-subtle)',
                      background: activeFilter === 'all' ? 'rgba(201, 168, 76, 0.15)' : 'var(--bg-secondary)',
                      color: activeFilter === 'all' ? 'var(--gold-primary)' : 'var(--text-secondary)',
                      cursor: 'pointer',
                    }}
                  >
                    Activos e Inactivos
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveFilter('inactive_only')}
                    style={{
                      padding: '0.3rem 0.6rem',
                      fontSize: '0.75rem',
                      borderRadius: '6px',
                      border: '1px solid',
                      borderColor: activeFilter === 'inactive_only' ? '#ef4444' : 'var(--border-subtle)',
                      background: activeFilter === 'inactive_only' ? 'rgba(239, 68, 68, 0.15)' : 'var(--bg-secondary)',
                      color: activeFilter === 'inactive_only' ? '#ef4444' : 'var(--text-secondary)',
                      cursor: 'pointer',
                    }}
                  >
                    Solo Inactivos
                  </button>
                </div>

                {/* Filtro por Seleccionados / No Seleccionados */}
                <div style={{ display: 'flex', gap: '0.35rem' }}>
                  <button
                    type="button"
                    onClick={() => setSelectionFilter(selectionFilter === 'selected' ? 'all' : 'selected')}
                    style={{
                      padding: '0.3rem 0.65rem',
                      fontSize: '0.75rem',
                      borderRadius: '6px',
                      border: '1px solid',
                      borderColor: selectionFilter === 'selected' ? '#10b981' : 'var(--border-subtle)',
                      background: selectionFilter === 'selected' ? 'rgba(16, 185, 129, 0.15)' : 'var(--bg-secondary)',
                      color: selectionFilter === 'selected' ? '#10b981' : 'var(--text-secondary)',
                      cursor: 'pointer',
                      fontWeight: 600,
                    }}
                  >
                    ✓ Ver Seleccionados ({selectedMemberIds.size})
                  </button>
                </div>
              </div>

              {/* Botones de Selección Masiva */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '0.5rem',
                  padding: '0.6rem 0.85rem',
                  background: 'var(--bg-tertiary)',
                  borderRadius: 'var(--border-radius)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={selectAllFiltered}
                    className="btn btn-secondary"
                    style={{ fontSize: '0.75rem', padding: '0.35rem 0.75rem', gap: '0.3rem' }}
                  >
                    <CheckSquare size={14} />
                    Seleccionar todos ({filteredMembers.length})
                  </button>

                  <button
                    type="button"
                    onClick={deselectAllFiltered}
                    className="btn btn-secondary"
                    style={{ fontSize: '0.75rem', padding: '0.35rem 0.75rem', gap: '0.3rem' }}
                  >
                    <Square size={14} />
                    Deseleccionar filtrados
                  </button>

                  {selectedMemberIds.size > 0 && (
                    <button
                      type="button"
                      onClick={clearAllSelection}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-muted)',
                        fontSize: '0.75rem',
                        cursor: 'pointer',
                        textDecoration: 'underline',
                        padding: '0.2rem 0.4rem',
                      }}
                    >
                      Limpiar toda la selección
                    </button>
                  )}
                </div>

                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Mostrando {filteredMembers.length} de {allMembers.length} registros
                </span>
              </div>
            </div>

            {/* ── Lista Seleccionable de Miembros ── */}
            {loadingMembers ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 0.75rem' }} />
                <p>Cargando lista de personas registradas...</p>
              </div>
            ) : filteredMembers.length === 0 ? (
              <div
                style={{
                  padding: '2.5rem 1rem',
                  textAlign: 'center',
                  background: 'var(--bg-secondary)',
                  borderRadius: 'var(--border-radius)',
                  color: 'var(--text-muted)',
                }}
              >
                <Users size={32} style={{ margin: '0 auto 0.5rem', opacity: 0.5 }} />
                <p style={{ margin: 0, fontWeight: 500 }}>No se encontraron personas con los filtros seleccionados.</p>
                <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.8rem' }}>
                  Prueba cambiando el texto de búsqueda o quitando los filtros de estado.
                </p>
              </div>
            ) : (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))',
                  gap: '0.65rem',
                  maxHeight: '480px',
                  overflowY: 'auto',
                  paddingRight: '0.35rem',
                }}
              >
                {filteredMembers.map((member) => {
                  const isSelected = selectedMemberIds.has(member.id);
                  const isInactive = Boolean(member.deleted_at);

                  return (
                    <div
                      key={member.id}
                      onClick={() => toggleMemberSelection(member.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        padding: '0.75rem 0.9rem',
                        borderRadius: 'var(--border-radius)',
                        border: '1px solid',
                        borderColor: isSelected
                          ? 'var(--gold-primary)'
                          : isInactive
                          ? 'rgba(239, 68, 68, 0.25)'
                          : 'var(--border-subtle)',
                        background: isSelected
                          ? 'linear-gradient(135deg, rgba(201, 168, 76, 0.14) 0%, rgba(201, 168, 76, 0.04) 100%)'
                          : isInactive
                          ? 'rgba(239, 68, 68, 0.03)'
                          : 'var(--bg-secondary)',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        boxShadow: isSelected ? '0 2px 8px rgba(201, 168, 76, 0.15)' : 'none',
                      }}
                    >
                      {/* Custom Checkbox visual */}
                      <div
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: '6px',
                          border: `2px solid ${isSelected ? 'var(--gold-primary)' : 'var(--border-focus)'}`,
                          background: isSelected ? 'var(--gold-primary)' : 'transparent',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                          transition: 'all 0.15s ease',
                        }}
                      >
                        {isSelected && <Check size={14} color="#000" strokeWidth={3} />}
                      </div>

                      {/* Initial Avatar */}
                      <div
                        className="avatar-placeholder"
                        style={{
                          width: 32,
                          height: 32,
                          fontSize: '0.8rem',
                          background: isSelected ? 'rgba(201,168,76,0.3)' : 'var(--bg-tertiary)',
                          color: isSelected ? 'var(--gold-primary)' : 'var(--text-secondary)',
                          flexShrink: 0,
                        }}
                      >
                        {member.full_name?.charAt(0).toUpperCase() || 'M'}
                      </div>

                      {/* Info Miembro */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p
                          style={{
                            margin: 0,
                            fontWeight: isSelected ? 700 : 500,
                            fontSize: '0.88rem',
                            color: isSelected ? 'var(--text-primary)' : 'var(--text-primary)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {member.full_name}
                        </p>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: '0.2rem', flexWrap: 'wrap' }}>
                          {/* Badge de Estado */}
                          <span
                            className={`badge badge-${member.status?.toLowerCase() || 'nuevo'}`}
                            style={{ fontSize: '0.62rem', padding: '0.1rem 0.4rem' }}
                          >
                            {member.status || 'Nuevo'}
                          </span>

                          {/* Badge de Inactivo si corresponde */}
                          {isInactive && (
                            <span
                              style={{
                                fontSize: '0.62rem',
                                padding: '0.1rem 0.4rem',
                                borderRadius: '4px',
                                background: 'rgba(239, 68, 68, 0.15)',
                                color: '#ef4444',
                                border: '1px solid rgba(239, 68, 68, 0.3)',
                                fontWeight: 600,
                              }}
                            >
                              Inactivo
                            </span>
                          )}

                          {/* Municipio o Teléfono */}
                          {member.municipio && (
                            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                              • {member.municipio}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* ── Barra de Acción Inferior: Guardar Asistencia ── */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '1rem',
                borderTop: '1px solid var(--border-subtle)',
                paddingTop: '1.25rem',
                marginTop: '0.5rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                  Total a guardar: <strong style={{ color: 'var(--gold-primary)', fontSize: '1.05rem' }}>{selectedMemberIds.size} personas</strong>
                </span>
                {editingServiceId && (
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    (Previamente había {originalMemberIds.size})
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <button
                  type="button"
                  onClick={() => setView('report')}
                  className="btn btn-secondary"
                  disabled={savingAttendance}
                >
                  Cancelar
                </button>

                <button
                  type="button"
                  onClick={handleSaveAttendance}
                  className="btn btn-primary"
                  disabled={savingAttendance || !effectiveServiceName.trim() || !serviceDate}
                  style={{ gap: '0.5rem', padding: '0.7rem 1.6rem', fontSize: '0.95rem', fontWeight: 700 }}
                >
                  {savingAttendance ? (
                    <>
                      <RefreshCw size={18} className="animate-spin" />
                      Guardando Asistencia...
                    </>
                  ) : (
                    <>
                      <Check size={18} />
                      Guardar Asistencia ({selectedMemberIds.size})
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          MODAL: VER LISTA DE ASISTENTES DE UN SERVICIO
          ═══════════════════════════════════════════════════════════════ */}
      {viewingService && (
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
          }}
          onClick={(e) => e.target === e.currentTarget && setViewingService(null)}
        >
          <div
            className="card-glass"
            style={{
              width: '100%',
              maxWidth: '620px',
              padding: '1.75rem',
              maxHeight: '90vh',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.25rem',
            }}
          >
            {/* Header del Modal */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem' }}>
              <div>
                <span
                  style={{
                    fontSize: '0.72rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    color: 'var(--gold-primary)',
                    fontWeight: 700,
                  }}
                >
                  Lista de Asistencia
                </span>
                <h3 style={{ margin: '0.2rem 0 0 0', fontSize: '1.25rem', color: 'var(--text-primary)' }}>
                  {viewingService.name}
                </h3>
                <p style={{ margin: '0.15rem 0 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  📅 {formatearFechaServicio(viewingService.date)}
                </p>
              </div>

              <button
                onClick={() => setViewingService(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '0.35rem',
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Total Badge & Quick Actions */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '0.75rem',
                background: 'var(--bg-secondary)',
                padding: '0.75rem 1rem',
                borderRadius: 'var(--border-radius)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Users size={18} color="var(--gold-primary)" />
                <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                  {serviceAttendees.length} personas asistieron
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <button
                  onClick={copyAttendeesList}
                  className="btn btn-secondary"
                  title="Copiar lista al portapapeles"
                  style={{ fontSize: '0.78rem', padding: '0.4rem 0.75rem', gap: '0.35rem' }}
                >
                  <Copy size={13} />
                  Copiar Nombres
                </button>

                <button
                  onClick={() => {
                    const s = viewingService;
                    setViewingService(null);
                    loadServiceForEditing(s);
                  }}
                  className="btn btn-primary"
                  style={{ fontSize: '0.78rem', padding: '0.4rem 0.75rem', gap: '0.35rem' }}
                >
                  <Edit2 size={13} />
                  Modificar
                </button>
              </div>
            </div>

            {/* Buscador dentro de asistentes */}
            {serviceAttendees.length > 5 && (
              <div style={{ position: 'relative' }}>
                <Search
                  size={15}
                  style={{
                    position: 'absolute',
                    left: '0.8rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--text-muted)',
                  }}
                />
                <input
                  type="text"
                  placeholder="Buscar en asistentes de este servicio..."
                  value={attendeeSearch}
                  onChange={(e) => setAttendeeSearch(e.target.value)}
                  style={{
                    width: '100%',
                    paddingLeft: '2.4rem',
                    paddingRight: '1rem',
                    paddingTop: '0.55rem',
                    paddingBottom: '0.55rem',
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--border-radius)',
                    color: 'var(--text-primary)',
                    fontSize: '0.82rem',
                  }}
                />
              </div>
            )}

            {/* Listado de Asistentes */}
            {loadingAttendees ? (
              <div style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                <RefreshCw size={22} className="animate-spin" style={{ margin: '0 auto 0.5rem' }} />
                <p style={{ margin: 0 }}>Cargando personas...</p>
              </div>
            ) : filteredAttendees.length === 0 ? (
              <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem 0' }}>
                {serviceAttendees.length === 0
                  ? 'No hay personas registradas para este servicio.'
                  : 'No se encontraron asistentes con ese criterio de búsqueda.'}
              </p>
            ) : (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem',
                  maxHeight: '380px',
                  overflowY: 'auto',
                }}
              >
                {filteredAttendees.map((item, index) => {
                  const member = item.member;
                  const isInactive = Boolean(member?.deleted_at);

                  return (
                    <div
                      key={item.attendance_id || item.member_id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '0.75rem',
                        padding: '0.65rem 0.85rem',
                        background: 'var(--bg-secondary)',
                        borderRadius: 'var(--border-radius)',
                        border: '1px solid var(--border-subtle)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', minWidth: 0 }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', width: 22 }}>
                          {index + 1}.
                        </span>
                        <div
                          className="avatar-placeholder"
                          style={{ width: 30, height: 30, fontSize: '0.75rem', flexShrink: 0 }}
                        >
                          {member?.full_name?.charAt(0).toUpperCase() || 'M'}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <p
                            style={{
                              margin: 0,
                              fontWeight: 600,
                              fontSize: '0.85rem',
                              color: 'var(--text-primary)',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                          >
                            {member?.full_name || 'Miembro no identificado'}
                          </p>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: '0.15rem' }}>
                            <span
                              className={`badge badge-${member?.status?.toLowerCase() || 'nuevo'}`}
                              style={{ fontSize: '0.6rem', padding: '0.05rem 0.35rem' }}
                            >
                              {member?.status || 'Registrado'}
                            </span>
                            {isInactive && (
                              <span
                                style={{
                                  fontSize: '0.6rem',
                                  padding: '0.05rem 0.35rem',
                                  borderRadius: '3px',
                                  background: 'rgba(239, 68, 68, 0.15)',
                                  color: '#ef4444',
                                  fontWeight: 600,
                                }}
                              >
                                Inactivo
                              </span>
                            )}
                            {member?.municipio && (
                              <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                                • {member.municipio}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Teléfono / WhatsApp si existe */}
                      {member?.phone && (
                        <a
                          href={getWhatsAppUrl(member.phone, `¡Hola ${member.full_name}! Dios te bendiga, un gusto saludarte tras el servicio ${viewingService.name}.`)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn-secondary"
                          style={{
                            padding: '0.35rem 0.6rem',
                            fontSize: '0.72rem',
                            gap: '0.3rem',
                            color: '#25D366',
                            borderColor: 'rgba(37, 211, 102, 0.3)',
                          }}
                        >
                          <MessageCircle size={13} />
                          {formatearTelefono(member.phone)}
                        </a>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '0.5rem' }}>
              <button onClick={() => setViewingService(null)} className="btn btn-secondary">
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          MODAL: CONFIRMACIÓN PARA ELIMINAR SERVICIO
          ═══════════════════════════════════════════════════════════════ */}
      {serviceToDelete && (
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
          }}
          onClick={(e) => e.target === e.currentTarget && setServiceToDelete(null)}
        >
          <div
            className="card-glass"
            style={{
              width: '100%',
              maxWidth: '440px',
              padding: '1.75rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.25rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: '50%',
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ef4444',
                }}
              >
                <Trash2 size={20} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--text-primary)' }}>
                  ¿Eliminar este servicio?
                </h3>
                <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                  Esta acción eliminará el servicio y su lista de asistencias.
                </p>
              </div>
            </div>

            <div
              style={{
                background: 'var(--bg-secondary)',
                padding: '0.85rem 1rem',
                borderRadius: 'var(--border-radius)',
                fontSize: '0.85rem',
              }}
            >
              <p style={{ margin: 0, fontWeight: 600, color: 'var(--text-primary)' }}>
                {serviceToDelete.name}
              </p>
              <p style={{ margin: '0.2rem 0 0 0', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                📅 {formatearFechaServicio(serviceToDelete.date)}
              </p>
              <p style={{ margin: '0.2rem 0 0 0', color: 'var(--gold-primary)', fontSize: '0.8rem', fontWeight: 600 }}>
                👥 {serviceToDelete.attendees_count} asistentes registrados
              </p>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button
                type="button"
                onClick={() => setServiceToDelete(null)}
                className="btn btn-secondary"
                disabled={deletingService}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDeleteService}
                className="btn btn-danger"
                disabled={deletingService}
                style={{ gap: '0.4rem' }}
              >
                {deletingService ? (
                  <>
                    <RefreshCw size={15} className="animate-spin" />
                    Eliminando...
                  </>
                ) : (
                  <>
                    <Trash2 size={15} />
                    Confirmar y Eliminar
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          MODAL: INSTRUCCIONES SQL PARA SUPABASE
          ═══════════════════════════════════════════════════════════════ */}
      {showSqlModal && (
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
          }}
          onClick={(e) => e.target === e.currentTarget && setShowSqlModal(false)}
        >
          <div
            className="card-glass"
            style={{
              width: '100%',
              maxWidth: '680px',
              padding: '1.75rem',
              maxHeight: '90vh',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.25rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <Sparkles size={20} color="var(--gold-primary)" />
                <h3 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--text-primary)' }}>
                  Script SQL para Supabase
                </h3>
              </div>
              <button
                onClick={() => setShowSqlModal(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Copia y pega este script en el <strong>SQL Editor</strong> de tu consola de Supabase y haz clic en <strong>Run</strong>:
            </p>

            <pre
              style={{
                background: '#0d1117',
                color: '#58a6ff',
                padding: '1rem',
                borderRadius: 'var(--border-radius)',
                fontSize: '0.78rem',
                overflowX: 'auto',
                border: '1px solid var(--border-subtle)',
                maxHeight: '320px',
                lineHeight: 1.5,
              }}
            >
              {sqlScript}
            </pre>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(sqlScript);
                  showToast('¡Script SQL copiado al portapapeles!');
                }}
                className="btn btn-primary"
                style={{ gap: '0.5rem', fontSize: '0.85rem' }}
              >
                <Copy size={16} />
                Copiar Script SQL
              </button>

              <button onClick={() => setShowSqlModal(false)} className="btn btn-secondary">
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

